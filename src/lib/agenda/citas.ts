// Citas: validación del servidor al agendar. La base vuelve a exigir horario,
// bloqueos, choques y quién puede forzar.
import { fechaLima, instanteLima } from "@/lib/fechas";
import { minutos } from "./horario";

export type EstadoCita = "programada" | "confirmada" | "en_sala" | "atendida" | "no_asistio" | "cancelada";

export const ESTADOS_CITA: Record<EstadoCita, string> = {
  programada: "Programada",
  confirmada: "Confirmada",
  en_sala: "En sala",
  atendida: "Atendida",
  no_asistio: "No asistió",
  cancelada: "Cancelada",
};

export const ESTADOS_ACTIVOS: EstadoCita[] = ["programada", "confirmada", "en_sala"];

export const DURACIONES_CITA = [15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240];

export type CampoCita = "paciente_id" | "profesional_id" | "fecha" | "hora" | "duracion" | "nota" | "forzada_motivo";
export type EntradaCita = Partial<Record<CampoCita, string>>;
export type CitaValidada = {
  paciente_id: string; odontologo_id: string; inicio: string; fin: string; nota: string | null;
  forzada_motivo: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function validarCita(entrada: EntradaCita, ahora: Date):
  { ok: true; datos: CitaValidada } | { ok: false; errores: Partial<Record<CampoCita, string>> } {
  const e: Partial<Record<CampoCita, string>> = {};
  const t = (c: CampoCita) => (entrada[c] ?? "").trim();

  if (!UUID.test(t("paciente_id"))) e.paciente_id = "Elige al paciente.";
  if (!UUID.test(t("profesional_id"))) e.profesional_id = "Elige al profesional.";
  const fecha = t("fecha");
  const hora = t("hora");
  const mh = minutos(hora);
  if (!FECHA.test(fecha)) e.fecha = "Elige la fecha.";
  if (mh === null) e.hora = "Elige la hora.";
  else if (mh % 5 !== 0) e.hora = "Usa horas en múltiplos de 5 minutos.";
  const duracion = /^\d{1,3}$/.test(t("duracion")) ? Number(t("duracion")) : NaN;
  if (!(duracion >= 5 && duracion <= 480 && duracion % 5 === 0)) e.duracion = "Elige la duración.";
  const nota = t("nota").replace(/\s+/g, " ");
  if (nota.length > 300) e.nota = "Máximo 300 caracteres.";
  const motivo = t("forzada_motivo").replace(/\s+/g, " ");
  if (motivo && motivo.length < 3) e.forzada_motivo = "Explica brevemente por qué se agenda fuera del horario.";
  else if (motivo.length > 200) e.forzada_motivo = "Máximo 200 caracteres.";

  let inicio: Date | null = null;
  let fin: Date | null = null;
  if (!e.fecha && !e.hora && !e.duracion) {
    inicio = instanteLima(fecha, hora);
    fin = new Date(inicio.getTime() + duracion * 60_000);
    if (Number.isNaN(inicio.getTime()) || fechaLima(inicio) !== fecha) e.fecha = "Fecha inválida.";
    else if (inicio.getTime() < ahora.getTime() - 5 * 60_000) e.hora = "Esa hora ya pasó.";
    else if (mh !== null && mh + duracion >= 24 * 60) e.duracion = "La cita debe terminar el mismo día.";
  }
  if (Object.keys(e).length > 0 || !inicio || !fin) return { ok: false, errores: e };
  return {
    ok: true,
    datos: {
      paciente_id: t("paciente_id"), odontologo_id: t("profesional_id"),
      inicio: inicio.toISOString(), fin: fin.toISOString(), nota: nota || null, forzada_motivo: motivo || null,
    },
  };
}

/** ¿La cita [inicio, fin) cae dentro del horario hora_inicio–hora_fin (HH:MM) de ese día? */
export function dentroDeHorario(inicioHHMM: string, finHHMM: string, horaInicio: string, horaFin: string): boolean {
  const [a, b, c, d] = [minutos(inicioHHMM), minutos(finHHMM), minutos(horaInicio), minutos(horaFin)];
  if (a === null || b === null || c === null || d === null) return false;
  return a >= c && b <= d;
}
