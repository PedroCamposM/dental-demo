// Mensajes del registro a la prueba gratuita (Supabase Auth → español, sin detalles técnicos).
export function mensajeErrorRegistro(error: { code?: string; status?: number } | null): string {
  if (error?.code === "user_already_exists" || error?.code === "email_exists") {
    return "Ese correo ya tiene una cuenta. Ingresa con tu contraseña.";
  }
  if (error?.code === "weak_password") return "La contraseña es muy débil: usa al menos 8 caracteres con letras y números.";
  if (error?.code === "signup_disabled") return "El registro de nuevas clínicas aún no está abierto. Escríbenos para activarlo.";
  if (error?.code === "over_email_send_rate_limit" || error?.status === 429) {
    return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
  }
  return "No pudimos crear tu cuenta. Vuelve a intentarlo en unos minutos.";
}
