"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { modulos } from "@/lib/funciones";
import {
  DENTICIONES, TIPOS_ODONTOGRAMA, validarHallazgos, type CampoHallazgo, type Denticion, type ItemCatalogo,
} from "@/lib/odontograma/hallazgo";
import { registrarError } from "@/lib/registro";
import { obtenerSesion, type Sesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function dentista(pacienteId: string): Promise<{ error: string } | { error: null; sesion: Sesion }> {
  if (!modulos.etapa4) return { error: "Este módulo aún no está habilitado." };
  if (!UUID.test(pacienteId)) return { error: "Paciente inválido." };
  const sesion = await obtenerSesion();
  if (!sesion?.esDentista) return { error: "Solo el cirujano dentista registra el odontograma." };
  return { error: null, sesion };
}

// ---------------------------------------------------------------------------
// Nuevo odontograma (inicial, de evolución o de alta)
// ---------------------------------------------------------------------------
export type EstadoNuevo = { error: string | null; valores: Record<string, string> };

export async function crearOdontograma(_previo: EstadoNuevo, form: FormData): Promise<EstadoNuevo> {
  const valores = Object.fromEntries(["tipo", "denticion", "especificaciones", "observaciones", "copiar_de"]
    .map((c) => [c, String(form.get(c) ?? "")]));
  const pacienteId = String(form.get("paciente_id") ?? "");
  const fallo = (error: string): EstadoNuevo => ({ error, valores });
  const d = await dentista(pacienteId);
  if (d.error !== null) return fallo(d.error);
  if (!Object.hasOwn(TIPOS_ODONTOGRAMA, valores.tipo!)) return fallo("Elige el tipo de odontograma.");
  if (!Object.hasOwn(DENTICIONES, valores.denticion!)) return fallo("Elige la dentición.");
  const especificaciones = valores.especificaciones!.trim() || null;
  const observaciones = valores.observaciones!.trim() || null;
  if ((especificaciones?.length ?? 0) > 1000 || (observaciones?.length ?? 0) > 1000) {
    return fallo("Especificaciones y observaciones: máximo 1000 caracteres cada una.");
  }
  const copiarDe = valores.copiar_de || null;
  if (copiarDe && !UUID.test(copiarDe)) return fallo("Odontograma de origen inválido.");

  const supabase = await createClient();
  const { data: nuevo, error } = await supabase.from("odontograma").insert({
    clinica_id: d.sesion.clinicaId, paciente_id: pacienteId, tipo: valores.tipo, denticion: valores.denticion,
    odontologo_id: d.sesion.usuarioId, especificaciones, observaciones,
  }).select("id").single<{ id: string }>();
  if (error || !nuevo) {
    if (error) registrarError("odontograma.crear", error, { paciente: pacienteId });
    return fallo("No se pudo crear el odontograma. Inténtalo de nuevo.");
  }

  // Parte del estado anterior: se copian sus hallazgos vigentes (el anterior no cambia).
  if (copiarDe) {
    const { data: previos, error: errorPrevios } = await supabase.from("odontograma_hallazgo")
      .select("hallazgo_codigo, pieza, pieza_hasta, arcada, superficies, siglas, estado, grado, especificacion, cie10, "
        + "odontograma!inner(paciente_id)")
      .eq("odontograma_id", copiarDe).eq("odontograma.paciente_id", pacienteId).is("anulado_at", null)
      .returns<Record<string, unknown>[]>();
    // Fila por fila: si un hallazgo antiguo ya no cumple (otra dentición, reglas nuevas), los demás se copian igual.
    let fallidos = errorPrevios ? 1 : 0;
    if (errorPrevios) registrarError("odontograma.copiar", errorPrevios, { paciente: pacienteId });
    for (const h of previos ?? []) {
      const { odontograma: _origen, ...copia } = h;
      void _origen;
      const { error: e } = await supabase.from("odontograma_hallazgo")
        .insert({ ...copia, clinica_id: d.sesion.clinicaId, odontograma_id: nuevo.id });
      if (e) {
        fallidos++;
        if (e.code !== "P0001") registrarError("odontograma.copiar", e, { paciente: pacienteId });
      }
    }
    if (fallidos > 0) {
      revalidatePath(`/pacientes/${pacienteId}/odontograma`);
      redirect(`/pacientes/${pacienteId}/odontograma?o=${nuevo.id}&aviso=copia`);
    }
  }
  revalidatePath(`/pacientes/${pacienteId}/odontograma`);
  redirect(`/pacientes/${pacienteId}/odontograma?o=${nuevo.id}`);
}

// ---------------------------------------------------------------------------
// Hallazgos
// ---------------------------------------------------------------------------
export type EstadoHallazgo = {
  errores: Partial<Record<CampoHallazgo | "general", string>>; mensaje: string | null; intento: number;
  valores: { textos: Record<string, string>; superficies: string[]; siglas: string[] };
};

export async function agregarHallazgo(previo: EstadoHallazgo, form: FormData): Promise<EstadoHallazgo> {
  const intento = previo.intento + 1;
  const valores = {
    textos: Object.fromEntries(["hallazgo_codigo", "pieza", "pieza_hasta", "arcada", "estado", "grado", "especificacion"]
      .map((c) => [c, String(form.get(c) ?? "")])),
    superficies: form.getAll("superficies").map(String),
    siglas: form.getAll("siglas").map(String),
  };
  const fallo = (errores: EstadoHallazgo["errores"]): EstadoHallazgo => ({ errores, mensaje: null, intento, valores });
  const pacienteId = String(form.get("paciente_id") ?? "");
  const odontogramaId = String(form.get("odontograma_id") ?? "");
  const d = await dentista(pacienteId);
  if (d.error !== null) return fallo({ general: d.error });
  if (!UUID.test(odontogramaId)) return fallo({ general: "Odontograma inválido." });

  const supabase = await createClient();
  const [{ data: catalogo, error: errorCatalogo }, { data: odontograma }] = await Promise.all([
    supabase.from("catalogo_hallazgo").select("*").returns<ItemCatalogo[]>(),
    supabase.from("odontograma").select("denticion").eq("id", odontogramaId).eq("paciente_id", pacienteId)
      .maybeSingle<{ denticion: Denticion }>(),
  ]);
  if (errorCatalogo || !catalogo) {
    if (errorCatalogo) registrarError("odontograma.catalogo", errorCatalogo);
    return fallo({ general: "No se pudo cargar el catálogo de hallazgos. Inténtalo de nuevo." });
  }
  if (!odontograma) return fallo({ general: "Odontograma no encontrado. Recarga la página." });
  const r = validarHallazgos(
    { texto: (c) => valores.textos[c] ?? "", lista: (c) => (c === "siglas" ? valores.siglas : valores.superficies) },
    catalogo, odontograma.denticion,
  );
  if (!r.ok) return fallo(r.errores);

  // Un solo envío: o se guardan todas las piezas o ninguna.
  const { error } = await supabase.from("odontograma_hallazgo").insert(
    r.datos.map((h) => ({ ...h, clinica_id: d.sesion.clinicaId, odontograma_id: odontogramaId })),
  );
  if (error) {
    if (error.code === "42501") return fallo({ general: "Solo quien firmó este odontograma le agrega hallazgos. Crea uno de evolución." });
    if (error.code === "P0001") return fallo({ general: error.message });
    registrarError("odontograma.hallazgo", error, { odontograma: odontogramaId });
    return fallo({ general: "No se pudo guardar el hallazgo. Inténtalo de nuevo." });
  }
  revalidatePath(`/pacientes/${pacienteId}/odontograma`);
  const nombre = catalogo.find((c) => c.codigo === r.datos[0]?.hallazgo_codigo)?.nombre ?? "Hallazgo";
  const mensaje = r.datos.length > 1
    ? `${r.datos.length} hallazgos registrados: ${nombre} en las piezas ${r.datos.map((h) => h.pieza).join(", ")}.`
    : `Hallazgo registrado: ${nombre}.`;
  // Se conserva el hallazgo elegido: lo usual es seguir marcando el mismo en otras piezas.
  return { errores: {}, mensaje, intento, valores: { textos: { hallazgo_codigo: valores.textos.hallazgo_codigo ?? "" }, superficies: [], siglas: [] } };
}

/** `intento` cambia en cada envío (remonta el formulario); `texto` conserva el motivo si hubo error. */
export type EstadoAnular = { error: string | null; intento: number; texto: string };

export async function anularHallazgo(previo: EstadoAnular, form: FormData): Promise<EstadoAnular> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const id = String(form.get("id") ?? "");
  const motivo = String(form.get("motivo") ?? "").trim();
  const intento = previo.intento + 1;
  const fallo = (error: string): EstadoAnular => ({ error, intento, texto: motivo });
  const d = await dentista(pacienteId);
  if (d.error !== null) return fallo(d.error);
  if (!UUID.test(id)) return fallo("Hallazgo inválido.");
  if (motivo.length < 3) return fallo("Escribe por qué se anula.");
  const supabase = await createClient();
  // Solo hallazgos de odontogramas de este paciente; RLS exige además que lo firmara quien anula.
  const { data: odontogramas } = await supabase.from("odontograma").select("id").eq("paciente_id", pacienteId)
    .returns<{ id: string }[]>();
  const { data, error } = await supabase.from("odontograma_hallazgo")
    .update({ anulado_at: new Date().toISOString(), anulado_por: d.sesion.usuarioId, motivo_anulacion: motivo })
    .eq("id", id).is("anulado_at", null).in("odontograma_id", (odontogramas ?? []).map((o) => o.id))
    .select("id").maybeSingle();
  if (error || !data) {
    if (error) registrarError("odontograma.anular", error, { id });
    return fallo("No se pudo anular el hallazgo: solo lo anula quien firmó el odontograma. Recarga la página.");
  }
  revalidatePath(`/pacientes/${pacienteId}/odontograma`);
  return { error: null, intento, texto: "" };
}
