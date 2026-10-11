import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente con la service role: SOLO para la tarea diaria de correos (sin sesión de usuario).
// Nunca se usa en páginas ni acciones de los usuarios. null si la clave no está configurada.
export function clienteServicio() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!clave || !url) return null;
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
}
