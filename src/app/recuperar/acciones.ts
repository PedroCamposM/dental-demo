"use server";

import { headers } from "next/headers";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";

export type EstadoRecuperar = { enviado: boolean; error: string | null; correo: string };

/** Envía el enlace para crear una contraseña nueva. No revela si el correo existe. */
export async function recuperar(_previo: EstadoRecuperar, form: FormData): Promise<EstadoRecuperar> {
  const correo = String(form.get("correo") ?? "").trim().toLowerCase();
  if (!modulos.etapa19) return { enviado: false, error: "Esta opción aún no está disponible.", correo };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return { enviado: false, error: "Escribe un correo válido.", correo };
  const h = await headers();
  const origen = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")
    ?? h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const { error } = await (await createClient()).auth.resetPasswordForEmail(correo, { redirectTo: `${origen}/auth/confirmar` });
  if (error) {
    if (error.status === 429) return { enviado: false, error: "Demasiados intentos. Espera unos minutos.", correo };
    registrarError("recuperar", error);
  }
  return { enviado: true, error: null, correo };
}
