"use server";

import { redirect } from "next/navigation";
import { destinoSeguro } from "@/lib/auth/rutas";
import { mensajeErrorLogin } from "@/lib/auth/mensajes";
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
  redirect(destinoSeguro(String(form.get("next") ?? "")));
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
