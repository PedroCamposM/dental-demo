// Etapa 16: prueba gratuita por clínica (30 días) y plan pagado activado a mano.
// Al vencer, la clínica queda en solo lectura (la base lo exige; esto es para mostrarlo).

export type PlanClinica = "demo" | "prueba" | "activo";
export type DatosPlan = { plan: PlanClinica; prueba_hasta: string | null; activo_hasta: string | null };

/** Días entre dos fechas YYYY-MM-DD (hasta − desde). */
function dias(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86_400_000);
}

export type EstadoPlan = {
  soloLectura: boolean;
  /** Días que quedan (incluido hoy) de la prueba o del plan con fecha; null si no vence. */
  diasRestantes: number | null;
  /** Aviso para el encabezado; null si no hay nada que avisar. */
  aviso: string | null;
};

export function estadoPlan(p: DatosPlan, hoy: string): EstadoPlan {
  const hasta = p.plan === "prueba" ? p.prueba_hasta : p.plan === "activo" ? p.activo_hasta : null;
  if (p.plan === "demo" || !hasta) return { soloLectura: false, diasRestantes: null, aviso: null };
  const restantes = dias(hoy, hasta) + 1;
  if (restantes <= 0) {
    return {
      soloLectura: true, diasRestantes: 0,
      aviso: p.plan === "prueba"
        ? "La prueba gratuita terminó: la clínica está en solo lectura. Puedes ver y exportar las historias; para seguir registrando, activa el plan."
        : "El plan venció: la clínica está en solo lectura. Para seguir registrando, renueva el plan.",
    };
  }
  if (p.plan === "prueba") {
    return { soloLectura: false, diasRestantes: restantes, aviso: `Prueba gratuita: ${restantes === 1 ? "queda 1 día" : `quedan ${restantes} días`}.` };
  }
  return { soloLectura: false, diasRestantes: restantes, aviso: restantes <= 7 ? `El plan vence en ${restantes === 1 ? "1 día" : `${restantes} días`}.` : null };
}

export type CampoRegistro = "email" | "password" | "clinica" | "nombre" | "cop" | "acepta";
export type DatosRegistro = { email: string; password: string } & DatosClinica;

/** Valida el formulario de registro a la prueba (el servidor y la base vuelven a validar). */
export function validarRegistro(t: (c: string) => string):
  { ok: true; datos: DatosRegistro } | { ok: false; errores: Partial<Record<CampoRegistro, string>> } {
  const e: Partial<Record<CampoRegistro, string>> = {};
  const email = t("email").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) e.email = "Escribe un correo válido.";
  const password = t("password");
  if (password.length < 8 || password.length > 72) e.password = "La contraseña tiene de 8 a 72 caracteres.";
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) e.password = "Usa letras y números.";
  const clinica = validarClinica(t);
  if (!clinica.ok) Object.assign(e, clinica.errores);
  if (t("acepta") !== "1") e.acepta = "Acepta los términos y la política de privacidad para continuar.";
  return !clinica.ok || Object.keys(e).length > 0 ? { ok: false, errores: e } : { ok: true, datos: { email, password, ...clinica.datos } };
}

export type DatosClinica = { clinica: string; nombre: string; cop: string | null };

/** Datos para crear la clínica (al registrarse y en /bienvenida; la base vuelve a validarlos). */
export function validarClinica(t: (c: string) => string):
  { ok: true; datos: DatosClinica } | { ok: false; errores: Partial<Record<"clinica" | "nombre" | "cop", string>> } {
  const e: Partial<Record<"clinica" | "nombre" | "cop", string>> = {};
  const clinica = t("clinica").trim();
  if (clinica.length < 3 || clinica.length > 120) e.clinica = "El nombre de la clínica va de 3 a 120 caracteres.";
  const nombre = t("nombre").trim();
  if (nombre.length < 3 || nombre.length > 120) e.nombre = "Tu nombre va de 3 a 120 caracteres.";
  const cop = t("cop").trim();
  if (cop && !/^\d{1,6}$/.test(cop)) e.cop = "El número de colegiatura (COP) tiene de 1 a 6 dígitos.";
  return Object.keys(e).length > 0 ? { ok: false, errores: e } : { ok: true, datos: { clinica, nombre, cop: cop || null } };
}

/** Error de la base por clínica vencida (solo lectura): se muestra tal cual y no se registra como falla. */
export function esSoloLectura(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === "P0001" && (error.message ?? "").includes("está en solo lectura");
}
