// Errores de Supabase Auth en palabras para la recepción de una clínica.
export function mensajeErrorLogin(error: { code?: string; status?: number } | null): string {
  switch (error?.code) {
    case "invalid_credentials":
      return "Correo o contraseña incorrectos.";
    case "email_not_confirmed":
      return "Tu correo aún no está confirmado. Pide al administrador que te reenvíe la invitación.";
    case "user_banned":
      return "Tu usuario está desactivado. Habla con el administrador de la clínica.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Demasiados intentos. Espera un minuto y vuelve a intentar.";
  }
  if (error?.status === 429) {
    return "Demasiados intentos. Espera un minuto y vuelve a intentar.";
  }
  return "No pudimos iniciar sesión. Revisa tu conexión e inténtalo de nuevo.";
}
