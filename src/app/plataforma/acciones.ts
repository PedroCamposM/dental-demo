"use server";

import { revalidatePath } from "next/cache";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { leerPrecio } from "@/lib/suscripcion";
import { createClient } from "@/lib/supabase/server";

export type EstadoPlanForm = { error: string | null; mensaje: string | null; exitos: number };

const MENSAJES_BASE = /^(La fecha de fin|Escribe el motivo|Clínica no encontrada|La clínica de demostración|Plan inválido|Solo el superadministrador)/;

/** Activa o extiende el plan de una clínica (solo el superadministrador; lo exige la base y queda en la auditoría). */
export async function extenderPlan(previo: EstadoPlanForm, form: FormData): Promise<EstadoPlanForm> {
  if (!modulos.etapa16) return { ...previo, error: "Módulo apagado.", mensaje: null };
  const id = String(form.get("clinica_id") ?? "");
  const plan = String(form.get("plan") ?? "");
  const hasta = String(form.get("hasta") ?? "");
  const motivo = String(form.get("motivo") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/.test(id)) return { ...previo, error: "Clínica inválida.", mensaje: null };
  if (plan !== "activo" && plan !== "prueba") return { ...previo, error: "Elige el plan.", mensaje: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return { ...previo, error: "Elige la fecha de fin.", mensaje: null };
  if (motivo.length < 3 || motivo.length > 300) return { ...previo, error: "Escribe el motivo (de 3 a 300 caracteres).", mensaje: null };
  const { error } = await (await createClient()).rpc("extender_plan", { id_clinica: id, nuevo_plan: plan, hasta, motivo });
  if (error) {
    if (error.code === "P0001" && MENSAJES_BASE.test(error.message)) return { ...previo, error: `${error.message}.`, mensaje: null };
    registrarError("plataforma.extender_plan", error);
    return { ...previo, error: "No se pudo guardar. Vuelve a intentarlo.", mensaje: null };
  }
  revalidatePath("/plataforma");
  return { error: null, mensaje: "Plan actualizado.", exitos: previo.exitos + 1 };
}

export type EstadoSimple = { error: string | null; mensaje: string | null; exitos: number };

const MENSAJES_PAGO = /^(Ese pago ya fue revisado|Escribe el motivo|Pago no encontrado|Solo el superadministrador|Los precios|Tarifa no encontrada)/;

function errorBase(error: { code?: string; message: string }, contexto: string): string {
  if (error.code === "P0001" && MENSAJES_PAGO.test(error.message)) return `${error.message}.`;
  registrarError(contexto, error);
  return "No se pudo guardar. Vuelve a intentarlo.";
}

/** Confirma (extiende el plan) o rechaza (con motivo) un pago reportado. */
export async function revisarPago(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  if (!modulos.etapa17) return { ...previo, error: "Módulo apagado.", mensaje: null };
  const id = String(form.get("pago_id") ?? "");
  const aprobar = form.get("decision") === "confirmar";
  const motivo = String(form.get("motivo") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/.test(id)) return { ...previo, error: "Pago inválido.", mensaje: null };
  if (!aprobar && (motivo.length < 3 || motivo.length > 300)) {
    return { ...previo, error: "Para rechazar, escribe el motivo (de 3 a 300 caracteres).", mensaje: null };
  }
  const { data, error } = await (await createClient()).rpc("revisar_pago_suscripcion", {
    id_pago: id, aprobar, motivo: aprobar ? null : motivo,
  });
  if (error) return { ...previo, error: errorBase(error, "plataforma.revisar_pago"), mensaje: null };
  revalidatePath("/plataforma");
  return { error: null, mensaje: aprobar ? `Confirmado: plan activo hasta ${String(data)}.` : "Pago rechazado.", exitos: previo.exitos + 1 };
}

/** Cambia los precios de una tarifa (en soles). */
export async function guardarTarifa(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  if (!modulos.etapa17) return { ...previo, error: "Módulo apagado.", mensaje: null };
  const codigo = String(form.get("codigo") ?? "");
  const mensual = leerPrecio(String(form.get("mensual") ?? ""));
  const anual = leerPrecio(String(form.get("anual") ?? ""));
  if (!mensual || !anual) return { ...previo, error: "Escribe precios válidos en soles (p. ej. 99 o 990.00).", mensaje: null };
  const { error } = await (await createClient()).rpc("guardar_tarifa", { cod: codigo, mensual, anual });
  if (error) return { ...previo, error: errorBase(error, "plataforma.tarifa"), mensaje: null };
  revalidatePath("/plataforma");
  return { error: null, mensaje: "Precios guardados.", exitos: previo.exitos + 1 };
}

const CAMPOS_COBRO = ["yape", "plin", "banco", "cuenta", "cci", "titular", "instrucciones"] as const;

/** Datos que ven las clínicas para pagar. */
export async function guardarCobro(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  if (!modulos.etapa17) return { ...previo, error: "Módulo apagado.", mensaje: null };
  const datos = Object.fromEntries(CAMPOS_COBRO.map((c) => [c, String(form.get(c) ?? "").trim()]));
  const largo = CAMPOS_COBRO.find((c) => (datos[c] ?? "").length > (c === "instrucciones" ? 500 : c === "titular" ? 120 : c === "banco" ? 60 : 40));
  if (largo) return { ...previo, error: `El campo «${largo}» es demasiado largo.`, mensaje: null };
  const { error } = await (await createClient()).rpc("guardar_cobro", { datos });
  if (error) return { ...previo, error: errorBase(error, "plataforma.cobro"), mensaje: null };
  revalidatePath("/plataforma");
  return { error: null, mensaje: "Datos de cobro guardados.", exitos: previo.exitos + 1 };
}
