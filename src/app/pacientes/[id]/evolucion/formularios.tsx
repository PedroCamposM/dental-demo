"use client";

import { useActionState } from "react";
import { CAMPOS_EVOLUCION, type CampoEvolucion } from "@/lib/clinico/evolucion";
import {
  agregarAdenda, anularEvolucion, guardarEvolucion, nuevaEvolucion,
  type EstadoEvolucion, type EstadoSimple,
} from "./acciones";

const ENTRADA =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-base font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 aria-[invalid=true]:border-red-500";
const BOTON = "rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60";
const SECUNDARIO = "rounded-md border border-gray-300 px-4 py-2 font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60";
const INICIAL_SIMPLE: EstadoSimple = { error: null, ok: false, intento: 0, texto: "" };

export function NuevaEvolucion({ pacienteId }: { pacienteId: string }) {
  const [estado, accion, enviando] = useActionState<EstadoSimple, FormData>(nuevaEvolucion, INICIAL_SIMPLE);
  return (
    <form action={accion} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <button type="submit" disabled={enviando} className={SECUNDARIO}>
        {enviando ? "Abriendo…" : "Nueva evolución sin cita"}
      </button>
      {estado.error && <p role="alert" className="text-sm text-red-700">{estado.error}</p>}
    </form>
  );
}

export type ItemPendiente = { id: string; descripcion: string; plan: string; sinConsentimiento?: boolean };

/** Borrador de la evolución: datos de la sesión, ítems trabajados y «Firmar y cerrar». */
export function EditorEvolucion({ pacienteId, notaId, guardado, items, marcados }: {
  pacienteId: string; notaId: string;
  guardado: Record<CampoEvolucion, string>;
  items: ItemPendiente[];
  marcados: { trabajados: string[]; terminados: string[] };
}) {
  const [estado, accion, guardando] = useActionState<EstadoEvolucion, FormData>(guardarEvolucion, {
    errores: {}, mensaje: null, valores: null, intento: 0,
  });
  const e = estado.errores;
  const textos = estado.valores?.textos ?? guardado;
  const trabajados = new Set(estado.valores?.trabajados ?? marcados.trabajados);
  const terminados = new Set(estado.valores?.terminados ?? marcados.terminados);
  const campo = (c: CampoEvolucion, filas: number, placeholder = "") => (
    <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
      <label htmlFor={`ev-${notaId}-${c}`}>{CAMPOS_EVOLUCION[c].etiqueta}</label>
      {filas > 1 ? (
        <textarea id={`ev-${notaId}-${c}`} name={c} rows={filas} maxLength={CAMPOS_EVOLUCION[c].max}
          defaultValue={textos[c] ?? ""} placeholder={placeholder} aria-invalid={!!e[c]} className={ENTRADA} />
      ) : (
        <input id={`ev-${notaId}-${c}`} name={c} maxLength={CAMPOS_EVOLUCION[c].max} defaultValue={textos[c] ?? ""}
          placeholder={placeholder} aria-invalid={!!e[c]} className={ENTRADA} />
      )}
      {e[c] && <span className="text-xs font-normal text-red-700">{e[c]}</span>}
    </div>
  );
  return (
    // La `key` vuelve a montar el formulario con lo enviado o con lo guardado tras cada envío.
    <form key={estado.intento} action={accion} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <input type="hidden" name="nota_id" value={notaId} />
      {campo("texto", 4, "Lo realizado en la sesión")}
      <div className="grid gap-4 sm:grid-cols-2">
        {campo("anestesia_tipo", 1, "p. ej. lidocaína 2% con epinefrina")}
        {campo("anestesia_cantidad", 1, "p. ej. 1 cartucho (1.8 ml)")}
      </div>
      {campo("materiales", 2)}
      {campo("incidencias", 2)}
      {campo("indicaciones", 3)}
      {campo("proxima_cita", 1, "p. ej. en 7 días, para cementar la corona")}

      <fieldset className="rounded-lg border border-gray-200 p-3">
        <legend className="px-1 text-sm font-semibold">Ítems del plan trabajados en esta sesión</legend>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">El paciente no tiene ítems aceptados pendientes.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {items.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="min-w-56 flex-1">
                  {it.descripcion} <span className="text-gray-500">· {it.plan}</span>
                  {it.sinConsentimiento && (
                    <span className="block text-xs text-amber-800">
                      Falta el consentimiento informado firmado: no se podrá marcar como terminado al firmar.
                    </span>
                  )}
                </span>
                <label className="flex items-center gap-1">
                  <input type="checkbox" name="trabajado" value={it.id} defaultChecked={trabajados.has(it.id)}
                    aria-label={`Trabajado: ${it.descripcion}`} />
                  Trabajado
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" name="terminado" value={it.id} defaultChecked={terminados.has(it.id)}
                    aria-label={`Terminado: ${it.descripcion}`} />
                  Terminado
                </label>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-gray-500">
          Al firmar, los ítems terminados pasan a «realizado» con esta evolución (respetando el orden del plan).
        </p>
        {e.items && <p role="alert" className="mt-1 text-xs text-red-700">{e.items}</p>}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" name="accion" value="guardar" disabled={guardando} className={SECUNDARIO}>
          {guardando ? "Guardando…" : "Guardar borrador"}
        </button>
        <button type="submit" name="accion" value="firmar" disabled={guardando} className={BOTON}
          onClick={(ev) => {
            if (!window.confirm("Al firmar, la evolución ya no se edita: solo admite adendas. ¿Firmar y cerrar?")) ev.preventDefault();
          }}>
          Firmar y cerrar
        </button>
        {e.general && <p role="alert" className="text-sm text-red-700">{e.general}</p>}
        {estado.mensaje && <p role="status" className="text-sm text-teal-700">{estado.mensaje}</p>}
      </div>
    </form>
  );
}

export function Adenda({ pacienteId, notaId }: { pacienteId: string; notaId: string }) {
  const [estado, accion, enviando] = useActionState<EstadoSimple, FormData>(agregarAdenda, INICIAL_SIMPLE);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-teal-700 hover:underline">Agregar adenda</summary>
      <form key={estado.intento} action={accion} className="mt-2 flex flex-col gap-2" noValidate>
        <input type="hidden" name="paciente_id" value={pacienteId} />
        <input type="hidden" name="nota_id" value={notaId} />
        <textarea name="texto" rows={2} maxLength={2000} aria-label="Texto de la adenda" defaultValue={estado.texto}
          placeholder="Lo que se agrega o corrige, con la fecha de hoy" className={ENTRADA} />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={enviando} className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50">
            {enviando ? "Guardando…" : "Guardar adenda"}
          </button>
          {estado.error && <p role="alert" className="text-xs text-red-700">{estado.error}</p>}
        </div>
      </form>
    </details>
  );
}

export function AnularEvolucion({ pacienteId, notaId, borrador }: { pacienteId: string; notaId: string; borrador: boolean }) {
  const [estado, accion, enviando] = useActionState<EstadoSimple, FormData>(anularEvolucion, INICIAL_SIMPLE);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-gray-600 hover:underline">{borrador ? "Anular borrador" : "Anular"}</summary>
      <form key={estado.intento} action={accion} className="mt-2 flex flex-wrap items-end gap-2" noValidate>
        <input type="hidden" name="paciente_id" value={pacienteId} />
        <input type="hidden" name="nota_id" value={notaId} />
        <input name="motivo" maxLength={200} defaultValue={estado.texto} aria-label="Motivo para anular la evolución"
          placeholder="Motivo (p. ej. abierta en el paciente equivocado)"
          className="min-w-64 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <button type="submit" disabled={enviando} className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50">
          {enviando ? "Anulando…" : "Confirmar anulación"}
        </button>
        {estado.error && <p role="alert" className="w-full text-xs text-red-700">{estado.error}</p>}
      </form>
    </details>
  );
}
