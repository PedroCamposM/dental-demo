"use server";

import { revalidatePath } from "next/cache";
import {
  CAMPOS_TEXTO_EXAMEN, codigosElegibles, validarDiagnostico, validarExamen,
  type CampoDiagnostico, type CampoExamen, type CodigoCie10,
} from "@/lib/clinico/diagnostico";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion, type Sesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sesión de un cirujano dentista con el módulo encendido; si no, el mensaje para el usuario. */
async function dentista(pacienteId: string): Promise<{ error: string } | { error: null; sesion: Sesion }> {
  if (!modulos.etapa4) return { error: "Este módulo aún no está habilitado." };
  if (!UUID.test(pacienteId)) return { error: "Paciente inválido." };
  const sesion = await obtenerSesion();
  if (!sesion?.esDentista) return { error: "Solo el cirujano dentista registra el examen y el diagnóstico." };
  return { error: null, sesion };
}

function mensajeDeError(error: { code?: string; message: string }, contexto: string, que: string): string {
  if (error.code === "P0001" && error.message.includes("anulado")) {
    return "Este paciente está anulado o fusionado: regístralo en el paciente vigente.";
  }
  if (error.code === "P0001") return error.message;
  registrarError(contexto, error);
  return `No se pudo guardar ${que}. Inténtalo de nuevo.`;
}

// ---------------------------------------------------------------------------
// Examen clínico
// ---------------------------------------------------------------------------
export type EstadoExamen = {
  errores: Partial<Record<CampoExamen | "general", string>>; mensaje: string | null; valores: Record<string, string>;
};

export async function registrarExamen(_previo: EstadoExamen, form: FormData): Promise<EstadoExamen> {
  const valores = Object.fromEntries([...CAMPOS_TEXTO_EXAMEN, "higiene"].map((c) => [c, String(form.get(c) ?? "")]));
  const fallo = (errores: EstadoExamen["errores"]): EstadoExamen => ({ errores, mensaje: null, valores });
  const pacienteId = String(form.get("paciente_id") ?? "");
  const d = await dentista(pacienteId);
  if (d.error !== null) return fallo({ general: d.error });

  const r = validarExamen((c) => valores[c] ?? "");
  if (!r.ok) return fallo(r.errores);
  const supabase = await createClient();
  const { error } = await supabase.from("examen_clinico").insert({
    ...r.datos, clinica_id: d.sesion.clinicaId, paciente_id: pacienteId, registrado_por: d.sesion.usuarioId,
  });
  if (error) return fallo({ general: mensajeDeError(error, "examen.registrar", "el examen") });
  revalidatePath(`/pacientes/${pacienteId}/examen`);
  return { errores: {}, mensaje: "Examen clínico registrado.", valores: {} };
}

// ---------------------------------------------------------------------------
// Diagnóstico
// ---------------------------------------------------------------------------
export type EstadoDiagnostico = {
  errores: Partial<Record<CampoDiagnostico | "general", string>>; mensaje: string | null;
  valores: { textos: Record<string, string>; superficies: string[] };
};

export async function registrarDiagnostico(_previo: EstadoDiagnostico, form: FormData): Promise<EstadoDiagnostico> {
  const valores = {
    textos: Object.fromEntries(["cie10", "tipo", "pieza", "observacion", "hallazgo_id", "confirma_id"]
      .map((c) => [c, String(form.get(c) ?? "")])),
    superficies: form.getAll("superficies").map(String),
  };
  const fallo = (errores: EstadoDiagnostico["errores"]): EstadoDiagnostico => ({ errores, mensaje: null, valores });
  const pacienteId = String(form.get("paciente_id") ?? "");
  const d = await dentista(pacienteId);
  if (d.error !== null) return fallo({ general: d.error });
  const hallazgoId = valores.textos.hallazgo_id || null;
  const confirmaId = valores.textos.confirma_id || null;
  if ((hallazgoId && !UUID.test(hallazgoId)) || (confirmaId && !UUID.test(confirmaId))) {
    return fallo({ general: "Referencia inválida. Recarga la página." });
  }

  const supabase = await createClient();
  const { data: catalogo, error: errorCatalogo } = await supabase.from("catalogo_cie10")
    .select("codigo, descripcion, es_categoria").returns<CodigoCie10[]>();
  if (errorCatalogo || !catalogo) {
    if (errorCatalogo) registrarError("diagnostico.catalogo", errorCatalogo);
    return fallo({ general: "No se pudo cargar el catálogo CIE-10. Inténtalo de nuevo." });
  }
  const r = validarDiagnostico(
    { texto: (c) => valores.textos[c] ?? "", lista: () => valores.superficies },
    new Set(codigosElegibles(catalogo).map((c) => c.codigo)),
  );
  if (!r.ok) return fallo(r.errores);
  if (confirmaId && r.datos.tipo !== "definitivo") return fallo({ tipo: "Al confirmar, el diagnóstico es definitivo." });

  const { error } = await supabase.from("diagnostico").insert({
    ...r.datos, clinica_id: d.sesion.clinicaId, paciente_id: pacienteId, registrado_por: d.sesion.usuarioId,
    hallazgo_id: hallazgoId, confirma_id: confirmaId,
  });
  if (error) return fallo({ general: mensajeDeError(error, "diagnostico.registrar", "el diagnóstico") });
  revalidatePath(`/pacientes/${pacienteId}/examen`);
  return { errores: {}, mensaje: `Diagnóstico ${r.datos.cie10} registrado.`, valores: { textos: {}, superficies: [] } };
}

// ---------------------------------------------------------------------------
// Adenda y anulación
// ---------------------------------------------------------------------------
export type EstadoSimple = { error: string | null; ok: boolean };

export async function agregarAdenda(_previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const diagnosticoId = String(form.get("diagnostico_id") ?? "");
  const texto = String(form.get("texto") ?? "").trim();
  const d = await dentista(pacienteId);
  if (d.error !== null) return { error: d.error, ok: false };
  if (!UUID.test(diagnosticoId)) return { error: "Diagnóstico inválido.", ok: false };
  if (texto.length < 3) return { error: "Escribe la adenda.", ok: false };
  if (texto.length > 2000) return { error: "Máximo 2000 caracteres.", ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("diagnostico_adenda").insert({
    clinica_id: d.sesion.clinicaId, diagnostico_id: diagnosticoId, texto, registrado_por: d.sesion.usuarioId,
  });
  if (error) return { error: mensajeDeError(error, "diagnostico.adenda", "la adenda"), ok: false };
  revalidatePath(`/pacientes/${pacienteId}/examen`);
  return { error: null, ok: true };
}

export async function anularRegistro(_previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const id = String(form.get("id") ?? "");
  const tabla = String(form.get("tabla") ?? "");
  const motivo = String(form.get("motivo") ?? "").trim();
  const d = await dentista(pacienteId);
  if (d.error !== null) return { error: d.error, ok: false };
  if (!UUID.test(id) || (tabla !== "diagnostico" && tabla !== "examen_clinico")) return { error: "Registro inválido.", ok: false };
  if (motivo.length < 3) return { error: "Escribe por qué se anula.", ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase.from(tabla)
    .update({ anulado_at: new Date().toISOString(), anulado_por: d.sesion.usuarioId, motivo_anulacion: motivo })
    .eq("id", id).eq("paciente_id", pacienteId).is("anulado_at", null).select("id").maybeSingle();
  if (error || !data) {
    if (error) registrarError("examen.anular", error, { id, tabla });
    return { error: "No se pudo anular el registro. Recarga la página.", ok: false };
  }
  revalidatePath(`/pacientes/${pacienteId}/examen`);
  return { error: null, ok: true };
}
