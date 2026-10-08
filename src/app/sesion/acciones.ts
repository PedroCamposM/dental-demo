"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { mensajeErrorLogin } from "@/lib/auth/mensajes";
import { registrarError } from "@/lib/registro";
import { COOKIE_BLOQUEO, DURACION_COOKIE_S } from "@/lib/sesion-segura/inactividad";
import { createClient } from "@/lib/supabase/server";

/** Cierre automático por inactividad: solo este dispositivo. */
export async function cerrarPorInactividad() {
  (await cookies()).delete(COOKIE_BLOQUEO);
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?motivo=inactividad");
}

/**
 * Bloquea la pantalla en el servidor (cookie httpOnly): una pestaña nueva o una
 * recarga también aparecen bloqueadas hasta ingresar la contraseña.
 */
export async function bloquearPantalla() {
  (await cookies()).set(COOKIE_BLOQUEO, "1", {
    path: "/", sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production", maxAge: DURACION_COOKIE_S,
  });
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
  (await cookies()).delete(COOKIE_BLOQUEO);
  return { ok: true };
}
