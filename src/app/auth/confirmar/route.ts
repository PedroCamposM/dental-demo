import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_ACTIVIDAD, COOKIE_BLOQUEO, DURACION_COOKIE_S } from "@/lib/sesion-segura/inactividad";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";

// Enlace del correo de confirmación: abre la sesión y lleva a crear la clínica.
// Acepta el flujo PKCE (?code=) y el de plantilla con token (?token_hash=&type=).
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tipoPedido = url.searchParams.get("type");
  const tipo: EmailOtpType | null = tipoPedido === "signup" || tipoPedido === "email" ? tipoPedido : null;
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
  const respuesta = NextResponse.redirect(new URL("/bienvenida", request.url));
  respuesta.cookies.set(COOKIE_ACTIVIDAD, String(Date.now()), { path: "/", sameSite: "lax", maxAge: DURACION_COOKIE_S });
  respuesta.cookies.delete(COOKIE_BLOQUEO);
  return respuesta;
}
