import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente con la service role: SOLO en el servidor, para la tarea diaria de correos y para
// invitar al equipo (Auth admin). Nunca llega al navegador. null si la clave no está configurada.
export function clienteServicio() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!clave || !url) return null;
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
}
