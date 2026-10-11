"use client";

import { useActionState } from "react";
import type { EstadoSimple } from "./acciones";
import { guardarDescuento, publicarAviso, renombrarClinica, retirarAviso, suspenderClinica } from "./herramientas-acciones";

const ENTRADA = "rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30";
const ETIQUETA = "flex flex-col gap-1 text-xs font-medium text-gray-700";
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

export function RenombrarClinica({ clinicaId, nombre }: { clinicaId: string; nombre: string }) {
  const [estado, accion, enviando] = useActionState(renombrarClinica, INICIAL);
  return (
    <form action={accion} aria-label="Nombre de la clínica" className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="clinica_id" value={clinicaId} />
      <label className={ETIQUETA}>
        Nombre
        <input name="nombre" defaultValue={nombre} required minLength={3} maxLength={120} className={`${ENTRADA} w-72`} />
      </label>
      <label className={ETIQUETA}>
        Motivo
        <input name="motivo" required maxLength={300} placeholder="p. ej. la clínica pidió corregirlo" className={`${ENTRADA} w-64`} />
      </label>
      <button type="submit" disabled={enviando} className={`${BOTON} border border-gray-300 hover:bg-gray-50`}>Guardar nombre</button>
      <Resultado estado={estado} />
    </form>
  );
}

export function SuspenderClinica({ clinicaId, nombre, suspendida }: { clinicaId: string; nombre: string; suspendida: boolean }) {
  const [estado, accion, enviando] = useActionState(suspenderClinica, INICIAL);
  return (
    <form key={estado.exitos} action={accion} aria-label={suspendida ? "Reactivar la clínica" : "Suspender la clínica"}
      className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="clinica_id" value={clinicaId} />
      <input type="hidden" name="accion" value={suspendida ? "reactivar" : "suspender"} />
      <label className={ETIQUETA}>
        Motivo
        <input name="motivo" required maxLength={500} className={`${ENTRADA} w-72`}
          placeholder={suspendida ? "p. ej. regularizó su situación" : "p. ej. pidió pausar la cuenta"} />
      </label>
      <button type="submit" disabled={enviando}
        onClick={(ev) => {
          if (!suspendida && !window.confirm(`¿Suspender ${nombre}? Quedará en solo lectura hasta que la reactives.`)) ev.preventDefault();
        }}
        className={suspendida ? `${BOTON} bg-teal-700 text-white hover:bg-teal-800` : `${BOTON} border border-red-300 text-red-700 hover:bg-red-50`}>
        {suspendida ? "Reactivar clínica" : "Suspender clínica"}
      </button>
      <Resultado estado={estado} />
    </form>
  );
}

export function EditarDescuento({ clinicaId, porcentaje, hasta }: { clinicaId: string; porcentaje: number | null; hasta: string | null }) {
  const [estado, accion, enviando] = useActionState(guardarDescuento, INICIAL);
  return (
    <form key={estado.exitos} action={accion} aria-label="Descuento" className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="clinica_id" value={clinicaId} />
      <label className={ETIQUETA}>
        Descuento (%)
        <input name="porcentaje" type="number" min={0} max={90} step={1} defaultValue={porcentaje ?? 0} className={`${ENTRADA} w-24`} />
      </label>
      <label className={ETIQUETA}>
        Hasta (opcional)
        <input name="hasta" type="date" defaultValue={hasta ?? ""} className={ENTRADA} />
      </label>
      <label className={ETIQUETA}>
        Motivo
        <input name="motivo" required maxLength={300} placeholder="p. ej. clínica fundadora" className={`${ENTRADA} w-56`} />
      </label>
      <button type="submit" disabled={enviando} className={`${BOTON} border border-gray-300 hover:bg-gray-50`}>Guardar descuento</button>
      <Resultado estado={estado} />
    </form>
  );
}

export function NuevoAviso({ clinicas, clinicaFija, hastaSugerido }: {
  clinicas?: { id: string; nombre: string }[]; clinicaFija?: string; hastaSugerido: string;
}) {
  const [estado, accion, enviando] = useActionState(publicarAviso, INICIAL);
  return (
    <form key={estado.exitos} action={accion} aria-label="Nuevo aviso" className="grid gap-3 sm:grid-cols-4">
      {clinicaFija ? <input type="hidden" name="clinica_id" value={clinicaFija} /> : (
        <label className={ETIQUETA}>
          Para
          <select name="clinica_id" defaultValue="" className={ENTRADA}>
            <option value="">Todas las clínicas</option>
            {(clinicas ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
      )}
      <label className={ETIQUETA}>
        Tipo
        <select name="nivel" defaultValue="info" className={ENTRADA}>
          <option value="info">Informativo</option>
          <option value="importante">Importante</option>
        </select>
      </label>
      <label className={ETIQUETA}>
        Se muestra hasta
        <input name="hasta" type="date" defaultValue={hastaSugerido} required className={ENTRADA} />
      </label>
      <label className={`${ETIQUETA} sm:col-span-4`}>
        Aviso (lo ve todo el personal de la clínica, arriba de cada pantalla)
        <textarea name="texto" required minLength={3} maxLength={500} rows={2} className={ENTRADA}
          placeholder="p. ej. El domingo 20 de 6:00 a 7:00 a. m. el sistema estará en mantenimiento." />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-4">
        <button type="submit" disabled={enviando} className={`${BOTON} bg-teal-700 text-white hover:bg-teal-800`}>Publicar aviso</button>
        <Resultado estado={estado} />
      </div>
    </form>
  );
}

export function RetirarAviso({ avisoId }: { avisoId: string }) {
  const [estado, accion, enviando] = useActionState(retirarAviso, INICIAL);
  return (
    <form action={accion} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="aviso_id" value={avisoId} />
      <button type="submit" disabled={enviando} className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">Retirar</button>
      {estado.error && <span role="alert" className="text-xs text-red-700">{estado.error}</span>}
    </form>
  );
}
