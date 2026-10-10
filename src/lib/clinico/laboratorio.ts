// Laboratorio (Etapa 10): validación en el servidor y estado de las órdenes. La base vuelve
// a validar (ítem aceptado, laboratorio activo, fechas, transiciones, rol).
import { aCentimos } from "../dinero";
import { diasEntre } from "../fechas";

export const ESTADOS_ORDEN = {
  por_enviar: "Por enviar",
  en_laboratorio: "En laboratorio",
  recibida: "Recibida",
  cancelada: "Cancelada",
} as const;
export type EstadoOrden = keyof typeof ESTADOS_ORDEN;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const fechaValida = (t: string) => FECHA.test(t) && !Number.isNaN(Date.parse(`${t}T00:00:00Z`))
  && new Date(`${t}T00:00:00Z`).toISOString().startsWith(t);
const MAXIMO = 10_000_000;

type Leer = (campo: string) => string;

function costo(texto: string): { centimos: number | null } | { error: string } {
  const t = texto.trim();
  if (!t) return { centimos: null };
  let c: number;
  try {
    c = aCentimos(t);
  } catch {
    return { error: "Costo inválido (p. ej. 250 o 250.50)." };
  }
  if (c < 0 || c > MAXIMO) return { error: "Costo inválido." };
  return { centimos: c };
}

export function validarOrden(leer: Leer):
  { ok: true; datos: { tipo_trabajo: string; color: string | null; indicaciones: string | null; costo_centimos: number | null } }
  | { ok: false; error: string } {
  const tipo = leer("tipo_trabajo").trim();
  if (tipo.length < 2) return { ok: false, error: "Indica el tipo de trabajo." };
  if (tipo.length > 200) return { ok: false, error: "Tipo de trabajo: máximo 200 caracteres." };
  const color = leer("color").trim();
  if (color.length > 40) return { ok: false, error: "Color: máximo 40 caracteres." };
  const indicaciones = leer("indicaciones").trim();
  if (indicaciones.length > 1000) return { ok: false, error: "Indicaciones: máximo 1000 caracteres." };
  const c = costo(leer("costo"));
  if ("error" in c) return { ok: false, error: c.error };
  return { ok: true, datos: { tipo_trabajo: tipo, color: color || null, indicaciones: indicaciones || null, costo_centimos: c.centimos } };
}

export function validarEnvio(leer: Leer, hoy: string):
  { ok: true; envio: string; entrega: string } | { ok: false; error: string } {
  const envio = leer("fecha_envio").trim();
  const entrega = leer("fecha_entrega_prevista").trim();
  if (!fechaValida(envio)) return { ok: false, error: "Indica la fecha de envío." };
  if (!fechaValida(entrega)) return { ok: false, error: "Indica la fecha de entrega prevista." };
  if (envio > hoy) return { ok: false, error: "La fecha de envío no puede ser futura." };
  if (entrega < envio) return { ok: false, error: "La entrega prevista no puede ser anterior al envío." };
  return { ok: true, envio, entrega };
}

export function validarRecepcion(leer: Leer, hoy: string, envio: string | null):
  { ok: true; recepcion: string; costo_centimos: number | null } | { ok: false; error: string } {
  const recepcion = leer("fecha_recepcion").trim();
  if (!fechaValida(recepcion)) return { ok: false, error: "Indica la fecha de recepción." };
  if (recepcion > hoy) return { ok: false, error: "La fecha de recepción no puede ser futura." };
  if (envio && recepcion < envio) return { ok: false, error: "La recepción no puede ser anterior al envío." };
  const c = costo(leer("costo"));
  if ("error" in c) return { ok: false, error: c.error };
  return { ok: true, recepcion, costo_centimos: c.centimos };
}

/** Días de atraso (0 si no está atrasada): en laboratorio con la entrega prevista ya pasada. */
export function diasAtraso(o: { estado: EstadoOrden; fecha_entrega_prevista: string | null }, hoy: string): number {
  if (o.estado !== "en_laboratorio" || !o.fecha_entrega_prevista || o.fecha_entrega_prevista >= hoy) return 0;
  return diasEntre(o.fecha_entrega_prevista, hoy);
}
