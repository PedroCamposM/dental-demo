"use server";

import { revalidatePath } from "next/cache";
import { fechaLima } from "@/lib/fechas";
import { veGestion } from "@/lib/permisos";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import type { Destino, TipoSeguimiento } from "@/lib/tablero/mensajes";

const TIPOS: TipoSeguimiento[] = ["presupuesto", "tratamiento_detenido", "cuota_vencida", "control", "no_show"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResultadoEnvio = { ok: true } | { ok: false; error: string };

/** Registra en `seguimiento` el mensaje que se abrió en WhatsApp. */
export async function registrarMensaje(
  destino: Destino, plantillaId: string | null, texto: string,
): Promise<ResultadoEnvio> {
  const sesion = await obtenerSesion();
  if (!sesion) return { ok: false, error: "Tu usuario no tiene acceso a una clínica." };
  if (!veGestion(sesion.rol)) return { ok: false, error: "Tu rol no registra mensajes de seguimiento." };

  const ids = [destino.pacienteId, destino.planId, destino.cuotaId, plantillaId].filter((x) => x !== null);
  if (!TIPOS.includes(destino.tipo) || !ids.every((x) => UUID.test(x)) || !texto.trim()) {
    return { ok: false, error: "Datos del mensaje inválidos." };
  }

  const supabase = await createClient();
  const ahora = new Date();
  const { error } = await supabase.from("seguimiento").insert({
    clinica_id: sesion.clinicaId,
    paciente_id: destino.pacienteId,
    plan_id: destino.planId,
    cuota_id: destino.cuotaId,
    tipo: destino.tipo,
    fecha_programada: fechaLima(ahora),
    resultado: "mensaje_enviado",
    plantilla_id: plantillaId,
    mensaje_enviado: texto.trim(),
    realizado_at: ahora.toISOString(),
    realizado_por: sesion.usuarioId,
  });
  if (error) return { ok: false, error: "No se pudo registrar el envío. Inténtalo de nuevo." };

  revalidatePath("/", "layout");
  return { ok: true };
}
