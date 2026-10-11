import "server-only";
import { esSoloLectura } from "@/lib/prueba";

// Registro de errores del servidor (Vercel guarda la salida de console en sus logs).
// Una línea JSON por error, con contexto para rastrearlo; nunca datos clínicos.
export function registrarError(contexto: string, error: unknown, extra: Record<string, string | number | null> = {}) {
  const e = error as { message?: string; code?: string; details?: string } | null;
  // Clínica vencida (solo lectura): no es una falla del sistema y cada intento lo repetiría.
  if (esSoloLectura(e)) return;
  console.error(JSON.stringify({
    nivel: "error",
    contexto,
    mensaje: e?.message ?? String(error),
    codigo: e?.code ?? null,
    // Los errores de restricción (23xxx) traen la fila completa en "details":
    // datos personales que no deben quedar en los logs.
    detalle: e?.code?.startsWith("23") ? null : (e?.details ?? null),
    ...extra,
    en: new Date().toISOString(),
  }));
}
