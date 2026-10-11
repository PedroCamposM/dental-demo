// Enlaces de los correos de Auth (Etapa 19).
import type { EmailOtpType } from "@supabase/supabase-js";

export const TIPOS_ENLACE: EmailOtpType[] = ["signup", "email", "invite", "recovery"];

/** Cookie que permite crear la contraseña sin la actual, solo justo después de un enlace de invitación o recuperación. */
export const COOKIE_CLAVE_LIBRE = "dd_clave_libre";
export const DURACION_CLAVE_LIBRE_S = 15 * 60;

export function tipoEnlace(t: string | null): EmailOtpType | null {
  return TIPOS_ENLACE.find((x) => x === t) ?? null;
}

/** Adónde va cada enlace: invitación y recuperación a crear la contraseña; registro a crear la clínica. */
export function destinoEnlace(tipo: EmailOtpType | null, contrasenasEncendidas: boolean): string {
  if (tipo === "invite" || tipo === "recovery") return contrasenasEncendidas ? "/cuenta/clave" : "/";
  return "/bienvenida";
}
