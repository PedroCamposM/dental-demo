// Plantillas de WhatsApp: qué variables admite cada tipo y cómo se validan.
import type { TipoSeguimiento } from "@/lib/tablero/mensajes";

export type Variable = { nombre: string; descripcion: string; ejemplo: string };

const COMUNES: Variable[] = [
  { nombre: "nombre", descripcion: "Nombre de pila (del apoderado si es menor)", ejemplo: "María" },
  { nombre: "paciente", descripcion: "Nombre completo del paciente", ejemplo: "María Rojas Silva" },
  { nombre: "clinica", descripcion: "Nombre de la clínica", ejemplo: "Clínica Dental Demo – Trujillo" },
];
const TRATAMIENTO: Variable = { nombre: "tratamiento", descripcion: "Título del plan", ejemplo: "Rehabilitación con implante en pieza 36" };

export const TIPOS_PLANTILLA: Record<TipoSeguimiento, { titulo: string; variables: Variable[] }> = {
  presupuesto: {
    titulo: "Presupuesto sin respuesta",
    variables: [...COMUNES, TRATAMIENTO,
      { nombre: "monto", descripcion: "Valor del presupuesto", ejemplo: "S/ 5,300.00" },
      { nombre: "fecha", descripcion: "Fecha en que se presentó", ejemplo: "12 set 2026" }],
  },
  tratamiento_detenido: {
    titulo: "Tratamiento detenido",
    variables: [...COMUNES, TRATAMIENTO,
      { nombre: "monto", descripcion: "Valor de lo que falta hacer", ejemplo: "S/ 1,800.00" },
      { nombre: "fecha", descripcion: "Fecha de la última visita", ejemplo: "20 ago 2026" }],
  },
  cuota_vencida: {
    titulo: "Cuotas vencidas",
    variables: [...COMUNES,
      { nombre: "monto", descripcion: "Total vencido", ejemplo: "S/ 400.00" },
      { nombre: "fecha", descripcion: "Vencimiento de la cuota más antigua", ejemplo: "5 ago 2026" },
      { nombre: "cuotas", descripcion: "Cantidad de cuotas vencidas", ejemplo: "2 cuotas vencidas" },
      { nombre: "numero", descripcion: "Números de las cuotas", ejemplo: "3 y 4" }],
  },
  control: {
    titulo: "Control vencido",
    variables: [...COMUNES, { nombre: "fecha", descripcion: "Fecha en que debía volver", ejemplo: "1 abr 2026" }],
  },
  no_show: {
    titulo: "No asistió a su cita",
    variables: [...COMUNES, { nombre: "fecha", descripcion: "Fecha de la cita perdida", ejemplo: "2 oct 2026" }],
  },
};

export const MAX_CARACTERES = 1000;

export function esTipoPlantilla(tipo: string): tipo is TipoSeguimiento {
  return Object.hasOwn(TIPOS_PLANTILLA, tipo);
}

/** Errores de la plantilla en palabras para la recepción; vacío si está bien. */
export function validarPlantilla(tipo: TipoSeguimiento, cuerpo: string): string[] {
  const errores: string[] = [];
  const texto = cuerpo.trim();
  if (!texto) errores.push("El mensaje no puede estar vacío.");
  if (texto.length > MAX_CARACTERES) {
    errores.push(`El mensaje es muy largo (${texto.length} caracteres, máximo ${MAX_CARACTERES}).`);
  }
  const validas = new Set(TIPOS_PLANTILLA[tipo].variables.map((v) => v.nombre));
  const usadas = [...texto.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1] ?? "");
  const desconocidas = [...new Set(usadas.filter((v) => !validas.has(v)))];
  if (desconocidas.length > 0) {
    errores.push(`Variables que no existen para este mensaje: ${desconocidas.map((v) => `{{${v}}}`).join(", ")}.`);
  }
  if (/\{\{(?![\s\w]*\}\})|(?<!\{\{[\s\w]*)\}\}/.test(texto)) {
    errores.push("Hay llaves {{ }} sin cerrar.");
  }
  return errores;
}

export function variablesDeEjemplo(tipo: TipoSeguimiento): Record<string, string> {
  return Object.fromEntries(TIPOS_PLANTILLA[tipo].variables.map((v) => [v.nombre, v.ejemplo]));
}
