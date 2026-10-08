"use server";

import { redirect } from "next/navigation";
import { mensajeErrorLogin } from "@/lib/auth/mensajes";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";

/** Cierre automático por inactividad: solo este dispositivo. */
export async function cerrarPorInactividad() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?motivo=inactividad");
}

export type ResultadoDesbloqueo = { ok: true } | { ok: false; error: string };

/** Desbloquea la pantalla verificando la contraseña del usuario que tiene la sesión. */
export async function desbloquear(password: string): Promise<ResultadoDesbloqueo> {
  if (!password) return { ok: false, error: "Ingresa tu contraseña." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Tu sesión terminó. Vuelve a ingresar." };
  const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
  if (error) {
    if (error.code !== "invalid_credentials") registrarError("sesion.desbloquear", error);
    return { ok: false, error: error.code === "invalid_credentials" ? "Contraseña incorrecta." : mensajeErrorLogin(error) };
  }
  return { ok: true };
}
