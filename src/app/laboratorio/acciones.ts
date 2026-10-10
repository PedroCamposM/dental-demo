"use server";

import { revalidatePath } from "next/cache";
import { validarEnvio, validarOrden, validarRecepcion } from "@/lib/clinico/laboratorio";
import { fechaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion, type Sesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EstadoOrden = { error: string | null; mensaje: string | null; exitos: number };

async function clinico(): Promise<{ error: string } | { error: null; sesion: Sesion }> {
  if (!modulos.etapa10) return { error: "Este módulo aún no está habilitado." };
  const sesion = await obtenerSesion();
  if (!sesion?.veClinico) return { error: "El laboratorio lo registran el cirujano dentista o la asistente." };
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

function revalidar(pacienteId: string) {
  if (UUID.test(pacienteId)) revalidatePath(`/pacientes/${pacienteId}/laboratorio`);
  revalidatePath("/laboratorio");
  revalidatePath("/clinico");
}

/** Nueva orden (la prescribe el cirujano dentista; la base lo exige). */
export async function crearOrden(previo: EstadoOrden, form: FormData): Promise<EstadoOrden> {
  const fallo = (error: string): EstadoOrden => ({ error, mensaje: null, exitos: previo.exitos });
  const c = await clinico();
  if (c.error !== null) return fallo(c.error);
  if (!c.sesion.esDentista) return fallo("La orden de laboratorio la prescribe el cirujano dentista.");
  const pacienteId = String(form.get("paciente_id") ?? "");
  const item = String(form.get("item_plan_id") ?? "");
  const lab = String(form.get("laboratorio_id") ?? "");
  if (!UUID.test(pacienteId)) return fallo("Paciente inválido.");
  if (!UUID.test(item)) return fallo("Elige el ítem del plan.");
  if (!UUID.test(lab)) return fallo("Elige el laboratorio.");
  const r = validarOrden((k) => String(form.get(k) ?? ""));
  if (!r.ok) return fallo(r.error);
  const supabase = await createClient();
  const { error } = await supabase.from("orden_laboratorio").insert({
    clinica_id: c.sesion.clinicaId, item_plan_id: item, laboratorio_id: lab, ...r.datos,
  });
  if (error) return fallo(mensajeDeError(error, "laboratorio.orden", "registrar la orden"));
  revalidar(pacienteId);
  return { error: null, mensaje: "Orden registrada: por enviar.", exitos: previo.exitos + 1 };
}

export async function enviarOrden(previo: EstadoOrden, form: FormData): Promise<EstadoOrden> {
  const fallo = (error: string): EstadoOrden => ({ error, mensaje: null, exitos: previo.exitos });
  const c = await clinico();
  if (c.error !== null) return fallo(c.error);
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return fallo("Orden inválida.");
  const r = validarEnvio((k) => String(form.get(k) ?? ""), fechaLima(new Date()));
  if (!r.ok) return fallo(r.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("enviar_orden_laboratorio", { id_orden: id, envio: r.envio, entrega_prevista: r.entrega });
  if (error) return fallo(mensajeDeError(error, "laboratorio.enviar", "registrar el envío"));
  revalidar(String(form.get("paciente_id") ?? ""));
  return { error: null, mensaje: "Guardado.", exitos: previo.exitos + 1 };
}

export async function recibirOrden(previo: EstadoOrden, form: FormData): Promise<EstadoOrden> {
  const fallo = (error: string): EstadoOrden => ({ error, mensaje: null, exitos: previo.exitos });
  const c = await clinico();
  if (c.error !== null) return fallo(c.error);
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return fallo("Orden inválida.");
  const envio = String(form.get("envio") ?? "") || null;
  const r = validarRecepcion((k) => String(form.get(k) ?? ""), fechaLima(new Date()), envio);
  if (!r.ok) return fallo(r.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("recibir_orden_laboratorio", { id_orden: id, recepcion: r.recepcion, costo: r.costo_centimos });
  if (error) return fallo(mensajeDeError(error, "laboratorio.recibir", "registrar la recepción"));
  revalidar(String(form.get("paciente_id") ?? ""));
  return { error: null, mensaje: "Recibida.", exitos: previo.exitos + 1 };
}

export async function cancelarOrden(previo: EstadoOrden, form: FormData): Promise<EstadoOrden> {
  const fallo = (error: string): EstadoOrden => ({ error, mensaje: null, exitos: previo.exitos });
  const c = await clinico();
  if (c.error !== null) return fallo(c.error);
  const id = String(form.get("id") ?? "");
  const motivo = String(form.get("motivo") ?? "").trim();
  if (!UUID.test(id)) return fallo("Orden inválida.");
  if (motivo.length < 5) return fallo("Escribe el motivo (al menos 5 caracteres).");
  if (motivo.length > 300) return fallo("Motivo: máximo 300 caracteres.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancelar_orden_laboratorio", { id_orden: id, motivo });
  if (error) return fallo(mensajeDeError(error, "laboratorio.cancelar", "cancelar la orden"));
  revalidar(String(form.get("paciente_id") ?? ""));
  return { error: null, mensaje: "Cancelada.", exitos: previo.exitos + 1 };
}
