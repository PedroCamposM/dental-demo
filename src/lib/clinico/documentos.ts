// Recetas, constancias de atención y certificados de descanso: validación en el
// servidor. El sistema no sugiere medicamentos ni dosis (regla 11): solo revisa que
// lo escrito por el profesional esté completo y dentro de los límites.

export const CAMPOS_MEDICAMENTO = {
  medicamento: { etiqueta: "Medicamento", max: 200 },
  presentacion: { etiqueta: "Presentación", max: 120 },
  dosis: { etiqueta: "Dosis", max: 120 },
  frecuencia: { etiqueta: "Frecuencia", max: 120 },
  duracion: { etiqueta: "Duración", max: 120 },
  indicaciones: { etiqueta: "Indicaciones", max: 300 },
} as const;
export type CampoMedicamento = keyof typeof CAMPOS_MEDICAMENTO;
export type Medicamento = Record<Exclude<CampoMedicamento, "indicaciones">, string> & { indicaciones: string | null };
const OBLIGATORIOS: CampoMedicamento[] = ["medicamento", "presentacion", "dosis", "frecuencia", "duracion"];
export const MAX_MEDICAMENTOS = 20;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Filas del formulario (listas paralelas por campo). Las filas totalmente vacías se
 * ignoran; una fila empezada debe completarse.
 */
export function validarReceta(lista: (campo: string) => string[], t: (campo: string) => string):
  { ok: true; datos: { items: Medicamento[]; indicaciones: string | null; nota_id: string | null; plantilla: string | null } }
  | { ok: false; errores: { filas: Record<number, string>; general?: string } } {
  const columnas = Object.fromEntries((Object.keys(CAMPOS_MEDICAMENTO) as CampoMedicamento[]).map((c) => [c, lista(c)]));
  const n = Math.max(...Object.values(columnas).map((v) => v.length), 0);
  const filas: Record<number, string> = {};
  const items: Medicamento[] = [];
  for (let i = 0; i < n; i++) {
    const v = Object.fromEntries((Object.keys(CAMPOS_MEDICAMENTO) as CampoMedicamento[])
      .map((c) => [c, (columnas[c]?.[i] ?? "").trim().replace(/\s+/g, " ")])) as Record<CampoMedicamento, string>;
    if (Object.values(v).every((x) => x === "")) continue;
    const falta = OBLIGATORIOS.filter((c) => v[c] === "").map((c) => CAMPOS_MEDICAMENTO[c].etiqueta.toLowerCase());
    const largo = (Object.keys(CAMPOS_MEDICAMENTO) as CampoMedicamento[]).find((c) => v[c].length > CAMPOS_MEDICAMENTO[c].max);
    if (falta.length > 0) filas[i] = `Completa: ${falta.join(", ")}.`;
    else if (largo) filas[i] = `${CAMPOS_MEDICAMENTO[largo].etiqueta}: máximo ${CAMPOS_MEDICAMENTO[largo].max} caracteres.`;
    else if (v.medicamento.length < 2) filas[i] = "Escribe el nombre del medicamento.";
    else items.push({ ...v, indicaciones: v.indicaciones || null });
  }
  const indicaciones = t("indicaciones").trim();
  const nota = t("nota_id");
  const plantilla = t("guardar_como").trim().replace(/\s+/g, " ");
  let general: string | undefined;
  if (Object.keys(filas).length === 0 && items.length === 0) general = "Agrega al menos un medicamento.";
  else if (items.length + Object.keys(filas).length > MAX_MEDICAMENTOS) general = `Máximo ${MAX_MEDICAMENTOS} medicamentos.`;
  else if (indicaciones.length > 2000) general = "Indicaciones: máximo 2000 caracteres.";
  else if (nota && !UUID.test(nota)) general = "Sesión inválida.";
  else if (plantilla && (plantilla.length < 3 || plantilla.length > 80)) general = "El nombre de la plantilla va de 3 a 80 caracteres.";
  if (general || Object.keys(filas).length > 0) return { ok: false, errores: { filas, general } };
  return { ok: true, datos: { items, indicaciones: indicaciones || null, nota_id: nota || null, plantilla: plantilla || null } };
}

export const TIPOS_CONSTANCIA = { atencion: "Constancia de atención", descanso: "Certificado de descanso" } as const;
export type TipoConstancia = keyof typeof TIPOS_CONSTANCIA;
export type CampoConstancia = "tipo" | "fecha_atencion" | "hora_inicio" | "hora_fin" | "descanso_desde" | "descanso_dias"
  | "cie10" | "observaciones";
export type ConstanciaValidada = {
  tipo: TipoConstancia; fecha_atencion: string; hora_inicio: string | null; hora_fin: string | null;
  descanso_desde: string | null; descanso_dias: number | null; cie10: string | null; observaciones: string | null;
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const CIE10 = /^[A-Z]\d{2}(\.\d)?$/;

/** Diferencia en días entre dos fechas YYYY-MM-DD. */
function dias(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86_400_000);
}

export function validarConstancia(t: (c: string) => string, hoy: string, codigos: Set<string>):
  { ok: true; datos: ConstanciaValidada } | { ok: false; errores: Partial<Record<CampoConstancia, string>> } {
  const e: Partial<Record<CampoConstancia, string>> = {};
  const tipo = t("tipo");
  if (!Object.hasOwn(TIPOS_CONSTANCIA, tipo)) e.tipo = "Elige el tipo de documento.";
  const fecha = t("fecha_atencion");
  if (!FECHA.test(fecha) || Number.isNaN(Date.parse(fecha))) e.fecha_atencion = "Indica la fecha de atención.";
  else if (fecha > hoy) e.fecha_atencion = "La fecha no puede ser futura.";
  else if (dias(fecha, hoy) > 365) e.fecha_atencion = "La atención es de hace más de un año.";
  const hi = t("hora_inicio");
  const hf = t("hora_fin");
  if (hi && !HORA.test(hi)) e.hora_inicio = "Hora inválida.";
  if (hf && !HORA.test(hf)) e.hora_fin = "Hora inválida.";
  if (hf && !hi) e.hora_inicio = "Indica la hora de inicio.";
  else if (hi && hf && HORA.test(hi) && HORA.test(hf) && hf <= hi) e.hora_fin = "La hora de fin debe ser posterior al inicio.";
  let desde: string | null = null;
  let nDias: number | null = null;
  if (tipo === "descanso") {
    desde = t("descanso_desde");
    if (!FECHA.test(desde) || Number.isNaN(Date.parse(desde))) e.descanso_desde = "Indica desde cuándo.";
    else if (!e.fecha_atencion && (dias(fecha, desde) < 0 || dias(fecha, desde) > 3)) {
      e.descanso_desde = "El descanso empieza el día de la atención o hasta 3 días después.";
    }
    const d = t("descanso_dias");
    nDias = /^\d{1,2}$/.test(d) ? Number(d) : NaN;
    if (!(nDias >= 1 && nDias <= 30)) e.descanso_dias = "Entre 1 y 30 días.";
  }
  const cie10 = t("cie10").trim().toUpperCase();
  if (cie10 && (!CIE10.test(cie10) || !codigos.has(cie10))) e.cie10 = "Código CIE-10 no encontrado.";
  const obs = t("observaciones").trim();
  if (obs.length > 500) e.observaciones = "Máximo 500 caracteres.";
  if (Object.keys(e).length > 0) return { ok: false, errores: e };
  return {
    ok: true,
    datos: {
      tipo: tipo as TipoConstancia, fecha_atencion: fecha, hora_inicio: hi || null, hora_fin: hf || null,
      descanso_desde: tipo === "descanso" ? desde : null, descanso_dias: tipo === "descanso" ? nDias : null,
      cie10: cie10 || null, observaciones: obs || null,
    },
  };
}

/** Último día de descanso (inclusive). */
export function finDescanso(desde: string, nDias: number): string {
  const d = new Date(`${desde}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + nDias - 1);
  return d.toISOString().slice(0, 10);
}
