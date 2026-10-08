import "server-only";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { describirAlertas, type Alertas } from "./cuestionario";

export type AlertasPaciente = { registrada: boolean; frases: string[] };

type Fila = Alertas & { paciente_id: string };

/**
 * Alertas de varios pacientes (versión vigente de su historia). Las ve todo el
 * equipo, también recepción: la función de la base solo devuelve estos datos.
 */
export async function cargarAlertas(pacientes: string[]): Promise<Map<string, AlertasPaciente>> {
  const resultado = new Map<string, AlertasPaciente>();
  if (!modulos.etapa3 || pacientes.length === 0) return resultado;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("alertas_pacientes", { pacientes: [...new Set(pacientes)] });
  if (error) {
    registrarError("historia.alertas", error);
    return resultado;
  }
  for (const fila of (data ?? []) as Fila[]) {
    resultado.set(fila.paciente_id, { registrada: true, frases: describirAlertas(fila) });
  }
  return resultado;
}
