"use server";

import { revalidatePath } from "next/cache";
import { validarLaboratorio } from "@/lib/clinico/laboratorio";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EstadoLaboratorio = { error: string | null; mensaje: string | null; exitos: number };

async function admin(): Promise<{ error: string } | { error: null; clinicaId: string }> {
  if (!modulos.etapa10) return { error: "Este módulo aún no está habilitado." };
  const sesion = await obtenerSesion();
  if (!sesion || sesion.rol !== "admin") return { error: "Solo el administrador mantiene los laboratorios." };
  return { error: null, clinicaId: sesion.clinicaId };
}

export async function crearLaboratorio(previo: EstadoLaboratorio, form: FormData): Promise<EstadoLaboratorio> {
  const fallo = (error: string): EstadoLaboratorio => ({ error, mensaje: null, exitos: previo.exitos });
  const a = await admin();
  if (a.error !== null) return fallo(a.error);
  const r = validarLaboratorio((c) => String(form.get(c) ?? ""));
  if (!r.ok) return fallo(r.error);
  const supabase = await createClient();
  const { error } = await supabase.from("laboratorio").insert({ clinica_id: a.clinicaId, ...r.datos });
  if (error) {
    if (error.code === "23505") return fallo("Ya hay un laboratorio con ese nombre.");
    registrarError("laboratorio.crear", error);
    return fallo("No se pudo guardar el laboratorio. Inténtalo de nuevo.");
  }
  revalidatePath("/configuracion/laboratorios");
  return { error: null, mensaje: `Agregado: ${r.datos.nombre}.`, exitos: previo.exitos + 1 };
}

export async function cambiarActivo(previo: EstadoLaboratorio, form: FormData): Promise<EstadoLaboratorio> {
  const fallo = (error: string): EstadoLaboratorio => ({ error, mensaje: null, exitos: previo.exitos });
  const a = await admin();
  if (a.error !== null) return fallo(a.error);
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return fallo("Laboratorio inválido.");
  const activo = form.get("activo") === "1";
  const supabase = await createClient();
  const { data, error } = await supabase.from("laboratorio").update({ activo }).eq("id", id).select("id").maybeSingle();
  if (error || !data) {
    if (error) registrarError("laboratorio.activo", error);
    return fallo("No se pudo cambiar. Recarga la página.");
  }
  revalidatePath("/configuracion/laboratorios");
  return { error: null, mensaje: activo ? "Activado." : "Desactivado.", exitos: previo.exitos + 1 };
}
