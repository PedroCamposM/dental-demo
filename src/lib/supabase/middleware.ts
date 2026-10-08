import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { esRutaPublica } from "@/lib/auth/rutas";

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
  if (!user && !esRutaPublica(ruta)) {
    return redirigir(request, response, "/login", ruta + request.nextUrl.search);
  }
  if (user && esRutaPublica(ruta)) {
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
