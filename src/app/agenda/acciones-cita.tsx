"use client";

import { useActionState } from "react";
import { atenderCita, cambiarEstadoCita, type EstadoCambioCita } from "./acciones";

const BOTON = "rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-60";

/**
 * Acciones de una cita activa: confirmar, «en sala» (el paciente llegó, solo el día de
 * la cita), «Atender» (el cirujano dentista abre la evolución) y cancelar (pide confirmación).
 */
export function AccionesCita({ id, estado, descripcion, enSala, atender }: {
  id: string; estado: "programada" | "confirmada" | "en_sala"; descripcion: string;
  /** Mostrar «En sala»: módulo encendido y cita de hoy. */
  enSala: boolean;
  /** Mostrar «Atender» / «Continuar evolución»: cirujano dentista, cita de hoy o pasada. */
  atender: "atender" | "continuar" | null;
}) {
  const [resultado, accion, enviando] = useActionState<EstadoCambioCita, FormData>(cambiarEstadoCita, { error: null });
  const [resAtender, accionAtender, abriendo] = useActionState<EstadoCambioCita, FormData>(atenderCita, { error: null });
  const ocupado = enviando || abriendo;
  const error = resultado.error ?? resAtender.error;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {atender && (
        <form action={accionAtender}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={ocupado} aria-label={`${atender === "atender" ? "Atender" : "Continuar la evolución de"} ${descripcion}`}
            className={`${BOTON} border-teal-700 bg-teal-700 text-white hover:bg-teal-800`}>
            {abriendo ? "Abriendo…" : atender === "atender" ? "Atender" : "Continuar evolución"}
          </button>
        </form>
      )}
      {estado === "programada" && (
        <form action={accion}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="estado" value="confirmada" />
          <button type="submit" disabled={ocupado} aria-label={`Confirmar ${descripcion}`}
            className={`${BOTON} border-teal-700 text-teal-800 hover:bg-teal-50`}>
            Confirmar
          </button>
        </form>
      )}
      {enSala && estado !== "en_sala" && (
        <form action={accion}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="estado" value="en_sala" />
          <button type="submit" disabled={ocupado} aria-label={`Marcar en sala ${descripcion}`}
            className={`${BOTON} border-indigo-700 text-indigo-800 hover:bg-indigo-50`}>
            En sala
          </button>
        </form>
      )}
      <form action={accion} onSubmit={(e) => {
        if (!window.confirm(`¿Cancelar ${descripcion}?`)) e.preventDefault();
      }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="estado" value="cancelada" />
        <button type="submit" disabled={ocupado} aria-label={`Cancelar ${descripcion}`}
          className={`${BOTON} border-gray-300 font-normal text-gray-700 hover:bg-gray-50`}>
          Cancelar cita
        </button>
      </form>
      {error && <p role="alert" className="w-full text-xs text-red-700">{error}</p>}
    </div>
  );
}
