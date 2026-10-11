import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_ACTIVIDAD, COOKIE_BLOQUEO, DURACION_COOKIE_S } from "@/lib/sesion-segura/inactividad";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";

// Enlaces de los correos: confirmar el registro (→ crear la clínica), invitación al equipo y
// recuperar la contraseña (→ crear la contraseña). Acepta el flujo PKCE (?code=) y el de
// plantilla con token (?token_hash=&type=), que funciona aunque se abra en otro equipo.
const TIPOS: EmailOtpType[] = ["signup", "email", "invite", "recovery"];

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tipoPedido = url.searchParams.get("type");
  const tipo = TIPOS.find((t) => t === tipoPedido) ?? null;
  const supabase = await createClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && tipo
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo })
      : { error: { message: "Enlace sin código" } };
  if (error) {
    registrarError("auth.confirmar", error);
    return NextResponse.redirect(new URL("/login?motivo=enlace", request.url));
  }
  // Invitación o recuperación: primero crea su contraseña. Registro: crea su clínica.
  const destino = tipo === "invite" || tipo === "recovery" || url.searchParams.get("siguiente") === "clave"
    ? "/cuenta/clave" : "/bienvenida";
  const respuesta = NextResponse.redirect(new URL(destino, request.url));
  respuesta.cookies.set(COOKIE_ACTIVIDAD, String(Date.now()), { path: "/", sameSite: "lax", maxAge: DURACION_COOKIE_S });
  respuesta.cookies.delete(COOKIE_BLOQUEO);
  return respuesta;
}
