// Plan de tratamiento: estados, validación de ítems y totales. Corre en el servidor;
// la base vuelve a validar (fases, dependencias, diagnóstico de origen, RLS).
import { esPiezaFdi, SUPERFICIES, superficiesImposibles, type Superficie } from "@/lib/clinico/diagnostico";
import { aCentimos } from "@/lib/dinero";
import { leerListaPiezas, MAX_PIEZAS } from "@/lib/odontograma/hallazgo";

export const ESTADOS_PLAN = {
  propuesto: "Propuesto",
  aceptado: "Aceptado",
  en_curso: "En curso",
  detenido: "Detenido",
  terminado: "Terminado",
  rechazado: "Rechazado",
  reemplazado: "Reemplazado",
} as const;
export type EstadoPlan = keyof typeof ESTADOS_PLAN;

/** Estado clínico del ítem (el cobro se calcula aparte, desde los pagos). */
export const ESTADOS_ITEM = {
  propuesto: "Propuesto",
  aceptado: "Aceptado",
  programado: "Programado",
  realizado: "Realizado",
  cancelado: "Cancelado",
} as const;
export type EstadoItem = keyof typeof ESTADOS_ITEM;

export const ESTADOS_COBRO = { pendiente: "Por cobrar", parcial: "Pago parcial", cobrado: "Pagado" } as const;
export type EstadoCobro = keyof typeof ESTADOS_COBRO;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProcedimientoCatalogo = {
  id: string; codigo: string; nombre: string; precio_base_centimos: number; duracion_minutos: number;
};

export type ItemValidado = {
  procedimiento_id: string; procedimiento: string; precio_centimos: number; duracion_minutos: number;
  pieza: number | null; superficies: Superficie[] | null; fase: number; diagnostico_id: string | null;
  requiere: string[];
};
export type CampoItem = "procedimiento_id" | "precio" | "duracion_minutos" | "pieza" | "superficies" | "fase"
  | "diagnostico_id" | "requiere";

export type DiagnosticoVigente = { id: string; pieza: number | null; cie10: string };

/**
 * Diagnóstico de origen de cada pieza cuando un mismo procedimiento se agrega a varias: el
 * elegido vale para su propia pieza; en las demás se usa el diagnóstico vigente del paciente
 * con el mismo CIE-10 en esa pieza (p. ej. K02.1 en 16, 26 y 36). Si no hay, queda sin
 * diagnóstico de origen.
 */
export function diagnosticoDePieza(elegido: string | null, vigentes: DiagnosticoVigente[], pieza: number | null): string | null {
  const d = vigentes.find((x) => x.id === elegido);
  if (!d) return null;
  if (d.pieza === null || pieza === null || d.pieza === pieza) return d.id;
  return vigentes.find((x) => x.pieza === pieza && x.cie10 === d.cie10)?.id ?? null;
}

/**
 * Valida uno o varios ítems iguales: con varias piezas («16, 26, 36») se devuelve un ítem
 * por pieza, cada uno con su estado y su cobro propios.
 */
export function validarItems(
  e: { texto: (c: string) => string; lista: (c: string) => string[] },
  contexto: { catalogo: ProcedimientoCatalogo[]; fases: number[]; diagnosticos: DiagnosticoVigente[]; items: string[] },
): { ok: true; datos: ItemValidado[] } | { ok: false; errores: Partial<Record<CampoItem, string>> } {
  const piezas = leerListaPiezas(e.texto("pieza"));
  const base = { ...contexto, diagnosticos: contexto.diagnosticos.map((d) => d.id) };
  if (piezas.length <= 1) {
    const r = validarItem(e, base);
    return r.ok ? { ok: true, datos: [r.datos] } : r;
  }
  if (piezas.length > MAX_PIEZAS) return { ok: false, errores: { pieza: `Máximo ${MAX_PIEZAS} piezas a la vez.` } };
  const datos: ItemValidado[] = [];
  for (const p of piezas) {
    const r = validarItem({ texto: (k) => (k === "pieza" ? p : e.texto(k)), lista: e.lista }, base);
    if (!r.ok) {
      const { pieza, superficies, ...otros } = r.errores;
      return {
        ok: false,
        errores: { ...otros, ...(pieza ? { pieza: `Pieza ${p}: ${pieza.charAt(0).toLowerCase()}${pieza.slice(1)}` } : {}), ...(superficies ? { superficies } : {}) },
      };
    }
    datos.push({ ...r.datos, diagnostico_id: diagnosticoDePieza(r.datos.diagnostico_id, contexto.diagnosticos, r.datos.pieza) });
  }
  return { ok: true, datos };
}

/**
 * Valida un ítem nuevo. `contexto` trae lo que el plan permite: el catálogo activo,
 * las fases del plan, los diagnósticos vigentes del paciente y los ítems del plan.
 */
export function validarItem(
  e: { texto: (c: string) => string; lista: (c: string) => string[] },
  contexto: { catalogo: ProcedimientoCatalogo[]; fases: number[]; diagnosticos: string[]; items: string[] },
): { ok: true; datos: ItemValidado } | { ok: false; errores: Partial<Record<CampoItem, string>> } {
  const errores: Partial<Record<CampoItem, string>> = {};
  const proc = contexto.catalogo.find((p) => p.id === e.texto("procedimiento_id"));
  if (!proc) errores.procedimiento_id = "Elige el procedimiento del catálogo.";

  let precio = proc?.precio_base_centimos ?? 0;
  const textoPrecio = e.texto("precio").trim();
  if (textoPrecio) {
    try {
      precio = aCentimos(textoPrecio);
      if (precio < 0) errores.precio = "El precio no puede ser negativo.";
      else if (precio > 10_000_000) errores.precio = "Revisa el precio (máximo S/ 100,000.00).";
    } catch {
      errores.precio = "Escribe el precio en soles, por ejemplo 180 o 180.50.";
    }
  }

  let duracion = proc?.duracion_minutos ?? 30;
  const textoDuracion = e.texto("duracion_minutos").trim();
  if (textoDuracion) {
    duracion = /^\d{1,3}$/.test(textoDuracion) ? Number(textoDuracion) : NaN;
    if (!(duracion >= 5 && duracion <= 480)) errores.duracion_minutos = "Entre 5 y 480 minutos.";
  }

  const textoPieza = e.texto("pieza").trim();
  let pieza: number | null = null;
  if (textoPieza) {
    pieza = /^\d{2}$/.test(textoPieza) ? Number(textoPieza) : NaN;
    if (!esPiezaFdi(pieza)) errores.pieza = "Pieza FDI de dos dígitos: 11–48 o 51–85.";
  }
  const superficies = [...new Set(e.lista("superficies"))].filter((s): s is Superficie => Object.hasOwn(SUPERFICIES, s));
  if (superficies.length > 0 && !textoPieza) errores.superficies = "Indica la pieza de esas superficies.";
  else if (superficies.length > 0 && pieza !== null && esPiezaFdi(pieza)) {
    const malas = superficiesImposibles(pieza, superficies);
    if (malas.length > 0) {
      errores.superficies = `La pieza ${pieza} no tiene superficie ${malas.map((m) => SUPERFICIES[m].toLowerCase()).join(" ni ")}.`;
    }
  }

  const fase = Number(e.texto("fase") || "1");
  if (!contexto.fases.includes(fase)) errores.fase = "Elige una fase del plan.";

  const diagnostico = e.texto("diagnostico_id") || null;
  if (diagnostico && (!UUID.test(diagnostico) || !contexto.diagnosticos.includes(diagnostico))) {
    errores.diagnostico_id = "Elige un diagnóstico vigente del paciente.";
  }

  const requiere = [...new Set(e.lista("requiere"))];
  if (requiere.some((r) => !contexto.items.includes(r))) errores.requiere = "Elige ítems de este plan.";

  if (Object.keys(errores).length > 0 || !proc) return { ok: false, errores };
  return {
    ok: true,
    datos: {
      procedimiento_id: proc.id, procedimiento: proc.nombre, precio_centimos: precio, duracion_minutos: duracion,
      pieza: Number.isNaN(pieza) ? null : pieza, superficies: superficies.length > 0 ? superficies : null, fase,
      diagnostico_id: diagnostico, requiere,
    },
  };
}

export type ItemTotal = { estado: EstadoItem; precio_centimos: number; cobrado_centimos: number };

/** Totales del plan: lo vigente (sin cancelados), lo realizado y lo pagado. */
export function totales(items: ItemTotal[]) {
  const vigentes = items.filter((i) => i.estado !== "cancelado");
  return {
    total: vigentes.reduce((s, i) => s + i.precio_centimos, 0),
    realizado: vigentes.filter((i) => i.estado === "realizado").reduce((s, i) => s + i.precio_centimos, 0),
    pagado: items.reduce((s, i) => s + i.cobrado_centimos, 0),
    pendientes: vigentes.filter((i) => i.estado !== "realizado").length,
  };
}

/** Nombre corto de un plan: «Versión 2 · Alternativa B». */
export function nombreVersion(p: { version: number; alternativa: string }, conAlternativa: boolean): string {
  return `Versión ${p.version}${conAlternativa ? ` · Alternativa ${p.alternativa}` : ""}`;
}
