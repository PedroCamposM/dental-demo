"use client";

import { useActionState } from "react";
import { fusionarPacientes, type EstadoFusion } from "../../acciones";

export type Candidato = { id: string; nombre: string; detalle: string };

export function FormularioFusion({ conservar, candidatos }: { conservar: string; candidatos: Candidato[] }) {
  const [estado, accion, fusionando] = useActionState<EstadoFusion, FormData>(fusionarPacientes, { error: null });
  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="conservar" value={conservar} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-gray-700">Registro duplicado que se absorberá</legend>
        {candidatos.map((c) => (
          <label key={c.id} className="flex items-start gap-2 rounded-md border border-gray-200 p-3 hover:bg-gray-50">
            <input type="radio" name="duplicado" value={c.id} className="mt-1" required />
            <span>
              <span className="font-medium">{c.nombre}</span>
              <span className="block text-sm text-gray-500">{c.detalle}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Motivo (queda en la auditoría)
        <textarea
          name="motivo" rows={2} required minLength={5}
          className="rounded-md border border-gray-300 p-2 font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
        />
      </label>
      {estado.error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{estado.error}</p>}
      <button
        type="submit" disabled={fusionando}
        className="self-start rounded-md bg-red-700 px-4 py-2 font-medium text-white hover:bg-red-800 disabled:opacity-60"
      >
        {fusionando ? "Fusionando…" : "Fusionar registros"}
      </button>
    </form>
  );
}
