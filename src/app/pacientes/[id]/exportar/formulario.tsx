"use client";

import { useActionState, useState } from "react";
import { exportarHistoria, type EstadoExportar } from "./acciones";

export function FormularioExportar({ pacienteId }: { pacienteId: string }) {
  const [estado, accion, enviando] = useActionState<EstadoExportar, FormData>(exportarHistoria, { error: null, motivo: "" });
  const [motivo, setMotivo] = useState(estado.motivo);
  return (
    <form action={accion} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Motivo de la exportación
        <input name="motivo" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)}
          placeholder="p. ej. Solicitud escrita del paciente; derivación a otra IPRESS"
          className="rounded-md border border-gray-300 px-3 py-2 text-base font-normal" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enviando} className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60">
          {enviando ? "Preparando…" : "Exportar historia clínica"}
        </button>
        {estado.error && <p role="alert" className="text-sm text-red-700">{estado.error}</p>}
      </div>
    </form>
  );
}
