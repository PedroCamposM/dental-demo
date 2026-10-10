// Pagos y caja: validación en el servidor (montos en céntimos, regla 7). La base vuelve a
// validar (rol, plan aceptado, saldo, día cerrado).
import { aCentimos } from "./dinero";

export const METODOS_PAGO = {
  efectivo: "Efectivo",
  yape: "Yape",
  plin: "Plin",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
} as const;
export type MetodoPago = keyof typeof METODOS_PAGO;

const MAXIMO = 10_000_000; // S/ 100,000.00

function monto(texto: string, conSigno: boolean): { centimos: number } | { error: string } {
  const t = texto.trim();
  if (!t) return { error: "Indica el monto." };
  let centimos: number;
  try {
    centimos = aCentimos(t);
  } catch {
    return { error: "Monto inválido (p. ej. 150 o 150.50)." };
  }
  if (!conSigno && centimos <= 0) return { error: "El monto debe ser mayor que cero." };
  if (conSigno && centimos === 0) return { error: "El ajuste no puede ser cero." };
  if (Math.abs(centimos) > MAXIMO) return { error: "Monto demasiado alto." };
  return { centimos };
}

export function validarPago(t: (c: string) => string):
  { ok: true; datos: { monto: number; metodo: MetodoPago; referencia: string | null } } | { ok: false; error: string } {
  const m = monto(t("monto"), false);
  if ("error" in m) return { ok: false, error: m.error };
  const metodo = t("metodo");
  if (!Object.hasOwn(METODOS_PAGO, metodo)) return { ok: false, error: "Elige el método de pago." };
  const referencia = t("referencia").trim();
  if (referencia.length > 80) return { ok: false, error: "Referencia: máximo 80 caracteres." };
  return { ok: true, datos: { monto: m.centimos, metodo: metodo as MetodoPago, referencia: referencia || null } };
}

export function validarCierre(t: (c: string) => string):
  { ok: true; datos: { efectivo: number; observaciones: string | null } } | { ok: false; error: string } {
  const texto = t("efectivo_contado").trim();
  if (!texto) return { ok: false, error: "Indica el efectivo contado (0 si no hubo)." };
  let efectivo: number;
  try {
    efectivo = aCentimos(texto);
  } catch {
    return { ok: false, error: "Monto inválido (p. ej. 240 o 240.50)." };
  }
  if (efectivo < 0 || efectivo > MAXIMO) return { ok: false, error: "Monto inválido." };
  const obs = t("observaciones").trim();
  if (obs.length > 500) return { ok: false, error: "Observaciones: máximo 500 caracteres." };
  return { ok: true, datos: { efectivo, observaciones: obs || null } };
}

export function validarAjuste(t: (c: string) => string):
  { ok: true; datos: { monto: number; metodo: MetodoPago; motivo: string } } | { ok: false; error: string } {
  const m = monto(t("monto"), true);
  if ("error" in m) return { ok: false, error: m.error };
  const metodo = t("metodo");
  if (!Object.hasOwn(METODOS_PAGO, metodo)) return { ok: false, error: "Elige el método." };
  const motivo = t("motivo").trim();
  if (motivo.length < 5) return { ok: false, error: "Explica el motivo del ajuste." };
  if (motivo.length > 300) return { ok: false, error: "Motivo: máximo 300 caracteres." };
  return { ok: true, datos: { monto: m.centimos, metodo: metodo as MetodoPago, motivo } };
}
