"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validarCuestionario, type CampoCuestionario } from "@/lib/historia/cuestionario";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { puedeGestar, type PacienteClinico } from "../datos-clinicos";

export type ValoresCuestionario = { textos: Record<string, string>; listas: Record<string, string[]> };
export type EstadoCuestionario = {
  errores: Partial<Record<CampoCuestionario, string>>; general: string | null; valores: ValoresCuestionario | null;
};

const TEXTOS = ["motivo_consulta", "enfermedad_actual", "enfermedades_otras", "cirugias", "hospitalizaciones", "medicacion",
  "anticoagulado", "anticoagulante", "alergias", "embarazo", "semanas_gestacion", "lactancia", "habitos_otros",
  "antecedentes_odontologicos", "observaciones"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Registra una versión nueva del cuestionario (la anterior se conserva). */
export async function guardarCuestionario(_previo: EstadoCuestionario, form: FormData): Promise<EstadoCuestionario> {
  const valores: ValoresCuestionario = {
    textos: Object.fromEntries(TEXTOS.map((c) => [c, String(form.get(c) ?? "")])),
    listas: { enfermedades: form.getAll("enfermedades").map(String), habitos: form.getAll("habitos").map(String) },
  };
  const fallo = (general: string | null, errores: EstadoCuestionario["errores"] = {}) => ({ errores, general, valores });
  const pacienteId = String(form.get("paciente_id") ?? "");
  if (!modulos.etapa3) return fallo("Este módulo aún no está habilitado.");
  if (!UUID.test(pacienteId)) return fallo("Paciente inválido.");
  const sesion = await obtenerSesion();
  if (!sesion?.esDentista) return fallo("La historia clínica la registra el odontólogo.");

  const supabase = await createClient();
  const { data: paciente } = await supabase.from("paciente")
    .select("id, nombres, apellidos, sexo, fecha_nacimiento, anulado_at").eq("id", pacienteId)
    .maybeSingle<PacienteClinico>();
  if (!paciente) return fallo("Paciente no encontrado.");

  const r = validarCuestionario(
    { texto: (c) => valores.textos[c] ?? "", lista: (c) => valores.listas[c] ?? [] }, puedeGestar(paciente),
  );
  if (!r.ok) return fallo("Revisa los campos marcados.", r.errores);

  const { error } = await supabase.from("cuestionario_salud").insert({
    ...r.datos, clinica_id: sesion.clinicaId, paciente_id: pacienteId, registrado_por: sesion.usuarioId,
  });
  if (error) {
    if (error.code === "P0001" && error.message.includes("anulado")) {
      return fallo("Este paciente está anulado o fusionado: registra la historia en el registro vigente.");
    }
    registrarError("historia.guardar", error, { paciente: pacienteId });
    return fallo("No se pudo guardar la historia. Inténtalo de nuevo.");
  }
  revalidatePath(`/pacientes/${pacienteId}`, "layout");
  redirect(`/pacientes/${pacienteId}/historia?guardada=1`);
}
