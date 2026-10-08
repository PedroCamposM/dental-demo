"use server";

import { revalidatePath } from "next/cache";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { minutosValidos } from "@/lib/sesion-segura/inactividad";
import { createClient } from "@/lib/supabase/server";

export type EstadoConfiguracion = { mensaje: string | null; error: string | null };

export async function guardarInactividad(_previo: EstadoConfiguracion, form: FormData): Promise<EstadoConfiguracion> {
  if (!modulos.etapa1) return { mensaje: null, error: "Este módulo aún no está habilitado." };
  const sesion = await obtenerSesion();
  if (!sesion || sesion.rol !== "admin") return { mensaje: null, error: "Solo el administrador cambia la configuración." };
  const minutos = minutosValidos(form.get("inactividad_minutos"));
  if (minutos === null) return { mensaje: null, error: "Elige entre 5 y 120 minutos." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("clinica").update({ inactividad_minutos: minutos })
    .eq("id", sesion.clinicaId).select("id").maybeSingle();
  if (error || !data) {
    registrarError("configuracion.inactividad", error ?? "sin fila");
    return { mensaje: null, error: "No se pudo guardar. Inténtalo de nuevo." };
  }
  revalidatePath("/", "layout");
  return { mensaje: `Guardado: la sesión se cerrará tras ${minutos} minutos sin actividad.`, error: null };
}
