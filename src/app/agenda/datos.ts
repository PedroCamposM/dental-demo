import "server-only";
import type { EstadoCita } from "@/lib/agenda/citas";
import { diaSemana, instanteLima, sumarDias } from "@/lib/fechas";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";

export type Profesional = { id: string; nombre: string };
export type Sillon = { id: string; nombre: string };
export type HorarioDia = { profesional_id: string; dia_semana: number; sillon_id: string; hora_inicio: string; hora_fin: string };
export type BloqueoDia = { id: string; profesional_id: string | null; tipo: string; motivo: string; inicio: string; fin: string };
export type CitaDia = {
  id: string; inicio: string; fin: string; estado: EstadoCita; nota: string | null; odontologo_id: string;
  sillon_id: string | null; forzada_motivo: string | null;
  paciente: { id: string; nombres: string; apellidos: string; telefono: string | null } | null;
};

/** Odontólogos activos con COP (los que atienden). */
export async function cargarProfesionales(): Promise<Profesional[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("usuario").select("id, nombre").in("rol", ["admin", "odontologo"])
    .not("cop", "is", null).eq("activo", true).order("nombre").returns<Profesional[]>();
  if (error) registrarError("agenda.profesionales", error);
  return data ?? [];
}

/** Horarios activos de toda la semana (para el día y para la ayuda al agendar). */
export async function cargarHorarios(): Promise<HorarioDia[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("horario_profesional")
    .select("profesional_id, dia_semana, sillon_id, hora_inicio, hora_fin").eq("activo", true).returns<HorarioDia[]>();
  if (error) registrarError("agenda.horarios", error);
  return (data ?? []).map((h) => ({ ...h, hora_inicio: h.hora_inicio.slice(0, 5), hora_fin: h.hora_fin.slice(0, 5) }));
}

export async function cargarDia(fecha: string) {
  const supabase = await createClient();
  const desde = instanteLima(fecha, "00:00").toISOString();
  const hasta = instanteLima(sumarDias(fecha, 1), "00:00").toISOString();
  const [profesionales, horarios, sillones, bloqueos, citas] = await Promise.all([
    cargarProfesionales(),
    cargarHorarios(),
    supabase.from("sillon").select("id, nombre").returns<Sillon[]>(),
    supabase.from("bloqueo_agenda").select("id, profesional_id, tipo, motivo, inicio, fin")
      .is("anulado_at", null).lt("inicio", hasta).gt("fin", desde).order("inicio").returns<BloqueoDia[]>(),
    supabase.from("cita")
      .select("id, inicio, fin, estado, nota, odontologo_id, sillon_id, forzada_motivo, paciente(id, nombres, apellidos, telefono)")
      .gte("inicio", desde).lt("inicio", hasta).order("inicio").returns<CitaDia[]>(),
  ]);
  const error = sillones.error ?? bloqueos.error ?? citas.error;
  if (error) registrarError("agenda.dia", error, { fecha });
  return {
    error: Boolean(error),
    profesionales,
    horarios: horarios.filter((h) => h.dia_semana === diaSemana(fecha)),
    sillones: new Map((sillones.data ?? []).map((s) => [s.id, s.nombre])),
    bloqueos: bloqueos.data ?? [],
    citas: citas.data ?? [],
  };
}
