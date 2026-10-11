"use client";

import { useActionState } from "react";
import { extenderPlan, type EstadoPlanForm } from "./acciones";

const ENTRADA = "rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30";

export function FormularioPlan({ clinicaId, nombre, hastaSugerido }: { clinicaId: string; nombre: string; hastaSugerido: string }) {
  const [estado, accion, enviando] = useActionState<EstadoPlanForm, FormData>(extenderPlan, { error: null, mensaje: null, exitos: 0 });
  return (
    <form key={estado.exitos} action={accion} aria-label={`Plan de ${nombre}`} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="clinica_id" value={clinicaId} />
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
        Plan
        <select name="plan" defaultValue="activo" className={ENTRADA}>
          <option value="activo">Activo (pagado)</option>
          <option value="prueba">Extender prueba</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
        Hasta
        <input type="date" name="hasta" defaultValue={hastaSugerido} className={ENTRADA} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
        Motivo
        <input name="motivo" maxLength={300} placeholder="p. ej. pago por transferencia" className={`${ENTRADA} w-56`} />
      </label>
      <button type="submit" disabled={enviando}
        className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60">
        {enviando ? "Guardando…" : "Guardar plan"}
      </button>
      {estado.error && <p role="alert" className="w-full text-sm text-red-700">{estado.error}</p>}
      {estado.mensaje && <p role="status" className="w-full text-sm text-teal-800">{estado.mensaje}</p>}
    </form>
  );
}
