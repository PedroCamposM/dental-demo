"use server";

import { redirect } from "next/navigation";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EstadoExportar = { error: string | null; motivo: string };

/** Registra la exportación (motivo y auditoría) y abre el documento para imprimir o guardar en PDF. */
export async function exportarHistoria(_previo: EstadoExportar, form: FormData): Promise<EstadoExportar> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const motivo = String(form.get("motivo") ?? "").trim();
  const fallo = (error: string): EstadoExportar => ({ error, motivo });
  if (!modulos.etapa11) return fallo("Este módulo aún no está habilitado.");
  const sesion = await obtenerSesion();
  if (!sesion?.esDentista) return fallo("La historia clínica completa la exporta el cirujano dentista.");
  if (!UUID.test(pacienteId)) return fallo("Paciente inválido.");
  if (motivo.length < 5) return fallo("Escribe el motivo de la exportación (al menos 5 caracteres).");
  if (motivo.length > 300) return fallo("Motivo: máximo 300 caracteres.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_exportacion", { id_paciente: pacienteId, motivo });
  if (error || typeof data !== "string") {
    if (error?.code === "P0001") return fallo(`${error.message}.`);
    if (error) registrarError("historia.exportar", error, { paciente: pacienteId });
    return fallo("No se pudo registrar la exportación. Inténtalo de nuevo.");
  }
  redirect(`/pacientes/${pacienteId}/exportar/${data}`);
}
