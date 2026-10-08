// Las seis listas del tablero: la clave va en la URL /riesgo/<clave>.
export const INDICADORES = {
  mes: {
    titulo: "Presentado vs. aceptado del mes",
    descripcion: "Presupuestos presentados este mes y en qué estado están hoy.",
  },
  presupuestos: {
    titulo: "Presupuestos abiertos",
    descripcion: "Presupuestos sin respuesta, del más antiguo al más nuevo.",
  },
  detenidos: {
    titulo: "Tratamientos detenidos",
    descripcion: "Tratamientos aceptados con trabajo pendiente y sin cita en los próximos 30 días.",
  },
  cuotas: {
    titulo: "Cuotas vencidas",
    descripcion: "Pacientes con cuotas vencidas sin pagar, del atraso más largo al más corto.",
  },
  controles: {
    titulo: "Controles vencidos",
    descripcion: "Pacientes que ya debían volver a control y no tienen cita agendada.",
  },
  "no-show": {
    titulo: "No-show del mes",
    descripcion: "Citas de este mes a las que el paciente no asistió.",
  },
} as const;

export type ClaveIndicador = keyof typeof INDICADORES;

export function esIndicador(clave: string): clave is ClaveIndicador {
  return Object.hasOwn(INDICADORES, clave);
}
