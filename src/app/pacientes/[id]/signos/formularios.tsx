"use client";

import { useActionState } from "react";
import type { CampoSignos } from "@/lib/historia/cuestionario";
import { anularSignos, registrarSignos, type EstadoAnulacion, type EstadoSignos } from "./acciones";

const ENTRADA =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-base tabular-nums focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 aria-[invalid=true]:border-red-500";

const CAMPOS: { campo: CampoSignos; etiqueta: string; unidad: string; decimal?: boolean }[] = [
  { campo: "presion_sistolica", etiqueta: "PA sistólica", unidad: "mmHg" },
  { campo: "presion_diastolica", etiqueta: "PA diastólica", unidad: "mmHg" },
  { campo: "frecuencia_cardiaca", etiqueta: "Frecuencia cardiaca", unidad: "lpm" },
  { campo: "frecuencia_respiratoria", etiqueta: "Frecuencia respiratoria", unidad: "rpm" },
  { campo: "temperatura_c", etiqueta: "Temperatura", unidad: "°C", decimal: true },
  { campo: "peso_kg", etiqueta: "Peso", unidad: "kg", decimal: true },
  { campo: "talla_cm", etiqueta: "Talla", unidad: "cm", decimal: true },
];

export function FormularioSignos({ pacienteId }: { pacienteId: string }) {
  const [estado, accion, guardando] = useActionState<EstadoSignos, FormData>(registrarSignos, {
    errores: {}, mensaje: null, valores: {},
  });
  const e = estado.errores;
  return (
    <form key={JSON.stringify(estado.valores)} action={accion} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <div className="grid gap-4 sm:grid-cols-4">
        {CAMPOS.map(({ campo, etiqueta, unidad, decimal }) => (
          <div key={campo} className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            <label htmlFor={`s-${campo}`}>{etiqueta} <span className="font-normal text-gray-500">({unidad})</span></label>
            <input id={`s-${campo}`} name={campo} inputMode={decimal ? "decimal" : "numeric"} defaultValue={estado.valores[campo] ?? ""}
              aria-invalid={!!e[campo]} aria-describedby={e[campo] ? `s-${campo}-error` : undefined} className={ENTRADA} />
            {e[campo] && <span id={`s-${campo}-error`} className="text-xs font-normal text-red-700">{e[campo]}</span>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={guardando}
          className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60">
          {guardando ? "Guardando…" : "Registrar signos vitales"}
        </button>
        {e.general && <p role="alert" className="text-sm text-red-700">{e.general}</p>}
        {estado.mensaje && <p role="status" className="text-sm text-teal-700">{estado.mensaje}</p>}
      </div>
    </form>
  );
}

export function AnularSignos({ id, pacienteId, fecha }: { id: string; pacienteId: string; fecha: string }) {
  const [estado, accion, enviando] = useActionState<EstadoAnulacion, FormData>(anularSignos, { error: null });
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-teal-700 hover:underline">Anular</summary>
      <form action={accion} className="mt-2 flex flex-wrap items-end gap-2" noValidate>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="paciente_id" value={pacienteId} />
        <input name="motivo" maxLength={200} aria-label={`Motivo para anular el registro del ${fecha}`}
          placeholder="Motivo (p. ej. peso mal digitado)" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <button type="submit" disabled={enviando} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          {enviando ? "Anulando…" : "Confirmar anulación"}
        </button>
        {estado.error && <p role="alert" className="w-full text-xs text-red-700">{estado.error}</p>}
      </form>
    </details>
  );
}
