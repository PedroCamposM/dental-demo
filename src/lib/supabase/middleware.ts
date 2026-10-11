import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { esRutaDeIngreso, esRutaPublica } from "@/lib/auth/rutas";
import {
  COOKIE_ACTIVIDAD, COOKIE_LIMITE, DURACION_COOKIE_S, estadoInactividad, minutosValidos,
} from "@/lib/sesion-segura/inactividad";

// Refresca la sesión de Supabase en cada request, propaga las cookies y
// manda al login a quien no tiene sesión.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ruta = request.nextUrl.pathname;

  // Inactividad también al volver a una pestaña o navegador cerrado: la cookie de
  // última actividad la renuevan el servidor (en cada pedido) y el navegador (al
  // escribir o tocar), y dura un día. Sesión de Supabase sin esa cookie = sesión
  // abandonada (navegador cerrado hace más de un día o sesión anterior a este control).
  if (user && process.env.HABILITAR_ETAPA1 === "1") {
    const ultima = Number(request.cookies.get(COOKIE_ACTIVIDAD)?.value ?? 0);
    const minutos = minutosValidos(request.cookies.get(COOKIE_LIMITE)?.value) ?? 15;
    if (!(ultima > 0) || estadoInactividad(ultima, Date.now(), minutos).tipo === "expirada") {
      await supabase.auth.signOut({ scope: "local" });
      const salida = redirigir(request, response, "/login");
      salida.headers.set("location", new URL("/login?motivo=inactividad", request.url).toString());
      salida.cookies.delete(COOKIE_ACTIVIDAD);
      return salida;
    }
    response.cookies.set(COOKIE_ACTIVIDAD, String(Math.max(ultima, Date.now())), {
      path: "/", sameSite: "lax", maxAge: DURACION_COOKIE_S,
    });
  }

  if (!user && !esRutaPublica(ruta)) {
    return redirigir(request, response, "/login", ruta + request.nextUrl.search);
  }
  if (user && esRutaDeIngreso(ruta)) {
    return redirigir(request, response, "/");
  }
  return response;
}

// Conserva las cookies de sesión que Supabase haya refrescado en este request.
function redirigir(request: NextRequest, response: NextResponse, destino: string, next?: string) {
  const url = request.nextUrl.clone();
  url.pathname = destino;
  url.search = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  const redireccion = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redireccion.cookies.set(cookie));
  return redireccion;
}
