// Etapa 20: herramientas del superadministrador. Lógica pura y probada (la base valida y
// registra todo; esto da formato a lo que se muestra y se descarga).

/** Pasos de activación de una clínica nueva, en el orden en que suelen darse. */
export const PASOS_ACTIVACION = [
  { clave: "paciente", texto: "Registró un paciente real" },
  { clave: "cita", texto: "Agendó una cita" },
  { clave: "evolucion", texto: "Firmó una evolución" },
  { clave: "equipo", texto: "Invitó a su equipo" },
  { clave: "pago", texto: "Pagó su plan" },
] as const;
export type PasoActivacion = (typeof PASOS_ACTIVACION)[number]["clave"];
export type Activacion = Record<PasoActivacion, boolean>;

/** Lo que hizo el superadministrador, en palabras. */
export const NOMBRE_ACCION: Record<string, string> = {
  extender_plan: "Ajustó el plan",
  confirmar_pago: "Confirmó un pago",
  rechazar_pago: "Rechazó un pago",
  cambiar_precio: "Cambió precios",
  datos_cobro: "Cambió los datos de cobro",
  nota: "Agregó una nota",
  cambiar_nombre: "Cambió el nombre",
  suspender: "Suspendió la clínica",
  reactivar: "Reactivó la clínica",
  descuento: "Dio un descuento",
  quitar_descuento: "Quitó el descuento",
  publicar_aviso: "Publicó un aviso",
  retirar_aviso: "Retiró un aviso",
};

type Detalle = Record<string, unknown>;
const texto = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");
const soles = (c: unknown) => (typeof c === "number" ? `S/ ${(c / 100).toFixed(2)}` : "");

/** Resumen de una línea del detalle de la bitácora (sin datos clínicos: no los hay). */
export function detalleBitacora(accion: string, d: Detalle): string {
  switch (accion) {
    case "extender_plan": return `${texto(d.plan)} hasta ${texto(d.hasta)} · ${texto(d.motivo)}`;
    case "confirmar_pago": return `Operación ${texto(d.operacion)} · ${soles(d.monto_centimos)} · plan hasta ${texto(d.hasta)}`;
    case "rechazar_pago": return `Operación ${texto(d.operacion)} · ${texto(d.motivo)}`;
    case "cambiar_nombre": return `«${texto(d.antes)}» → «${texto(d.despues)}» · ${texto(d.motivo)}`;
    case "descuento": return `${texto(d.porcentaje)} %${d.hasta ? ` hasta ${texto(d.hasta)}` : " sin fecha de fin"} · ${texto(d.motivo)}`;
    case "publicar_aviso": return `«${texto(d.texto)}» hasta ${texto(d.hasta)}`;
    case "retirar_aviso": return `«${texto(d.texto)}»`;
    case "cambiar_precio": {
      const a = (d.antes ?? {}) as Detalle;
      const n = (d.despues ?? {}) as Detalle;
      return `${texto(d.tarifa)}: mensual ${soles(a.mensual)} → ${soles(n.mensual)}, anual ${soles(a.anual)} → ${soles(n.anual)}`;
    }
    default: return texto(d.motivo);
  }
}

export type Ingreso = {
  confirmado_el: string; clinica: string; tarifa: string; periodo: "mensual" | "anual"; monto_centimos: number;
  descuento_pct: number | null; metodo: string; operacion: string; pagado_el: string; plan_hasta: string | null;
};

/** Totales por mes de confirmación (YYYY-MM), del más reciente al más antiguo. */
export function totalesPorMes(filas: Pick<Ingreso, "confirmado_el" | "monto_centimos">[]): { mes: string; pagos: number; centimos: number }[] {
  const m = new Map<string, { pagos: number; centimos: number }>();
  for (const f of filas) {
    const mes = f.confirmado_el.slice(0, 7);
    const t = m.get(mes) ?? { pagos: 0, centimos: 0 };
    t.pagos += 1;
    t.centimos += f.monto_centimos;
    m.set(mes, t);
  }
  return [...m.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([mes, t]) => ({ mes, ...t }));
}

/** Celda CSV: entre comillas si hace falta, y sin fórmulas (Excel ejecuta =, +, -, @). */
export function celdaCsv(v: string): string {
  const seguro = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",;\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** CSV de ingresos (separado por comas, con BOM para que Excel lea las tildes). */
export function csvIngresos(filas: Ingreso[]): string {
  const cab = ["Confirmado el", "Clínica", "Plan", "Periodo", "Monto (S/)", "Descuento (%)", "Método", "Operación", "Pagado el", "Plan hasta"];
  const lineas = filas.map((f) => [
    f.confirmado_el, f.clinica, f.tarifa, f.periodo, (f.monto_centimos / 100).toFixed(2), f.descuento_pct === null ? "" : String(f.descuento_pct),
    f.metodo, f.operacion, f.pagado_el, f.plan_hasta ?? "",
  ].map(celdaCsv).join(","));
  return `﻿${[cab.join(","), ...lineas].join("\r\n")}\r\n`;
}

/** Monto con descuento (igual que la base: redondeo al céntimo). */
export function conDescuento(centimos: number, porcentaje: number | null | undefined): number {
  return porcentaje ? Math.round((centimos * (100 - porcentaje)) / 100) : centimos;
}

/** Fecha YYYY-MM-DD válida (sin desbordes como 2026-02-31). */
export function esFecha(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Rango pedido o, por defecto, desde el 1 de enero hasta hoy (Lima); si viene al revés, se ordena. */
export function rangoIngresos(p: { desde?: string; hasta?: string }, hoy: string): { desde: string; hasta: string } {
  const desde = p.desde && esFecha(p.desde) ? p.desde : `${hoy.slice(0, 4)}-01-01`;
  const hasta = p.hasta && esFecha(p.hasta) ? p.hasta : hoy;
  return desde <= hasta ? { desde, hasta } : { desde: hasta, hasta: desde };
}
