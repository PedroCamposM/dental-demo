"use server";

import { revalidatePath } from "next/cache";
import { validarConstancia, validarReceta } from "@/lib/clinico/documentos";
import { validarMotivo } from "@/lib/clinico/consentimientos";
import { fechaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion, type Sesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function dentista(pacienteId: string): Promise<{ error: string } | { error: null; sesion: Sesion }> {
  if (!modulos.etapa7) return { error: "Este módulo aún no está habilitado." };
  if (!UUID.test(pacienteId)) return { error: "Paciente inválido." };
  const sesion = await obtenerSesion();
  if (!sesion?.esDentista) return { error: "Solo el cirujano dentista emite recetas y constancias." };
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

// ---------------------------------------------------------------------------
// Receta
// ---------------------------------------------------------------------------
export type EstadoReceta = {
  filas: Record<number, string>; general: string | null; mensaje: string | null; exitos: number;
  /** Id de la receta recién emitida (para abrir la impresión). */
  emitida: string | null;
};

export async function emitirReceta(previo: EstadoReceta, form: FormData): Promise<EstadoReceta> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const fallo = (general: string | null, filas: Record<number, string> = {}): EstadoReceta =>
    ({ filas, general, mensaje: null, exitos: previo.exitos, emitida: null });
  const d = await dentista(pacienteId);
  if (d.error !== null) return fallo(d.error);
  const r = validarReceta((c) => form.getAll(c).map(String), (c) => String(form.get(c) ?? ""));
  if (!r.ok) return fallo(r.errores.general ?? "Revisa los medicamentos marcados.", r.errores.filas);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("emitir_receta", {
    id_paciente: pacienteId, id_nota: r.datos.nota_id, indicaciones: r.datos.indicaciones, items: r.datos.items,
  });
  if (error || !data) {
    return fallo(error ? mensajeDeError(error, "receta.emitir", "emitir la receta") : "No se pudo emitir la receta.");
  }
  let mensaje = "Receta emitida.";
  if (r.datos.plantilla) {
    const { error: e2 } = await supabase.from("plantilla_receta").insert({
      clinica_id: d.sesion.clinicaId, profesional_id: d.sesion.usuarioId, nombre: r.datos.plantilla,
      items: r.datos.items, indicaciones: r.datos.indicaciones,
    });
    if (e2?.code === "23505") mensaje = "Receta emitida. Ya tienes una plantilla con ese nombre: no se guardó otra.";
    else if (e2) {
      registrarError("receta.plantilla", e2);
      mensaje = "Receta emitida, pero no se pudo guardar la plantilla.";
    } else mensaje = `Receta emitida y guardada como plantilla «${r.datos.plantilla}».`;
  }
  revalidatePath(`/pacientes/${pacienteId}/documentos`);
  return { filas: {}, general: null, mensaje, exitos: previo.exitos + 1, emitida: String(data) };
}

// ---------------------------------------------------------------------------
// Constancia de atención o certificado de descanso
// ---------------------------------------------------------------------------
export type EstadoConstancia = {
  errores: Partial<Record<string, string>>; mensaje: string | null; exitos: number; valores: Record<string, string>;
};
const CAMPOS_CONSTANCIA = ["tipo", "fecha_atencion", "hora_inicio", "hora_fin", "descanso_desde", "descanso_dias", "cie10",
  "observaciones"];

export async function emitirConstancia(previo: EstadoConstancia, form: FormData): Promise<EstadoConstancia> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const valores = Object.fromEntries(CAMPOS_CONSTANCIA.map((c) => [c, String(form.get(c) ?? "")]));
  const fallo = (errores: EstadoConstancia["errores"]): EstadoConstancia =>
    ({ errores, mensaje: null, exitos: previo.exitos, valores });
  const d = await dentista(pacienteId);
  if (d.error !== null) return fallo({ general: d.error });
  const supabase = await createClient();
  const { data: catalogo } = await supabase.from("catalogo_cie10").select("codigo").returns<{ codigo: string }[]>();
  const r = validarConstancia((c) => valores[c] ?? "", fechaLima(new Date()), new Set((catalogo ?? []).map((c) => c.codigo)));
  if (!r.ok) return fallo(r.errores);
  const { error } = await supabase.from("constancia").insert({
    ...r.datos, clinica_id: d.sesion.clinicaId, paciente_id: pacienteId, profesional_id: d.sesion.usuarioId,
  });
  if (error) return fallo({ general: mensajeDeError(error, "constancia.emitir", "emitir el documento") });
  revalidatePath(`/pacientes/${pacienteId}/documentos`);
  return { errores: {}, mensaje: "Documento emitido: ábrelo para imprimirlo.", exitos: previo.exitos + 1, valores: {} };
}

// ---------------------------------------------------------------------------
// Anular (receta o constancia) y desactivar plantilla
// ---------------------------------------------------------------------------
export type EstadoSimple = { error: string | null; intento: number };

export async function anularDocumento(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const id = String(form.get("id") ?? "");
  const tabla = String(form.get("tabla") ?? "");
  const motivo = String(form.get("motivo") ?? "");
  const intento = previo.intento + 1;
  const d = await dentista(pacienteId);
  if (d.error !== null) return { error: d.error, intento };
  if (!UUID.test(id) || (tabla !== "receta" && tabla !== "constancia")) return { error: "Documento inválido.", intento };
  const problema = validarMotivo(motivo, 200);
  if (problema) return { error: problema, intento };
  const supabase = await createClient();
  const { data, error } = await supabase.from(tabla)
    .update({ anulado_at: new Date().toISOString(), anulado_por: d.sesion.usuarioId, motivo_anulacion: motivo.trim() })
    .eq("id", id).eq("paciente_id", pacienteId).is("anulado_at", null).select("id").maybeSingle();
  if (error || !data) {
    if (error) return { error: mensajeDeError(error, "documento.anular", "anular el documento"), intento };
    return { error: "No se pudo anular. Recarga la página.", intento };
  }
  revalidatePath(`/pacientes/${pacienteId}/documentos`);
  return { error: null, intento };
}

export async function desactivarPlantillaReceta(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const id = String(form.get("id") ?? "");
  const intento = previo.intento + 1;
  const d = await dentista(pacienteId);
  if (d.error !== null) return { error: d.error, intento };
  if (!UUID.test(id)) return { error: "Plantilla inválida.", intento };
  const supabase = await createClient();
  const { data, error } = await supabase.from("plantilla_receta").update({ activa: false }).eq("id", id)
    .select("id").maybeSingle();
  if (error) return { error: mensajeDeError(error, "receta.plantilla_desactivar", "quitar la plantilla"), intento };
  if (!data) return { error: "Plantilla no encontrada. Recarga la página.", intento };
  revalidatePath(`/pacientes/${pacienteId}/documentos`);
  return { error: null, intento };
}

