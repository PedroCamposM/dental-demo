// Etapa 17: suscripción con cobro manual. La clínica reporta su pago (Yape, Plin o
// transferencia) y el superadministrador lo confirma; la base calcula el monto y el plan.
import { aCentimos } from "@/lib/dinero";

export type Periodo = "mensual" | "anual";
export type MetodoSuscripcion = "yape" | "plin" | "transferencia";
export type Tarifa = {
  codigo: string; nombre: string; max_odontologos: number | null; mensual_centimos: number; anual_centimos: number;
};
export type EstadoPago = "pendiente" | "confirmado" | "rechazado";

export const NOMBRE_PERIODO: Record<Periodo, string> = { mensual: "Mensual", anual: "Anual" };
export const NOMBRE_METODO: Record<MetodoSuscripcion, string> = { yape: "Yape", plin: "Plin", transferencia: "Transferencia" };
export const NOMBRE_ESTADO_PAGO: Record<EstadoPago, string> = {
  pendiente: "Por confirmar", confirmado: "Confirmado", rechazado: "Rechazado",
};
/** Por debajo del límite de 2 MB de las server actions (una captura de Yape pesa mucho menos). */
export const MAX_CONSTANCIA_BYTES = 1.5 * 1024 * 1024;

/** Plan que corresponde a los odontólogos activos: el más chico que los cubre. */
export function tarifaSugerida(odontologos: number, tarifas: Tarifa[]): Tarifa | null {
  const n = Math.max(odontologos, 1);
  return tarifas.find((t) => t.max_odontologos === null || t.max_odontologos >= n) ?? null;
}

/** Lo que se ahorra pagando el año en vez de doce meses (0 si no hay ahorro). */
export function ahorroAnual(t: Tarifa): number {
  return Math.max(t.mensual_centimos * 12 - t.anual_centimos, 0);
}

/** Texto del rango de odontólogos de una tarifa, dadas todas (ordenadas). */
export function rangoOdontologos(t: Tarifa, tarifas: Tarifa[]): string {
  const i = tarifas.findIndex((x) => x.codigo === t.codigo);
  const desde = i > 0 ? (tarifas[i - 1]?.max_odontologos ?? 0) + 1 : 1;
  if (t.max_odontologos === null) return `${desde} o más odontólogos`;
  return desde === t.max_odontologos ? `${desde} odontólogo${desde === 1 ? "" : "s"}` : `${desde} a ${t.max_odontologos} odontólogos`;
}

export type CampoReporte = "tarifa" | "periodo" | "metodo" | "operacion" | "pagado_el";
export type DatosReporte = { tarifa: string; periodo: Periodo; metodo: MetodoSuscripcion; operacion: string; pagado_el: string };

/** Valida el reporte de pago (la base vuelve a validar y pone el monto). `hoy` en YYYY-MM-DD (Lima). */
export function validarReporte(t: (c: string) => string, codigos: string[], hoy: string):
  { ok: true; datos: DatosReporte } | { ok: false; errores: Partial<Record<CampoReporte, string>> } {
  const e: Partial<Record<CampoReporte, string>> = {};
  const tarifa = t("tarifa");
  if (!codigos.includes(tarifa)) e.tarifa = "Elige un plan.";
  const periodo = t("periodo");
  if (periodo !== "mensual" && periodo !== "anual") e.periodo = "Elige si pagas mensual o anual.";
  const metodo = t("metodo");
  if (metodo !== "yape" && metodo !== "plin" && metodo !== "transferencia") e.metodo = "Elige cómo pagaste.";
  const operacion = t("operacion").trim();
  if (operacion.length < 4 || operacion.length > 40) e.operacion = "Escribe el número de operación (de 4 a 40 caracteres).";
  const pagado = t("pagado_el");
  const limite = new Date(Date.parse(`${hoy}T12:00:00Z`) - 60 * 86_400_000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pagado) || pagado > hoy || pagado < limite) {
    e.pagado_el = "La fecha del pago debe ser de los últimos 60 días.";
  }
  if (Object.keys(e).length > 0) return { ok: false, errores: e };
  return { ok: true, datos: { tarifa, periodo: periodo as Periodo, metodo: metodo as MetodoSuscripcion, operacion, pagado_el: pagado } };
}

/** Constancia: imagen PNG/JPEG/WebP o PDF, revisada por su firma (no por la extensión). */
export function tipoConstancia(bytes: Uint8Array): { ext: string; mime: string } | null {
  const empieza = (firma: number[], desde = 0) => firma.every((b, i) => bytes[desde + i] === b);
  if (empieza([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: "png", mime: "image/png" };
  if (empieza([0xff, 0xd8, 0xff])) return { ext: "jpg", mime: "image/jpeg" };
  if (empieza([0x52, 0x49, 0x46, 0x46]) && empieza([0x57, 0x45, 0x42, 0x50], 8)) return { ext: "webp", mime: "image/webp" };
  if (empieza([0x25, 0x50, 0x44, 0x46, 0x2d])) return { ext: "pdf", mime: "application/pdf" };
  return null;
}

/** Precio escrito en soles → céntimos (mayor que cero y razonable). */
export function leerPrecio(texto: string): number | null {
  try {
    const c = aCentimos(texto.trim());
    return c > 0 && c <= 10_000_000 ? c : null;
  } catch {
    return null;
  }
}
