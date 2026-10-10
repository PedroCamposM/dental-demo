"use client";

import { useActionState, useState } from "react";
import { METODOS_PAGO } from "@/lib/caja";
import { anularPago, cerrarCaja, registrarAjuste, registrarPago, type EstadoCaja } from "./acciones";

const ENTRADA =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-base font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30";
const BOTON = "rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60";
const INICIAL: EstadoCaja = { error: null, mensaje: null, exitos: 0 };

function Mensajes({ estado }: { estado: EstadoCaja }) {
  return (
    <>
      {estado.error && <p role="alert" className="text-sm text-red-700">{estado.error}</p>}
      {estado.mensaje && <p role="status" className="text-sm text-teal-700">{estado.mensaje}</p>}
    </>
  );
}

/** Registrar un pago del plan (se aplica solo a cuotas o ítems pendientes). */
export function RegistrarPago({ pacienteId, planId, saldo }: { pacienteId: string; planId: string; saldo: string }) {
  const [estado, accion, enviando] = useActionState<EstadoCaja, FormData>(registrarPago, INICIAL);
  return (
    <form action={accion} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <input type="hidden" name="plan_id" value={planId} />
      {/* La `key` limpia los campos tras un pago registrado; si hay error, se conservan. */}
      <CamposPago key={estado.exitos} saldo={saldo} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enviando} className={BOTON}>{enviando ? "Registrando…" : "Registrar pago"}</button>
        <Mensajes estado={estado} />
      </div>
    </form>
  );
}

function CamposPago({ saldo }: { saldo: string }) {
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("efectivo");
  const [referencia, setReferencia] = useState("");
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Monto (S/)
        <input name="monto" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)}
          placeholder={`Saldo: ${saldo}`} className={ENTRADA} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Método
        <select name="metodo" value={metodo} onChange={(e) => setMetodo(e.target.value)} className={ENTRADA}>
          {Object.entries(METODOS_PAGO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        N° de operación (opcional)
        <input name="referencia" maxLength={80} value={referencia} onChange={(e) => setReferencia(e.target.value)}
          className={ENTRADA} />
      </label>
    </div>
  );
}

export function AnularPago({ pacienteId, id, descripcion }: { pacienteId: string; id: string; descripcion: string }) {
  const [estado, accion, enviando] = useActionState<EstadoCaja, FormData>(anularPago, INICIAL);
  const [motivo, setMotivo] = useState("");
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-gray-600 hover:underline">Anular</summary>
      <form action={accion} className="mt-2 flex flex-wrap items-end gap-2" noValidate>
        <input type="hidden" name="paciente_id" value={pacienteId} />
        <input type="hidden" name="id" value={id} />
        <input name="motivo" maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)}
          aria-label={`Motivo para anular ${descripcion}`} placeholder="Motivo"
          className="min-w-48 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <button type="submit" disabled={enviando} className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50">
          {enviando ? "Anulando…" : "Confirmar anulación"}
        </button>
        <div className="w-full"><Mensajes estado={estado} /></div>
      </form>
    </details>
  );
}

export function CerrarCaja({ fecha, esperado }: { fecha: string; esperado: string }) {
  const [estado, accion, enviando] = useActionState<EstadoCaja, FormData>(cerrarCaja, INICIAL);
  const [efectivo, setEfectivo] = useState("");
  const [obs, setObs] = useState("");
  return (
    <form action={accion} className="flex flex-col gap-3" noValidate
      onSubmit={(e) => { if (!window.confirm("Una vez cerrada, los pagos de este día no se editan. ¿Cerrar la caja?")) e.preventDefault(); }}>
      <input type="hidden" name="fecha" value={fecha} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Efectivo contado (S/)
          <input name="efectivo_contado" inputMode="decimal" value={efectivo} onChange={(e) => setEfectivo(e.target.value)}
            placeholder={`Esperado: ${esperado}`} className={ENTRADA} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Observaciones (opcional)
          <input name="observaciones" maxLength={500} value={obs} onChange={(e) => setObs(e.target.value)} className={ENTRADA} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enviando} className={BOTON}>{enviando ? "Cerrando…" : "Cerrar caja del día"}</button>
        <Mensajes estado={estado} />
      </div>
    </form>
  );
}

export function RegistrarAjuste({ cierreId }: { cierreId: string }) {
  const [estado, accion, enviando] = useActionState<EstadoCaja, FormData>(registrarAjuste, INICIAL);
  return (
    <form action={accion} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="cierre_id" value={cierreId} />
      <CamposAjuste key={estado.exitos} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enviando} className={BOTON}>{enviando ? "Registrando…" : "Registrar ajuste"}</button>
        <Mensajes estado={estado} />
      </div>
    </form>
  );
}

function CamposAjuste() {
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("efectivo");
  const [motivo, setMotivo] = useState("");
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Monto (S/, negativo para restar)
        <input name="monto" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)}
          placeholder="p. ej. -10.00" className={ENTRADA} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Método
        <select name="metodo" value={metodo} onChange={(e) => setMetodo(e.target.value)} className={ENTRADA}>
          {Object.entries(METODOS_PAGO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Motivo
        <input name="motivo" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={ENTRADA} />
      </label>
    </div>
  );
}
