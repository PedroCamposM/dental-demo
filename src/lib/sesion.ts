import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Rol = "admin" | "odontologo" | "recepcion";

export type Sesion = {
  usuarioId: string;
  clinicaId: string;
  nombre: string;
  rol: Rol;
  clinica: string;
};

export const NOMBRE_ROL: Record<Rol, string> = {
  admin: "Administrador",
  odontologo: "Odontólogo",
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
    .select("id, nombre, rol, activo, clinica_id, clinica(nombre)")
    .eq("id", user.id)
    .maybeSingle<{
      id: string; nombre: string; rol: Rol; activo: boolean; clinica_id: string; clinica: { nombre: string } | null;
    }>();

  if (!data?.activo || !data.clinica) return null;
  return {
    usuarioId: data.id, clinicaId: data.clinica_id, nombre: data.nombre, rol: data.rol, clinica: data.clinica.nombre,
  };
});
