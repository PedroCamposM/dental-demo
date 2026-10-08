import "server-only";
import { notFound, redirect } from "next/navigation";
import { fechaLima } from "@/lib/fechas";
import type { Embarazo, Enfermedad, Habito } from "@/lib/historia/cuestionario";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion, type Sesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PacienteClinico = {
  id: string; nombres: string; apellidos: string; sexo: string | null; fecha_nacimiento: string | null;
  anulado_at: string | null;
};

/** Mujer de 12 años o más: el cuestionario pregunta por embarazo y lactancia. */
export function puedeGestar(p: PacienteClinico): boolean {
  // Sin sexo registrado se pregunta igual (no se descarta un embarazo por falta de dato).
  if (p.sexo === "masculino") return false;
  if (!p.fecha_nacimiento) return true;
  const hoy = fechaLima(new Date());
  const [a, m, d] = p.fecha_nacimiento.split("-").map(Number) as [number, number, number];
  const [ah, mh, dh] = hoy.split("-").map(Number) as [number, number, number];
  const edad = ah - a - (mh < m || (mh === m && dh < d) ? 1 : 0);
  return edad >= 12;
}

/** Páginas de la historia: módulo encendido, rol clínico (RLS lo exige igual) y paciente de la clínica. */
export async function abrirHistoria(id: string): Promise<{ sesion: Sesion; paciente: PacienteClinico }> {
  if (!modulos.etapa3 || !UUID.test(id)) notFound();
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/");
  if (!sesion.veClinico) redirect(`/pacientes/${id}`);
  const supabase = await createClient();
  const { data, error } = await supabase.from("paciente")
    .select("id, nombres, apellidos, sexo, fecha_nacimiento, anulado_at").eq("id", id).maybeSingle<PacienteClinico>();
  if (error) registrarError("historia.paciente", error, { paciente: id });
  if (!data) notFound();
  // Todo acceso a la historia (también signos y el formulario) queda en la auditoría.
  const lectura = await supabase.rpc("registrar_lectura_historia", { id_paciente: id });
  if (lectura.error) {
    registrarError("historia.lectura", lectura.error, { paciente: id });
    throw new Error("No se pudo registrar el acceso a la historia clínica");
  }
  return { sesion, paciente: data };
}

export type Version = {
  id: string; version: number; registrado_at: string; registrado_por: string | null;
  motivo_consulta: string; enfermedad_actual: string | null; enfermedades: Enfermedad[]; enfermedades_otras: string | null;
  cirugias: string | null; hospitalizaciones: string | null; medicacion: string | null; anticoagulado: boolean;
  anticoagulante: string | null; alergias: string[]; embarazo: Embarazo; semanas_gestacion: number | null;
  lactancia: boolean; habitos: Habito[]; habitos_otros: string | null; antecedentes_odontologicos: string | null;
  observaciones: string | null;
};

export const COLUMNAS_VERSION = "id, version, registrado_at, registrado_por, motivo_consulta, enfermedad_actual, enfermedades, "
  + "enfermedades_otras, cirugias, hospitalizaciones, medicacion, anticoagulado, anticoagulante, alergias, embarazo, "
  + "semanas_gestacion, lactancia, habitos, habitos_otros, antecedentes_odontologicos, observaciones";
