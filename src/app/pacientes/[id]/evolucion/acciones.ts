"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  leerItemsSesion, LISTA_CAMPOS_EVOLUCION, validarEvolucion, type CampoEvolucion,
} from "@/lib/clinico/evolucion";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion, type Sesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sesión de un cirujano dentista con el módulo encendido; si no, el mensaje para el usuario. */
async function dentista(pacienteId: string): Promise<{ error: string } | { error: null; sesion: Sesion }> {
  if (!modulos.etapa6) return { error: "Este módulo aún no está habilitado." };
  if (!UUID.test(pacienteId)) return { error: "Paciente inválido." };
  const sesion = await obtenerSesion();
  if (!sesion?.esDentista) return { error: "Solo el cirujano dentista escribe y firma la evolución." };
  return { error: null, sesion };
}

function mensajeDeError(error: { code?: string; message: string }, contexto: string, que: string): string {
  if (error.code === "P0001" && error.message.startsWith("El paciente está anulado")) {
    return "Este paciente está anulado o fusionado: regístralo en el paciente vigente.";
  }
  if (error.code === "P0001") return `${error.message}.`.replace(/\.\.$/, ".");
  registrarError(contexto, error);
  return `No se pudo ${que}. Inténtalo de nuevo.`;
}

/** Ítems aceptados o programados del paciente (los que se pueden trabajar en una sesión). */
async function itemsPendientes(pacienteId: string): Promise<Set<string> | null> {
  const supabase = await createClient();
  const { data: planes, error } = await supabase.from("plan_tratamiento").select("id").eq("paciente_id", pacienteId)
    .returns<{ id: string }[]>();
  if (error) return null;
  if (!planes || planes.length === 0) return new Set();
  const { data, error: e2 } = await supabase.from("item_plan").select("id").in("plan_id", planes.map((p) => p.id))
    .in("estado", ["aceptado", "programado"]).returns<{ id: string }[]>();
  if (e2) return null;
  return new Set((data ?? []).map((i) => i.id));
}

// ---------------------------------------------------------------------------
// Nueva evolución sin cita (urgencia, paciente sin turno)
// ---------------------------------------------------------------------------
export type EstadoSimple = { error: string | null; ok: boolean; intento: number; texto: string };

export async function nuevaEvolucion(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const intento = previo.intento + 1;
  const d = await dentista(pacienteId);
  if (d.error !== null) return { error: d.error, ok: false, intento, texto: "" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("nota_evolucion").insert({
    clinica_id: d.sesion.clinicaId, paciente_id: pacienteId, odontologo_id: d.sesion.usuarioId, texto: "",
  }).select("id").single<{ id: string }>();
  if (error || !data) {
    return { error: error ? mensajeDeError(error, "evolucion.nueva", "abrir la evolución") : "No se pudo abrir la evolución.",
      ok: false, intento, texto: "" };
  }
  revalidatePath(`/pacientes/${pacienteId}/evolucion`);
  redirect(`/pacientes/${pacienteId}/evolucion#evolucion-${data.id}`);
}

// ---------------------------------------------------------------------------
// Guardar borrador / Firmar y cerrar
// ---------------------------------------------------------------------------
export type EstadoEvolucion = {
  errores: Partial<Record<CampoEvolucion | "items" | "general", string>>;
  mensaje: string | null;
  /** Lo enviado, para no perderlo si hay errores. `null`: usar lo guardado. */
  valores: { textos: Record<string, string>; trabajados: string[]; terminados: string[] } | null;
  intento: number;
};

export async function guardarEvolucion(previo: EstadoEvolucion, form: FormData): Promise<EstadoEvolucion> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const notaId = String(form.get("nota_id") ?? "");
  const firmar = form.get("accion") === "firmar";
  const valores = {
    textos: Object.fromEntries(LISTA_CAMPOS_EVOLUCION.map((c) => [c, String(form.get(c) ?? "")])),
    trabajados: form.getAll("trabajado").map(String),
    terminados: form.getAll("terminado").map(String),
  };
  const intento = previo.intento + 1;
  const fallo = (errores: EstadoEvolucion["errores"]): EstadoEvolucion => ({ errores, mensaje: null, valores, intento });
  const d = await dentista(pacienteId);
  if (d.error !== null) return fallo({ general: d.error });
  if (!UUID.test(notaId)) return fallo({ general: "Evolución inválida. Recarga la página." });

  const r = validarEvolucion((c) => valores.textos[c] ?? "", firmar);
  if (!r.ok) return fallo(r.errores);

  const supabase = await createClient();
  const [{ data: nota }, existentes, pendientes] = await Promise.all([
    supabase.from("nota_evolucion").select("id, odontologo_id, firmada_at, anulado_at")
      .eq("id", notaId).eq("paciente_id", pacienteId)
      .maybeSingle<{ id: string; odontologo_id: string; firmada_at: string | null; anulado_at: string | null }>(),
    supabase.from("evolucion_item").select("id, item_id, trabajado, terminado").eq("nota_id", notaId)
      .returns<{ id: string; item_id: string; trabajado: boolean; terminado: boolean }[]>(),
    itemsPendientes(pacienteId),
  ]);
  if (!nota) return fallo({ general: "Evolución no encontrada. Recarga la página." });
  if (nota.anulado_at) return fallo({ general: "Esta evolución está anulada." });
  if (nota.firmada_at) return fallo({ general: "Esta evolución ya está firmada: agrega una adenda." });
  if (nota.odontologo_id !== d.sesion.usuarioId) return fallo({ general: "Solo el autor edita su evolución en borrador." });
  if (existentes.error || !pendientes) {
    if (existentes.error) registrarError("evolucion.items", existentes.error, { nota: notaId });
    return fallo({ general: "No se pudieron cargar los ítems del plan. Inténtalo de nuevo." });
  }

  const items = leerItemsSesion(valores.trabajados, valores.terminados, pendientes);
  if (!items.ok) return fallo({ items: items.error });

  const { error } = await supabase.from("nota_evolucion").update(r.datos).eq("id", notaId);
  if (error) return fallo({ general: mensajeDeError(error, "evolucion.guardar", "guardar la evolución") });

  // Ítems: se actualiza lo que cambió y se agregan los nuevos marcados (sin DELETE: se desmarcan).
  const previos = new Map((existentes.data ?? []).map((e) => [e.item_id, e]));
  for (const it of items.items) {
    const ya = previos.get(it.item_id);
    const cambio = ya
      ? (ya.trabajado !== it.trabajado || ya.terminado !== it.terminado
          ? supabase.from("evolucion_item").update({ trabajado: it.trabajado, terminado: it.terminado }).eq("id", ya.id)
          : null)
      : (it.trabajado
          ? supabase.from("evolucion_item").insert({ clinica_id: d.sesion.clinicaId, nota_id: notaId, ...it })
          : null);
    if (!cambio) continue;
    const { error: e } = await cambio;
    if (e) return fallo({ items: mensajeDeError(e, "evolucion.item", "guardar los ítems trabajados") });
  }

  revalidatePath(`/pacientes/${pacienteId}/evolucion`);
  revalidatePath(`/pacientes/${pacienteId}/plan`);
  if (!firmar) return { errores: {}, mensaje: "Borrador guardado.", valores: null, intento };

  const firma = await supabase.rpc("firmar_evolucion", { id_nota: notaId });
  if (firma.error) {
    return {
      errores: { general: `Se guardó el borrador, pero no se pudo firmar: ${mensajeDeError(firma.error, "evolucion.firmar", "firmar")}` },
      mensaje: null, valores: null, intento,
    };
  }
  revalidatePath("/agenda");
  return { errores: {}, mensaje: "Evolución firmada.", valores: null, intento };
}

// ---------------------------------------------------------------------------
// Adenda (evolución firmada) y anulación
// ---------------------------------------------------------------------------
export async function agregarAdenda(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const notaId = String(form.get("nota_id") ?? "");
  const texto = String(form.get("texto") ?? "").trim();
  const intento = previo.intento + 1;
  const fallo = (error: string): EstadoSimple => ({ error, ok: false, intento, texto });
  const d = await dentista(pacienteId);
  if (d.error !== null) return fallo(d.error);
  if (!UUID.test(notaId)) return fallo("Evolución inválida.");
  if (texto.length < 3) return fallo("Escribe la adenda.");
  if (texto.length > 2000) return fallo("Máximo 2000 caracteres.");
  const supabase = await createClient();
  const { data: nota } = await supabase.from("nota_evolucion").select("id").eq("id", notaId).eq("paciente_id", pacienteId)
    .maybeSingle<{ id: string }>();
  if (!nota) return fallo("Evolución no encontrada. Recarga la página.");
  const { error } = await supabase.from("evolucion_adenda").insert({
    clinica_id: d.sesion.clinicaId, nota_id: notaId, texto, registrado_por: d.sesion.usuarioId,
  });
  if (error) return fallo(mensajeDeError(error, "evolucion.adenda", "guardar la adenda"));
  revalidatePath(`/pacientes/${pacienteId}/evolucion`);
  return { error: null, ok: true, intento, texto: "" };
}

export async function anularEvolucion(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const notaId = String(form.get("nota_id") ?? "");
  const motivo = String(form.get("motivo") ?? "").trim();
  const intento = previo.intento + 1;
  const fallo = (error: string): EstadoSimple => ({ error, ok: false, intento, texto: motivo });
  const d = await dentista(pacienteId);
  if (d.error !== null) return fallo(d.error);
  if (!UUID.test(notaId)) return fallo("Evolución inválida.");
  if (motivo.length < 3) return fallo("Escribe por qué se anula.");
  if (motivo.length > 200) return fallo("Máximo 200 caracteres.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("nota_evolucion")
    .update({ anulado_at: new Date().toISOString(), anulado_por: d.sesion.usuarioId, motivo_anulacion: motivo })
    .eq("id", notaId).eq("paciente_id", pacienteId).is("anulado_at", null).select("id").maybeSingle();
  if (error || !data) {
    if (error) return fallo(mensajeDeError(error, "evolucion.anular", "anular la evolución"));
    return fallo("No se pudo anular la evolución. Recarga la página.");
  }
  revalidatePath(`/pacientes/${pacienteId}/evolucion`);
  revalidatePath("/agenda");
  return { error: null, ok: true, intento, texto: "" };
}
