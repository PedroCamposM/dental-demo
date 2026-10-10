"use server";

import { revalidatePath } from "next/cache";
import { validarAjuste, validarCierre, validarPago } from "@/lib/caja";
import { validarMotivo } from "@/lib/clinico/consentimientos";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion, type Sesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export type EstadoCaja = { error: string | null; mensaje: string | null; exitos: number };

async function caja(): Promise<{ error: string } | { error: null; sesion: Sesion }> {
  if (!modulos.etapa8) return { error: "Este módulo aún no está habilitado." };
  const sesion = await obtenerSesion();
  if (!sesion || (sesion.rol !== "admin" && sesion.rol !== "recepcion")) {
    return { error: "Los pagos y la caja los maneja administración o recepción." };
  }
  return { error: null, sesion };
}

function mensajeDeError(error: { code?: string; message: string }, contexto: string, que: string): string {
  if (error.code === "P0001") return `${error.message}.`.replace(/\.\.$/, ".");
  registrarError(contexto, error);
  return `No se pudo ${que}. Inténtalo de nuevo.`;
}

const fallo = (previo: EstadoCaja, error: string): EstadoCaja => ({ error, mensaje: null, exitos: previo.exitos });

/** Registra un pago del plan (la base lo aplica a cuotas o ítems). */
export async function registrarPago(previo: EstadoCaja, form: FormData): Promise<EstadoCaja> {
  const c = await caja();
  if (c.error !== null) return fallo(previo, c.error);
  const planId = String(form.get("plan_id") ?? "");
  const pacienteId = String(form.get("paciente_id") ?? "");
  if (!UUID.test(planId) || !UUID.test(pacienteId)) return fallo(previo, "Plan inválido. Recarga la página.");
  const r = validarPago((k) => String(form.get(k) ?? ""));
  if (!r.ok) return fallo(previo, r.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_pago", {
    id_plan: planId, monto: r.datos.monto, metodo: r.datos.metodo, referencia: r.datos.referencia,
  });
  if (error) return fallo(previo, mensajeDeError(error, "pago.registrar", "registrar el pago"));
  revalidatePath(`/pacientes/${pacienteId}/plan`);
  revalidatePath("/caja");
  return { error: null, mensaje: "Pago registrado.", exitos: previo.exitos + 1 };
}

export async function anularPago(previo: EstadoCaja, form: FormData): Promise<EstadoCaja> {
  const c = await caja();
  if (c.error !== null) return fallo(previo, c.error);
  const id = String(form.get("id") ?? "");
  const pacienteId = String(form.get("paciente_id") ?? "");
  const motivo = String(form.get("motivo") ?? "");
  if (!UUID.test(id)) return fallo(previo, "Pago inválido.");
  const problema = validarMotivo(motivo, 200);
  if (problema) return fallo(previo, problema);
  const supabase = await createClient();
  const { data, error } = await supabase.from("pago")
    .update({ anulado_at: new Date().toISOString(), anulado_por: c.sesion.usuarioId, motivo_anulacion: motivo.trim() })
    .eq("id", id).is("anulado_at", null).select("id").maybeSingle();
  if (error) return fallo(previo, mensajeDeError(error, "pago.anular", "anular el pago"));
  if (!data) return fallo(previo, "No se pudo anular. Recarga la página.");
  if (UUID.test(pacienteId)) revalidatePath(`/pacientes/${pacienteId}/plan`);
  revalidatePath("/caja");
  return { error: null, mensaje: "Pago anulado.", exitos: previo.exitos + 1 };
}

export async function cerrarCaja(previo: EstadoCaja, form: FormData): Promise<EstadoCaja> {
  const c = await caja();
  if (c.error !== null) return fallo(previo, c.error);
  const dia = String(form.get("fecha") ?? "");
  if (!FECHA.test(dia)) return fallo(previo, "Fecha inválida.");
  const r = validarCierre((k) => String(form.get(k) ?? ""));
  if (!r.ok) return fallo(previo, r.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("cerrar_caja", {
    dia, efectivo_contado: r.datos.efectivo, observaciones: r.datos.observaciones,
  });
  if (error) return fallo(previo, mensajeDeError(error, "caja.cerrar", "cerrar la caja"));
  revalidatePath("/caja");
  return { error: null, mensaje: "Caja cerrada.", exitos: previo.exitos + 1 };
}

export async function registrarAjuste(previo: EstadoCaja, form: FormData): Promise<EstadoCaja> {
  const c = await caja();
  if (c.error !== null) return fallo(previo, c.error);
  const cierre = String(form.get("cierre_id") ?? "");
  if (!UUID.test(cierre)) return fallo(previo, "Cierre inválido.");
  const r = validarAjuste((k) => String(form.get(k) ?? ""));
  if (!r.ok) return fallo(previo, r.error);
  const supabase = await createClient();
  const { error } = await supabase.from("ajuste_caja").insert({
    clinica_id: c.sesion.clinicaId, cierre_id: cierre, metodo: r.datos.metodo, monto_centimos: r.datos.monto,
    motivo: r.datos.motivo, registrado_por: c.sesion.usuarioId,
  });
  if (error) return fallo(previo, mensajeDeError(error, "caja.ajuste", "registrar el ajuste"));
  revalidatePath("/caja");
  return { error: null, mensaje: "Ajuste registrado.", exitos: previo.exitos + 1 };
}
