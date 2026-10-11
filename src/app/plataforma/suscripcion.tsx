"use client";

import { useActionState } from "react";
import { guardarCobro, guardarTarifa, revisarPago, type EstadoSimple } from "./acciones";

const ENTRADA = "rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30";
const BOTON = "rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60";
const INICIAL: EstadoSimple = { error: null, mensaje: null, exitos: 0 };

function Resultado({ estado }: { estado: EstadoSimple }) {
  return (
    <>
      {estado.error && <p role="alert" className="w-full text-sm text-red-700">{estado.error}</p>}
      {estado.mensaje && <p role="status" className="w-full text-sm text-teal-800">{estado.mensaje}</p>}
    </>
  );
}

export function RevisarPago({ pagoId, descripcion }: { pagoId: string; descripcion: string }) {
  const [estado, accion, enviando] = useActionState(revisarPago, INICIAL);
  return (
    <form key={estado.exitos} action={accion} aria-label={`Revisar ${descripcion}`} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="pago_id" value={pagoId} />
      <button type="submit" name="decision" value="confirmar" disabled={enviando}
        onClick={(ev) => { if (!window.confirm(`¿Confirmar ${descripcion}? El plan se extiende al guardar.`)) ev.preventDefault(); }}
        className={`${BOTON} bg-teal-700 text-white hover:bg-teal-800`}>Confirmar pago</button>
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
        Motivo (para rechazar)
        <input name="motivo" maxLength={300} className={`${ENTRADA} w-64`} />
      </label>
      <button type="submit" name="decision" value="rechazar" disabled={enviando}
        className={`${BOTON} border border-red-300 text-red-700 hover:bg-red-50`}>Rechazar</button>
      <Resultado estado={estado} />
    </form>
  );
}

export function EditarTarifa({ codigo, nombre, mensual, anual }: { codigo: string; nombre: string; mensual: string; anual: string }) {
  const [estado, accion, enviando] = useActionState(guardarTarifa, INICIAL);
  return (
    <form action={accion} aria-label={`Precios de ${nombre}`} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="codigo" value={codigo} />
      <span className="w-24 text-sm font-medium">{nombre}</span>
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
        Mensual (S/)
        <input name="mensual" defaultValue={mensual} inputMode="decimal" className={`${ENTRADA} w-28`} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
        Anual (S/)
        <input name="anual" defaultValue={anual} inputMode="decimal" className={`${ENTRADA} w-28`} />
      </label>
      <button type="submit" disabled={enviando} className={`${BOTON} border border-gray-300 hover:bg-gray-50`}>Guardar precios</button>
      <Resultado estado={estado} />
    </form>
  );
}

export function EditarCobro({ valores }: { valores: Record<string, string> }) {
  const [estado, accion, enviando] = useActionState(guardarCobro, INICIAL);
  const campo = (c: string, etiqueta: string, max: number) => (
    <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
      {etiqueta}
      <input name={c} defaultValue={valores[c] ?? ""} maxLength={max} className={ENTRADA} />
    </label>
  );
  return (
    <form action={accion} aria-label="Datos de cobro" className="grid gap-3 sm:grid-cols-3">
      {campo("yape", "Yape (número)", 40)}
      {campo("plin", "Plin (número)", 40)}
      {campo("titular", "Titular", 120)}
      {campo("banco", "Banco", 60)}
      {campo("cuenta", "N.º de cuenta", 40)}
      {campo("cci", "CCI", 40)}
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 sm:col-span-3">
        Instrucciones (opcional)
        <textarea name="instrucciones" defaultValue={valores.instrucciones ?? ""} maxLength={500} rows={2} className={ENTRADA} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <button type="submit" disabled={enviando} className={`${BOTON} bg-teal-700 text-white hover:bg-teal-800`}>Guardar datos de cobro</button>
        <Resultado estado={estado} />
      </div>
    </form>
  );
}
