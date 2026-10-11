import { NextResponse, type NextRequest } from "next/server";
import { destinoEnlace, tipoEnlace } from "@/lib/auth/enlace";
import { modulos } from "@/lib/funciones";
import { COOKIE_ACTIVIDAD, COOKIE_BLOQUEO, DURACION_COOKIE_S } from "@/lib/sesion-segura/inactividad";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";

// Enlaces de los correos. Con token (?token_hash=&type=): NO se usa aquí, se pasa a una página con
// botón «Continuar» (los antivirus del correo abren los enlaces y gastarían el token). Con código
// PKCE (?code=, mismo navegador): se abre la sesión directamente.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = tipoEnlace(url.searchParams.get("type"));
  if (tokenHash && tipo) {
    const continuar = new URL("/auth/continuar", request.url);
    continuar.searchParams.set("token_hash", tokenHash);
    continuar.searchParams.set("type", tipo);
    return NextResponse.redirect(continuar);
  }
  const code = url.searchParams.get("code");
  const supabase = await createClient();
  const { error } = code ? await supabase.auth.exchangeCodeForSession(code) : { error: { message: "Enlace sin código" } };
  if (error) {
    registrarError("auth.confirmar", error);
    return NextResponse.redirect(new URL("/login?motivo=enlace", request.url));
  }
  const destino = url.searchParams.get("siguiente") === "clave" ? destinoEnlace("recovery", modulos.etapa19) : "/bienvenida";
  const respuesta = NextResponse.redirect(new URL(destino, request.url));
  respuesta.cookies.set(COOKIE_ACTIVIDAD, String(Date.now()), { path: "/", sameSite: "lax", maxAge: DURACION_COOKIE_S });
  respuesta.cookies.delete(COOKIE_BLOQUEO);
  return respuesta;
}
