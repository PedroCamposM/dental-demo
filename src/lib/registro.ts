import "server-only";

// Registro de errores del servidor (Vercel guarda la salida de console en sus logs).
// Una línea JSON por error, con contexto para rastrearlo; nunca datos clínicos.
export function registrarError(contexto: string, error: unknown, extra: Record<string, string | number | null> = {}) {
  const e = error as { message?: string; code?: string; details?: string } | null;
  console.error(JSON.stringify({
    nivel: "error",
    contexto,
    mensaje: e?.message ?? String(error),
    codigo: e?.code ?? null,
    detalle: e?.details ?? null,
    ...extra,
    en: new Date().toISOString(),
  }));
}
