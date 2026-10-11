import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { modulos } from "@/lib/funciones";
import type { DatosPlan } from "@/lib/prueba";
import { createClient } from "@/lib/supabase/server";

export type Rol = "admin" | "odontologo" | "asistente" | "recepcion";

export type Sesion = {
  usuarioId: string;
  clinicaId: string;
  nombre: string;
  rol: Rol;
  clinica: string;
  /** Color propio de la clínica (#rrggbb) y ruta del logo en el bucket `marca` (Etapa 15). */
  colorMarca: string | null;
  logoRuta: string | null;
  /** Plan de la clínica (Etapa 16): demo, prueba o activo, con sus fechas. null: módulo apagado. */
  plan: DatosPlan | null;
  /** Minutos sin actividad antes de cerrar la sesión (null: módulo aún apagado). */
  inactividadMinutos: number | null;
  /** Ve la historia clínica: cirujano dentista (admin u odontólogo con COP) o asistente. Lo exige RLS. */
  veClinico: boolean;
  /** Cirujano dentista (admin u odontólogo con COP): registra la historia clínica. Lo exige RLS. */
  esDentista: boolean;
};

export const NOMBRE_ROL: Record<Rol, string> = {
  admin: "Administrador",
  odontologo: "Odontólogo",
  asistente: "Asistente",
  recepcion: "Recepción",
};

/**
 * Usuario y clínica de la sesión actual. Sin sesión, va al login. Con sesión
 * pero sin fila activa en `usuario` (desactivado o no invitado), devuelve null:
 * RLS no le dejará ver nada de ninguna clínica.
 */
export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("usuario")
    .select(`id, nombre, rol, cop, activo, clinica_id, clinica(nombre${modulos.etapa1 ? ", inactividad_minutos" : ""}`
      + `${modulos.etapa15 ? ", color_marca, logo_ruta" : ""}${modulos.etapa16 ? ", plan, prueba_hasta, activo_hasta" : ""})`)
    .eq("id", user.id)
    .maybeSingle<{
      id: string; nombre: string; rol: Rol; cop: string | null; activo: boolean; clinica_id: string;
      clinica: { nombre: string; inactividad_minutos?: number; color_marca?: string | null; logo_ruta?: string | null }
        & Partial<DatosPlan> | null;
    }>();

  if (!data?.activo || !data.clinica) return null;
  return {
    usuarioId: data.id, clinicaId: data.clinica_id, nombre: data.nombre, rol: data.rol, clinica: data.clinica.nombre,
    inactividadMinutos: data.clinica.inactividad_minutos ?? null,
    colorMarca: data.clinica.color_marca ?? null, logoRuta: data.clinica.logo_ruta ?? null,
    plan: data.clinica.plan
      ? { plan: data.clinica.plan, prueba_hasta: data.clinica.prueba_hasta ?? null, activo_hasta: data.clinica.activo_hasta ?? null }
      : null,
    veClinico: data.rol === "asistente" || ((data.rol === "admin" || data.rol === "odontologo") && data.cop !== null),
    esDentista: (data.rol === "admin" || data.rol === "odontologo") && data.cop !== null,
  };
});
