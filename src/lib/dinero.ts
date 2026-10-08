// Montos en céntimos enteros (regla 5). Nunca float para guardar ni sumar.

const formato = new Intl.NumberFormat("es-PE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 123450 -> "S/ 1,234.50" */
export function formatearSoles(centimos: number): string {
  if (!Number.isInteger(centimos)) {
    throw new Error(`Monto en céntimos no entero: ${centimos}`);
  }
  const signo = centimos < 0 ? "-" : "";
  return `${signo}S/ ${formato.format(Math.abs(centimos) / 100)}`;
}

/** "1,234.50" | "1234.5" | "S/ 80" -> 123450 | 123450 | 8000 */
export function aCentimos(texto: string): number {
  const limpio = texto.replace(/S\/|\s|,/g, "");
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(limpio);
  if (!m) throw new Error(`Monto inválido: "${texto}"`);
  const [, signo, enteros = "0", decimales = ""] = m;
  const valor = Number(enteros) * 100 + Number(decimales.padEnd(2, "0"));
  return signo ? -valor : valor;
}
