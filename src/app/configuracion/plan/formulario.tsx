"use client";

import { useActionState } from "react";
import { formatearSoles } from "@/lib/dinero";
import { MAX_CONSTANCIA_BYTES, NOMBRE_METODO, type CampoReporte, type Tarifa } from "@/lib/suscripcion";
import { reportarPago, type EstadoReporte } from "./acciones";

const ENTRADA =
  "rounded-md border border-gray-300 px-3 py-2 text-base font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 aria-[invalid=true]:border-red-500";

export function FormularioReporte({ tarifas, sugerida, hoy }: { tarifas: Tarifa[]; sugerida: string; hoy: string }) {
  const [estado, accion, enviando] = useActionState<EstadoReporte, FormData>(reportarPago, {
    errores: {}, valores: {}, mensaje: null, exitos: 0,
  });
  const v = estado.valores;
  const e = estado.errores;
  const error = (c: CampoReporte | "constancia") => e[c] ? <span className="text-xs font-normal text-red-700">{e[c]}</span> : null;
  return (
    <form key={estado.exitos} action={accion} className="grid gap-4 sm:grid-cols-2" noValidate>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Plan
        <select name="tarifa" defaultValue={v.tarifa || sugerida} aria-invalid={!!e.tarifa} className={ENTRADA}>
          {tarifas.map((t) => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}
        </select>
        {error("tarifa")}
      </label>
      <fieldset className="flex flex-col gap-1 text-sm font-medium">
        <legend>Periodo</legend>
        <div className="flex gap-4 pt-2">
          {(["mensual", "anual"] as const).map((p) => (
            <label key={p} className="flex items-center gap-2 font-normal">
              <input type="radio" name="periodo" value={p} defaultChecked={(v.periodo || "mensual") === p} />
              {p === "mensual" ? "Mensual" : "Anual (2 meses gratis)"}
            </label>
          ))}
        </div>
        {error("periodo")}
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Cómo pagaste
        <select name="metodo" defaultValue={v.metodo || "yape"} aria-invalid={!!e.metodo} className={ENTRADA}>
          {(["yape", "plin", "transferencia"] as const).map((m) => <option key={m} value={m}>{NOMBRE_METODO[m]}</option>)}
        </select>
        {error("metodo")}
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        N.º de operación
        <input name="operacion" defaultValue={v.operacion ?? ""} maxLength={40} aria-invalid={!!e.operacion} className={ENTRADA} />
        {error("operacion")}
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Fecha del pago
        <input type="date" name="pagado_el" defaultValue={v.pagado_el || hoy} max={hoy} aria-invalid={!!e.pagado_el} className={ENTRADA} />
        {error("pagado_el")}
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Constancia (captura o PDF, opcional)
        <input type="file" name="constancia" accept="image/png,image/jpeg,image/webp,application/pdf"
          onChange={(ev) => {
            const f = ev.currentTarget.files?.[0];
            ev.currentTarget.setCustomValidity(f && f.size > MAX_CONSTANCIA_BYTES ? "La constancia pesa más de 1,5 MB." : "");
            ev.currentTarget.reportValidity();
          }}
          className="text-sm font-normal" />
        {error("constancia")}
      </label>
      <p className="text-xs text-gray-500 sm:col-span-2">
        El monto lo calcula el sistema según el plan y el periodo ({tarifas.map((t) =>
          `${t.nombre}: ${formatearSoles(t.mensual_centimos)} al mes o ${formatearSoles(t.anual_centimos)} al año`).join("; ")}).
      </p>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={enviando}
          className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60">
          {enviando ? "Enviando…" : "Reportar pago"}
        </button>
        {e.general && <p role="alert" className="text-sm text-red-700">{e.general}</p>}
        {estado.mensaje && <p role="status" className="text-sm text-teal-800">{estado.mensaje}</p>}
      </div>
    </form>
  );
}
