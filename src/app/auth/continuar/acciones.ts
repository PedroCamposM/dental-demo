"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_CLAVE_LIBRE, destinoEnlace, DURACION_CLAVE_LIBRE_S, tipoEnlace } from "@/lib/auth/enlace";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { COOKIE_ACTIVIDAD, COOKIE_BLOQUEO, DURACION_COOKIE_S } from "@/lib/sesion-segura/inactividad";
import { createClient } from "@/lib/supabase/server";

/** Usa el token del enlace del correo (solo al pulsar «Continuar») y abre la sesión. */
export async function continuar(form: FormData) {
  const tokenHash = String(form.get("token_hash") ?? "");
  const tipo = tipoEnlace(String(form.get("type") ?? ""));
  if (!tokenHash || !tipo) redirect("/login?motivo=enlace");
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
  if (error) {
    registrarError("auth.continuar", error);
    redirect("/login?motivo=enlace");
  }
  const almacen = await cookies();
  almacen.set(COOKIE_ACTIVIDAD, String(Date.now()), { path: "/", sameSite: "lax", maxAge: DURACION_COOKIE_S });
  almacen.delete(COOKIE_BLOQUEO);
  if (tipo === "invite" || tipo === "recovery") {
    // Durante 15 minutos puede crear su contraseña sin escribir la anterior (vino por su correo).
    almacen.set(COOKIE_CLAVE_LIBRE, "1", { path: "/cuenta", httpOnly: true, sameSite: "lax", secure: true, maxAge: DURACION_CLAVE_LIBRE_S });
  }
  redirect(destinoEnlace(tipo, modulos.etapa19));
}
