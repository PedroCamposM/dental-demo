"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { mensajeErrorRegistro } from "@/lib/auth/registro";
import { modulos } from "@/lib/funciones";
import { validarRegistro, type CampoRegistro } from "@/lib/prueba";
import { registrarError } from "@/lib/registro";
import { COOKIE_ACTIVIDAD, COOKIE_BLOQUEO, DURACION_COOKIE_S } from "@/lib/sesion-segura/inactividad";
import { createClient } from "@/lib/supabase/server";

export type EstadoRegistro = {
  errores: Partial<Record<CampoRegistro | "general", string>>;
  valores: Record<string, string>;
  /** Correo al que se envió el enlace de confirmación (ya no se muestra el formulario). */
  enviadoA: string | null;
};

export async function registrarse(_previo: EstadoRegistro, form: FormData): Promise<EstadoRegistro> {
  if (!modulos.etapa16) return { errores: { general: "El registro aún no está abierto." }, valores: {}, enviadoA: null };
  const t = (c: string) => String(form.get(c) ?? "");
  // La contraseña nunca vuelve al navegador.
  const valores = { email: t("email"), clinica: t("clinica"), nombre: t("nombre"), cop: t("cop"), acepta: t("acepta") };
  const r = validarRegistro(t);
  if (!r.ok) return { errores: r.errores, valores, enviadoA: null };

  // URL pública configurada; si no hay, la del pedido (Supabase solo acepta las URL autorizadas).
  const h = await headers();
  const origen = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")
    ?? h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: r.datos.email,
    password: r.datos.password,
    options: {
      emailRedirectTo: `${origen}/auth/confirmar`,
      // Se usan en /bienvenida para crear la clínica (se pueden corregir ahí).
      data: { clinica: r.datos.clinica, nombre: r.datos.nombre, cop: r.datos.cop, acepta_terminos_at: new Date().toISOString() },
    },
  });
  if (error) {
    if (error.status !== 422 && error.status !== 429) registrarError("registro.signUp", error);
    return { errores: { general: mensajeErrorRegistro(error) }, valores, enviadoA: null };
  }
  if (data.session) {
    // Sin confirmación de correo (entorno local): entra directo a crear su clínica.
    const almacen = await cookies();
    almacen.set(COOKIE_ACTIVIDAD, String(Date.now()), { path: "/", sameSite: "lax", maxAge: DURACION_COOKIE_S });
    almacen.delete(COOKIE_BLOQUEO);
    redirect("/bienvenida");
  }
  return { errores: {}, valores: {}, enviadoA: r.datos.email };
}
