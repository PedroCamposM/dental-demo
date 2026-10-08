"use server";

import { revalidatePath } from "next/cache";
import { validarSignos, type CampoSignos } from "@/lib/historia/cuestionario";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAMPOS: CampoSignos[] = ["presion_sistolica", "presion_diastolica", "frecuencia_cardiaca", "frecuencia_respiratoria",
  "temperatura_c", "peso_kg", "talla_cm"];

export type EstadoSignos = {
  errores: Partial<Record<CampoSignos | "general", string>>; mensaje: string | null; valores: Record<string, string>;
};

export async function registrarSignos(_previo: EstadoSignos, form: FormData): Promise<EstadoSignos> {
  const valores = Object.fromEntries(CAMPOS.map((c) => [c, String(form.get(c) ?? "")]));
  const fallo = (errores: EstadoSignos["errores"]): EstadoSignos => ({ errores, mensaje: null, valores });
  const pacienteId = String(form.get("paciente_id") ?? "");
  if (!modulos.etapa3) return fallo({ general: "Este módulo aún no está habilitado." });
  if (!UUID.test(pacienteId)) return fallo({ general: "Paciente inválido." });
  const sesion = await obtenerSesion();
  if (!sesion?.veClinico) return fallo({ general: "Tu rol no registra signos vitales." });

  const r = validarSignos((c) => valores[c] ?? "");
  if (!r.ok) return fallo(r.errores);
  const supabase = await createClient();
  const { error } = await supabase.from("signos_vitales").insert({
    ...r.datos, clinica_id: sesion.clinicaId, paciente_id: pacienteId, registrado_por: sesion.usuarioId,
  });
  if (error) {
    if (!(error.code === "P0001" && error.message.includes("anulado"))) registrarError("signos.registrar", error);
    return fallo({ general: error.message.includes("anulado")
      ? "Este paciente está anulado o fusionado: registra los signos en el registro vigente."
      : "No se pudieron guardar los signos vitales. Inténtalo de nuevo." });
  }
  revalidatePath(`/pacientes/${pacienteId}/signos`);
  return { errores: {}, mensaje: "Signos vitales registrados.", valores: {} };
}

export type EstadoAnulacion = { error: string | null };

export async function anularSignos(_previo: EstadoAnulacion, form: FormData): Promise<EstadoAnulacion> {
  const id = String(form.get("id") ?? "");
  const pacienteId = String(form.get("paciente_id") ?? "");
  const motivo = String(form.get("motivo") ?? "").trim();
  if (!modulos.etapa3) return { error: "Este módulo aún no está habilitado." };
  if (!UUID.test(id) || !UUID.test(pacienteId)) return { error: "Registro inválido." };
  if (motivo.length < 3) return { error: "Escribe por qué se anula." };
  const sesion = await obtenerSesion();
  if (!sesion?.veClinico) return { error: "Tu rol no anula signos vitales." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("signos_vitales")
    .update({ anulado_at: new Date().toISOString(), anulado_por: sesion.usuarioId, motivo_anulacion: motivo })
    .eq("id", id).is("anulado_at", null).select("id").maybeSingle();
  if (error || !data) {
    if (error) registrarError("signos.anular", error, { id });
    return { error: "No se pudo anular el registro. Recarga la página." };
  }
  revalidatePath(`/pacientes/${pacienteId}/signos`);
  return { error: null };
}
