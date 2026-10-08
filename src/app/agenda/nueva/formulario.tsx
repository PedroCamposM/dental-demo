"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { DURACIONES_CITA, dentroDeHorario, type CampoCita } from "@/lib/agenda/citas";
import { DIAS_PLURAL, minutos } from "@/lib/agenda/horario";
import { crearCita, type EstadoNuevaCita } from "../acciones";

const ENTRADA =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 aria-[invalid=true]:border-red-500";

export type HorarioCliente = { profesional_id: string; dia_semana: number; hora_inicio: string; hora_fin: string; sillon: string };
export type ProcedimientoCliente = { id: string; nombre: string; duracion_minutos: number };

type Props = {
  paciente: { id: string; nombre: string };
  profesionales: { id: string; nombre: string }[];
  horarios: HorarioCliente[];
  procedimientos: ProcedimientoCliente[];
  inicial: { fecha: string; profesional_id: string };
  hoy: string;
  esAdmin: boolean;
};

function diaIso(fecha: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const d = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  return Number.isNaN(d) ? null : d === 0 ? 7 : d;
}

function sumarMinutos(hora: string, mas: number): string {
  const m = minutos(hora);
  if (m === null) return "";
  const t = m + mas;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function FormularioCita({ paciente, profesionales, horarios, procedimientos, inicial, hoy, esAdmin }: Props) {
  const [estado, accion, guardando] = useActionState<EstadoNuevaCita, FormData>(crearCita, {
    errores: {}, general: null, valores: {},
  });
  // Controlados: se conservan si el servidor rechaza la cita (p. ej. por un choque).
  const [profesional, setProfesional] = useState(inicial.profesional_id);
  const [fecha, setFecha] = useState(inicial.fecha);
  const [hora, setHora] = useState("");
  const [duracion, setDuracion] = useState("30");
  const [procedimiento, setProcedimiento] = useState("");
  const [nota, setNota] = useState("");
  const [motivo, setMotivo] = useState("");
  const e = estado.errores;

  const dia = diaIso(fecha);
  const horario = horarios.find((h) => h.profesional_id === profesional && h.dia_semana === dia);
  const fin = hora ? sumarMinutos(hora, Number(duracion)) : "";
  const fuera = Boolean(profesional && dia && hora && fin && (!horario || !dentroDeHorario(hora, fin, horario.hora_inicio, horario.hora_fin)));
  const duraciones = DURACIONES_CITA.includes(Number(duracion)) ? DURACIONES_CITA
    : [...DURACIONES_CITA, Number(duracion)].sort((a, b) => a - b);

  const error = (campo: CampoCita) =>
    e[campo] ? <span id={`cita-${campo}-error`} className="text-xs font-normal text-red-700">{e[campo]}</span> : null;

  return (
    <form action={accion} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="paciente_id" value={paciente.id} />
      {estado.general && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{estado.general}</p>}

      <div className="rounded-lg bg-gray-50 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Paciente</p>
        <p className="font-medium">{paciente.nombre}</p>
        <Link href={`/agenda/nueva?fecha=${fecha}${profesional ? `&profesional=${profesional}` : ""}`}
          className="text-sm text-teal-700 hover:underline">Cambiar de paciente</Link>
        {error("paciente_id")}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="cita-profesional_id">Profesional</label>
          <select id="cita-profesional_id" name="profesional_id" value={profesional} onChange={(ev) => setProfesional(ev.target.value)}
            aria-invalid={!!e.profesional_id} className={ENTRADA}>
            <option value="">Elegir…</option>
            {profesionales.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          {error("profesional_id")}
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="cita-procedimiento_id">Procedimiento (opcional)</label>
          <select id="cita-procedimiento_id" name="procedimiento_id" value={procedimiento} className={ENTRADA}
            onChange={(ev) => {
              setProcedimiento(ev.target.value);
              const p = procedimientos.find((x) => x.id === ev.target.value);
              if (p) setDuracion(String(p.duracion_minutos));
            }}>
            <option value="">Sin especificar</option>
            {procedimientos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="cita-fecha">Fecha</label>
          <input id="cita-fecha" type="date" name="fecha" min={hoy} value={fecha} onChange={(ev) => setFecha(ev.target.value)}
            aria-invalid={!!e.fecha} className={ENTRADA} />
          {error("fecha")}
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="cita-hora">Hora</label>
          <input id="cita-hora" type="time" step={300} name="hora" value={hora} onChange={(ev) => setHora(ev.target.value)}
            aria-invalid={!!e.hora} className={ENTRADA} />
          {error("hora")}
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="cita-duracion">Duración</label>
          <select id="cita-duracion" name="duracion" value={duracion} onChange={(ev) => setDuracion(ev.target.value)}
            aria-invalid={!!e.duracion} className={ENTRADA}>
            {duraciones.map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
          {error("duracion")}
        </div>
      </div>

      {profesional && dia && (
        <p role="status" className={`rounded-md px-3 py-2 text-sm ${fuera ? "bg-amber-50 text-amber-900" : "bg-gray-50 text-gray-700"}`}>
          {horario
            ? `Los ${DIAS_PLURAL[dia]} atiende de ${horario.hora_inicio} a ${horario.hora_fin} (${horario.sillon}).`
            : `No atiende los ${DIAS_PLURAL[dia]}.`}
          {fuera && hora && " La hora elegida queda fuera de su horario."}
          {!fuera && hora && fin && ` La cita sería de ${hora} a ${fin}.`}
        </p>
      )}

      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <label htmlFor="cita-nota">Nota para el equipo (opcional)</label>
        <input id="cita-nota" name="nota" maxLength={300} value={nota} onChange={(ev) => setNota(ev.target.value)}
          aria-invalid={!!e.nota} className={ENTRADA} />
        {error("nota")}
      </div>

      {esAdmin && (fuera || motivo || e.forzada_motivo || estado.general) && (
        <div className="flex flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
          <label htmlFor="cita-forzada_motivo">Agendar de todas formas (solo administrador): motivo</label>
          <input id="cita-forzada_motivo" name="forzada_motivo" maxLength={200} value={motivo}
            onChange={(ev) => setMotivo(ev.target.value)} aria-invalid={!!e.forzada_motivo}
            placeholder="p. ej. Urgencia por dolor" className={ENTRADA} />
          <span className="text-xs font-normal">
            Permite citar fuera del horario o sobre un bloqueo; queda registrado con tu nombre. No permite superponer citas.
          </span>
          {error("forzada_motivo")}
        </div>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={guardando}
          className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60">
          {guardando ? "Agendando…" : "Agendar cita"}
        </button>
        <Link href={`/agenda?fecha=${fecha || hoy}`} className="rounded-md px-4 py-2 text-gray-700 hover:bg-gray-100">Cancelar</Link>
      </div>
    </form>
  );
}
