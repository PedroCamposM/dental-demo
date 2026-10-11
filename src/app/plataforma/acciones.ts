"use server";

import { revalidatePath } from "next/cache";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
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
