"use client";

import { useActionState } from "react";
import { guardarInactividad, type EstadoConfiguracion } from "./acciones";

export function FormularioInactividad({ minutos }: { minutos: number }) {
  const [estado, accion, guardando] = useActionState<EstadoConfiguracion, FormData>(guardarInactividad, {
    mensaje: null, error: null,
  });
  return (
    <form action={accion} className="flex flex-col gap-3" noValidate>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Cerrar la sesión tras estos minutos sin actividad
        <input
          name="inactividad_minutos" type="number" min={5} max={120} step={1} defaultValue={minutos} required
          className="w-32 rounded-md border border-gray-300 px-3 py-2 text-base font-normal"
        />
        <span className="text-xs font-normal text-gray-500">Entre 5 y 120. Se avisa un minuto antes.</span>
      </label>
      {estado.error && <p role="alert" className="text-sm text-red-700">{estado.error}</p>}
      {estado.mensaje && <p role="status" className="text-sm text-teal-700">{estado.mensaje}</p>}
      <button type="submit" disabled={guardando}
        className="self-start rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60">
        {guardando ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
