import "server-only";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { describirAlertas, type Alertas } from "./cuestionario";

export type AlertasPaciente = { frases: string[]; registradaEl: string };
export type ResultadoAlertas = { error: boolean; porPaciente: Map<string, AlertasPaciente> };

type Fila = Alertas & { paciente_id: string; actualizado_at: string };

/**
 * Alertas de varios pacientes (versión vigente de su historia). Las ve todo el
 * equipo, también recepción: la función de la base solo devuelve estos datos.
 * Si no se pueden cargar, lo dice (`error`): nunca se muestra «sin alertas» por un fallo.
 */
export async function cargarAlertas(pacientes: string[]): Promise<ResultadoAlertas> {
  const porPaciente = new Map<string, AlertasPaciente>();
  if (!modulos.etapa3 || pacientes.length === 0) return { error: false, porPaciente };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("alertas_pacientes", { pacientes: [...new Set(pacientes)] });
  if (error) {
    registrarError("historia.alertas", error);
    return { error: true, porPaciente };
  }
  for (const fila of (data ?? []) as Fila[]) {
    porPaciente.set(fila.paciente_id, { frases: describirAlertas(fila), registradaEl: fila.actualizado_at });
  }
  return { error: false, porPaciente };
}
