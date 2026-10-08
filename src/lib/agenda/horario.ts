// Horario semanal de los profesionales y bloqueos de agenda. Validación del
// servidor; la base vuelve a exigir horas coherentes, sillón libre y permisos.
import { fechaLima, instanteLima } from "@/lib/fechas";

/** Índice ISO: 1 = lunes … 7 = domingo. */
export const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;
/** «los lunes», «los sábados»… */
export const DIAS_PLURAL = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados", "domingos"] as const;

export type DiaHorario =
  | { dia: number; activo: false }
  | { dia: number; activo: true; sillon_id: string; hora_inicio: string; hora_fin: string };

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Minutos desde las 00:00 de "HH:MM" (null si no es una hora válida). */
export function minutos(hora: string): number | null {
  const m = HORA.exec(hora);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Lee la semana de un formulario con campos activo_N, sillon_N, inicio_N y fin_N (N = 1…7). */
export function validarSemana(leer: (campo: string) => string):
  { ok: true; dias: DiaHorario[] } | { ok: false; errores: Record<number, string> } {
  const dias: DiaHorario[] = [];
  const errores: Record<number, string> = {};
  for (let dia = 1; dia <= 7; dia++) {
    if (leer(`activo_${dia}`) !== "1") {
      dias.push({ dia, activo: false });
      continue;
    }
    const sillon = leer(`sillon_${dia}`);
    const inicio = leer(`inicio_${dia}`);
    const fin = leer(`fin_${dia}`);
    const mi = minutos(inicio);
    const mf = minutos(fin);
    if (!UUID.test(sillon)) errores[dia] = "Elige el sillón.";
    else if (mi === null || mf === null) errores[dia] = "Indica la hora de inicio y de fin.";
    else if (mi % 5 !== 0 || mf % 5 !== 0) errores[dia] = "Usa horas en múltiplos de 5 minutos.";
    else if (mf <= mi) errores[dia] = "La hora de fin debe ser posterior a la de inicio.";
    else if (mf > 23 * 60 + 55) errores[dia] = "El horario termina como máximo a las 23:55.";
    else dias.push({ dia, activo: true, sillon_id: sillon, hora_inicio: inicio, hora_fin: fin });
  }
  return Object.keys(errores).length > 0 ? { ok: false, errores } : { ok: true, dias };
}

export type TipoBloqueo = "vacaciones" | "feriado" | "capacitacion" | "otro";
export const TIPOS_BLOQUEO: Record<TipoBloqueo, string> = {
  vacaciones: "Vacaciones", feriado: "Feriado", capacitacion: "Capacitación", otro: "Otro",
};

export type CampoBloqueo = "tipo" | "profesional_id" | "desde" | "desde_hora" | "hasta" | "hasta_hora" | "motivo";
export type EntradaBloqueo = Partial<Record<CampoBloqueo, string>>;
export type BloqueoValidado = {
  tipo: TipoBloqueo; profesional_id: string | null; motivo: string; inicio: string; fin: string;
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Un bloqueo cubre de «desde» (hora opcional, 00:00 por defecto) a «hasta» (hora
 * opcional; sin hora, hasta el final de ese día). Sin profesional = toda la clínica.
 */
export function validarBloqueo(entrada: EntradaBloqueo, ahora: Date):
  { ok: true; datos: BloqueoValidado } | { ok: false; errores: Partial<Record<CampoBloqueo, string>> } {
  const e: Partial<Record<CampoBloqueo, string>> = {};
  const t = (c: CampoBloqueo) => (entrada[c] ?? "").trim();
  const tipo = t("tipo");
  if (!Object.hasOwn(TIPOS_BLOQUEO, tipo)) e.tipo = "Elige el tipo.";
  const profesional = t("profesional_id");
  if (profesional && !UUID.test(profesional)) e.profesional_id = "Profesional inválido.";
  const motivo = t("motivo").replace(/\s+/g, " ");
  if (motivo.length < 3) e.motivo = "Describe el motivo (p. ej. «Vacaciones de la Dra. Mendoza»).";
  else if (motivo.length > 200) e.motivo = "Máximo 200 caracteres.";

  const desde = t("desde");
  const hasta = t("hasta") || desde;
  const desdeHora = t("desde_hora") || "00:00";
  const hastaHora = t("hasta_hora");
  if (!FECHA.test(desde)) e.desde = "Indica desde qué fecha.";
  if (t("hasta") && !FECHA.test(hasta)) e.hasta = "Fecha inválida.";
  if (minutos(desdeHora) === null) e.desde_hora = "Hora inválida.";
  if (hastaHora && minutos(hastaHora) === null) e.hasta_hora = "Hora inválida.";

  let inicio: Date | null = null;
  let fin: Date | null = null;
  if (!e.desde && !e.hasta && !e.desde_hora && !e.hasta_hora && FECHA.test(hasta)) {
    inicio = instanteLima(desde, desdeHora);
    fin = hastaHora ? instanteLima(hasta, hastaHora) : new Date(instanteLima(hasta, "00:00").getTime() + 86_400_000);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()) || fechaLima(inicio) !== desde
        || fechaLima(instanteLima(hasta, "12:00")) !== hasta) e.desde = "Fecha inválida.";
    else if (fin <= inicio) e.hasta = "El fin debe ser posterior al inicio.";
    else if (fin <= ahora) e.hasta = "El bloqueo ya terminó: indica fechas futuras.";
  }
  if (Object.keys(e).length > 0 || !inicio || !fin) return { ok: false, errores: e };
  return {
    ok: true,
    datos: {
      tipo: tipo as TipoBloqueo, profesional_id: profesional || null, motivo,
      inicio: inicio.toISOString(), fin: fin.toISOString(),
    },
  };
}
