// Etapa 18: gestión de clientes (superadministrador). Solo cuentas, uso y cobranza: nunca
// datos clínicos. Lógica pura y probada; la base trae los conteos.

export type Salud = "verde" | "ambar" | "rojo" | "sin_datos";
export type EstadoCliente = "demo" | "prueba" | "activo" | "vencido" | "suspendida";

export const NOMBRE_SALUD: Record<Salud, string> = {
  verde: "Activa", ambar: "Uso en baja", rojo: "Sin uso", sin_datos: "Sin actividad aún",
};
export const NOMBRE_ESTADO: Record<EstadoCliente, string> = {
  demo: "Demostración", prueba: "En prueba", activo: "Activa (pagando)", vencido: "Vencida", suspendida: "Suspendida",
};

const DIA = 86_400_000;
const diasDesde = (instante: string, ahora: Date) => Math.floor((ahora.getTime() - Date.parse(instante)) / DIA);

/**
 * Semáforo: verde si hubo actividad en los últimos 7 días y el uso no cayó a la mitad; ámbar
 * entre 8 y 14 días o con el uso de los últimos 30 días por debajo de la mitad de los 30
 * anteriores; rojo con más de 14 días sin actividad.
 */
export function salud(ultimaActividad: string | null, actividad30: number, previa30: number, ahora: Date): Salud {
  if (!ultimaActividad) return "sin_datos";
  const dias = diasDesde(ultimaActividad, ahora);
  if (dias > 14) return "rojo";
  if (dias > 7) return "ambar";
  if (previa30 >= 6 && actividad30 * 2 < previa30) return "ambar";
  return "verde";
}

export type FilaCliente = {
  id: string; nombre: string; plan: "demo" | "prueba" | "activo"; prueba_hasta: string | null; activo_hasta: string | null;
  ultima_actividad?: string | null; actividad_30?: number; actividad_previa_30?: number; ultimo_pago_estado?: string | null;
  correo_admin?: string | null; telefono?: string | null; administrador: string | null;
  /** Etapa 20: suspendida por el superadministrador (solo lectura). */
  suspendida_at?: string | null; descuento_pct?: number | null; activacion?: number;
};

/** Fin del periodo vigente (null: demo o activo sin fecha). */
export function finPlan(c: Pick<FilaCliente, "plan" | "prueba_hasta" | "activo_hasta">): string | null {
  return c.plan === "prueba" ? c.prueba_hasta : c.plan === "activo" ? c.activo_hasta : null;
}

/** Estado comercial; `hoy` en YYYY-MM-DD (Lima). Vence al terminar el día de fin. */
export function estadoCliente(c: Pick<FilaCliente, "plan" | "prueba_hasta" | "activo_hasta" | "suspendida_at">, hoy: string): EstadoCliente {
  if (c.plan === "demo") return "demo";
  if (c.suspendida_at) return "suspendida";
  const fin = finPlan(c);
  if (fin && fin < hoy) return "vencido";
  return c.plan;
}

/** Días calendario de `hoy` a `fecha` (negativo si ya pasó). */
export function diasHasta(fecha: string, hoy: string): number {
  return Math.round((Date.parse(`${fecha}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / DIA);
}

export type Cobro = { fila: FilaCliente; motivo: "vence_pronto" | "vencido"; dias: number; pagoRechazado: boolean };

/** Días que una vencida sigue en «por contactar» (después se considera baja). */
export const DIAS_SEGUIMIENTO_VENCIDA = 30;

/** A quién contactar: vence en 7 días o menos y vencidas hace 30 días o menos (marcando si su último pago fue rechazado). */
export function cobranza(filas: FilaCliente[], hoy: string): Cobro[] {
  const lista: Cobro[] = [];
  for (const f of filas) {
    if (f.plan === "demo" || f.suspendida_at) continue;
    const fin = finPlan(f);
    if (!fin) continue;
    const d = diasHasta(fin, hoy);
    const pagoRechazado = f.ultimo_pago_estado === "rechazado";
    if (d >= 0 && d <= 7) lista.push({ fila: f, motivo: "vence_pronto", dias: d, pagoRechazado });
    else if (d < 0 && -d <= DIAS_SEGUIMIENTO_VENCIDA) lista.push({ fila: f, motivo: "vencido", dias: -d, pagoRechazado });
  }
  return lista.sort((a, b) => (a.motivo === b.motivo ? a.dias - b.dias : a.motivo === "vence_pronto" ? -1 : 1));
}

/** Filtro de la lista: texto en nombre, administrador o correo; estado y salud opcionales. */
export function filtrarClientes(filas: FilaCliente[], filtro: { q?: string; estado?: string; salud?: string }, hoy: string, ahora: Date) {
  const q = (filtro.q ?? "").trim().toLowerCase();
  return filas.filter((f) => {
    if (q && ![f.nombre, f.administrador ?? "", f.correo_admin ?? ""].some((t) => t.toLowerCase().includes(q))) return false;
    if (filtro.estado && estadoCliente(f, hoy) !== filtro.estado) return false;
    if (filtro.salud && salud(f.ultima_actividad ?? null, f.actividad_30 ?? 0, f.actividad_previa_30 ?? 0, ahora) !== filtro.salud) {
      return false;
    }
    return true;
  });
}

/** Porcentaje de pruebas que pagaron (null si aún no hay pruebas). */
export function conversion(pagadas: number, total: number): number | null {
  return total > 0 ? Math.round((pagadas / total) * 100) : null;
}

/** Teléfono peruano para wa.me (51 + 9 dígitos), o null si no se puede. */
export function telefonoWhatsApp(telefono: string | null | undefined): string | null {
  const d = (telefono ?? "").replace(/\D/g, "");
  if (/^51\d{9}$/.test(d)) return d;
  if (/^9\d{8}$/.test(d)) return `51${d}`;
  return null;
}
