"use client";

import { useActionState } from "react";
import { cambiarEstadoCita, type EstadoCambioCita } from "./acciones";

/** Confirmar o cancelar una cita activa (cancelar pide confirmación). */
export function AccionesCita({ id, estado, descripcion }: { id: string; estado: "programada" | "confirmada"; descripcion: string }) {
  const [resultado, accion, enviando] = useActionState<EstadoCambioCita, FormData>(cambiarEstadoCita, { error: null });
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {estado === "programada" && (
        <form action={accion}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="estado" value="confirmada" />
          <button type="submit" disabled={enviando} aria-label={`Confirmar ${descripcion}`}
            className="rounded-md border border-teal-700 px-2 py-1 text-xs font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-60">
            Confirmar
          </button>
        </form>
      )}
      <form action={accion} onSubmit={(e) => {
        if (!window.confirm(`¿Cancelar ${descripcion}?`)) e.preventDefault();
      }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="estado" value="cancelada" />
        <button type="submit" disabled={enviando} aria-label={`Cancelar ${descripcion}`}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-60">
          Cancelar cita
        </button>
      </form>
      {resultado.error && <p role="alert" className="w-full text-xs text-red-700">{resultado.error}</p>}
    </div>
  );
}
