"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { destinoSeguro } from "@/lib/auth/rutas";
import { mensajeErrorLogin } from "@/lib/auth/mensajes";
import { COOKIE_ACTIVIDAD } from "@/lib/sesion-segura/inactividad";
import { createClient } from "@/lib/supabase/server";

export type EstadoLogin = { error: string | null; email: string };

export async function iniciarSesion(_previo: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) {
    return { error: "Ingresa tu correo y contraseña.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: mensajeErrorLogin(error), email };
  }
  // Sesión nueva: la inactividad de una sesión anterior no cuenta.
  (await cookies()).set(COOKIE_ACTIVIDAD, String(Date.now()), { path: "/", sameSite: "lax" });
  redirect(destinoSeguro(String(form.get("next") ?? "")));
}

export async function cerrarSesion() {
  const supabase = await createClient();
  // Solo este dispositivo: el alcance por defecto ("global") cerraría también la
  // sesión del mismo usuario en las otras computadoras de la clínica.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
