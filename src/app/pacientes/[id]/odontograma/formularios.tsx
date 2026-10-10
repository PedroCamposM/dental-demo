"use client";

import { useActionState, useState } from "react";
import { SUPERFICIES } from "@/lib/clinico/diagnostico";
import {
  DENTICIONES, SIGNIFICADO_SIGLAS, TIPOS_ODONTOGRAMA, type CampoHallazgo, type ItemCatalogo,
} from "@/lib/odontograma/hallazgo";
import {
  agregarHallazgo, anularHallazgo, crearOdontograma, type EstadoAnular, type EstadoHallazgo, type EstadoNuevo,
} from "./acciones";

const ENTRADA =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-base font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 aria-[invalid=true]:border-red-500";
const BOTON = "rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60";

// ---------------------------------------------------------------------------
// Nuevo odontograma
// ---------------------------------------------------------------------------
export function NuevoOdontograma({ pacienteId, tipoSugerido, denticionSugerida, anterior }: {
  pacienteId: string; tipoSugerido: keyof typeof TIPOS_ODONTOGRAMA; denticionSugerida: keyof typeof DENTICIONES;
  anterior: { id: string; descripcion: string } | null;
}) {
  const [estado, accion, guardando] = useActionState<EstadoNuevo, FormData>(crearOdontograma, {
    error: null, valores: { tipo: tipoSugerido, denticion: denticionSugerida, copiar_de: anterior?.id ?? "" },
  });
  const v = estado.valores;
  return (
    <form key={JSON.stringify(v)} action={accion} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="o-tipo">Tipo</label>
          <select id="o-tipo" name="tipo" defaultValue={v.tipo} className={ENTRADA}>
            {Object.entries(TIPOS_ODONTOGRAMA).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="o-denticion">Dentición</label>
          <select id="o-denticion" name="denticion" defaultValue={v.denticion} className={ENTRADA}>
            {Object.entries(DENTICIONES).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="o-especificaciones">Especificaciones</label>
          <textarea id="o-especificaciones" name="especificaciones" rows={2} maxLength={1000} defaultValue={v.especificaciones ?? ""}
            placeholder="Lo que no cabe en los recuadros (p. ej. fluorosis y su clasificación, color del metal)" className={ENTRADA} />
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="o-observaciones">Observaciones</label>
          <textarea id="o-observaciones" name="observaciones" rows={2} maxLength={1000} defaultValue={v.observaciones ?? ""}
            placeholder="Hallazgos que no están en la nomenclatura de la norma" className={ENTRADA} />
        </div>
      </div>
      {anterior && (
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" name="copiar_de" value={anterior.id} defaultChecked={!!v.copiar_de} className="mt-1" />
          <span>Partir de los hallazgos vigentes del {anterior.descripcion} (el anterior no cambia; anula en el nuevo lo que ya no esté).</span>
        </label>
      )}
      <p className="text-xs text-gray-500">
        Los hallazgos no se editan (NTS 188, 5.6): si algo cambió, se registra en un odontograma nuevo.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={guardando} className={BOTON}>{guardando ? "Creando…" : "Crear odontograma"}</button>
        {estado.error && <p role="alert" className="text-sm text-red-700">{estado.error}</p>}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Agregar hallazgo
// ---------------------------------------------------------------------------
const NOMBRE_AMBITO = {
  pieza: "por pieza", superficie: "por superficie", rango: "de una pieza a otra", entre_piezas: "entre dos piezas", arcada: "por arcada",
} as const;

export function FormularioHallazgo({ pacienteId, odontogramaId, catalogo, pieza }: {
  pacienteId: string; odontogramaId: string; catalogo: ItemCatalogo[]; pieza: number | null;
}) {
  const [estado, accion, guardando] = useActionState<EstadoHallazgo, FormData>(agregarHallazgo, {
    errores: {}, mensaje: null, intento: 0,
    valores: { textos: { pieza: pieza ? String(pieza) : "" }, superficies: [], siglas: [] },
  });
  const v = estado.valores;
  const [codigo, setCodigo] = useState(v.textos.hallazgo_codigo ?? "");
  const c = catalogo.find((x) => x.codigo === codigo);
  const e = estado.errores;
  const t = (k: string) => v.textos[k] ?? "";
  const error = (k: CampoHallazgo) => e[k] ? <span className="text-xs font-normal text-red-700">{e[k]}</span> : null;
  const piezaInicial = t("pieza") || (pieza ? String(pieza) : "");

  return (
    <form key={JSON.stringify(v) + String(estado.mensaje) + estado.intento} action={accion} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <input type="hidden" name="odontograma_id" value={odontogramaId} />
      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <label htmlFor="h-codigo">Hallazgo (NTS 188, 6.1)</label>
        {/* No controlado: React 19 reinicia el formulario tras cada envío y un select controlado quedaría en «Elegir…». */}
        <select id="h-codigo" name="hallazgo_codigo" defaultValue={codigo} onChange={(ev) => setCodigo(ev.target.value)}
          aria-invalid={!!e.hallazgo_codigo} className={ENTRADA}>
          <option value="">Elegir…</option>
          {catalogo.map((x) => <option key={x.codigo} value={x.codigo}>{x.numeral} {x.nombre}</option>)}
        </select>
        {c && (
          <span className="text-xs font-normal text-gray-500">
            Se registra {NOMBRE_AMBITO[c.ambito]}. Color: {c.color === "segun_estado" ? "azul si está en buen estado, rojo si está en mal estado" : c.color}.
          </span>
        )}
        {error("hallazgo_codigo")}
      </div>

      {c && c.ambito !== "arcada" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            <label htmlFor="h-pieza">{c.ambito === "rango" || c.ambito === "entre_piezas" ? "Desde la pieza" : "Pieza"}</label>
            <input id="h-pieza" name="pieza" inputMode="numeric" maxLength={2} defaultValue={piezaInicial}
              aria-invalid={!!e.pieza} className={ENTRADA} />
            {error("pieza")}
          </div>
          {(c.ambito === "rango" || c.ambito === "entre_piezas") && (
            <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              <label htmlFor="h-pieza_hasta">{c.ambito === "rango" ? "Hasta la pieza" : "Y la pieza"}</label>
              <input id="h-pieza_hasta" name="pieza_hasta" inputMode="numeric" maxLength={2} defaultValue={t("pieza_hasta")}
                aria-invalid={!!e.pieza_hasta} className={ENTRADA} />
              {error("pieza_hasta")}
            </div>
          )}
        </div>
      )}

      {c?.ambito === "arcada" && (
        <fieldset className="flex flex-col gap-2 text-sm font-medium text-gray-700">
          <legend>Arcada</legend>
          <div className="flex gap-4 pt-1">
            {(["superior", "inferior"] as const).map((a) => (
              <label key={a} className="flex items-center gap-2 font-normal">
                <input type="radio" name="arcada" value={a} defaultChecked={t("arcada") === a} /> {a === "superior" ? "Superior" : "Inferior"}
              </label>
            ))}
          </div>
          {error("arcada")}
        </fieldset>
      )}

      {c?.ambito === "superficie" && (
        <fieldset className="flex flex-col gap-2 text-sm font-medium text-gray-700">
          <legend>Superficies</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
            {Object.entries(SUPERFICIES).map(([k, texto]) => (
              <label key={k} className="flex items-center gap-2 font-normal">
                <input type="checkbox" name="superficies" value={k} defaultChecked={v.superficies.includes(k)} /> {texto}
              </label>
            ))}
          </div>
          {error("superficies")}
        </fieldset>
      )}

      {c && c.siglas.length > 0 && (
        <fieldset className="flex flex-col gap-2 text-sm font-medium text-gray-700">
          <legend>Sigla{c.multiples_siglas ? "s" : ""}{c.sigla_obligatoria ? "" : " (opcional)"}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
            {c.siglas.map((s) => (
              <label key={s} className="flex items-center gap-2 font-normal">
                <input type={c.multiples_siglas ? "checkbox" : "radio"} name="siglas" value={s} defaultChecked={v.siglas.includes(s)} />
                <span><b>{s}</b> <span className="text-gray-500">{SIGNIFICADO_SIGLAS[s] ?? ""}</span></span>
              </label>
            ))}
          </div>
          {error("siglas")}
        </fieldset>
      )}

      {c?.color === "segun_estado" && (
        <fieldset className="flex flex-col gap-2 text-sm font-medium text-gray-700">
          <legend>Estado</legend>
          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-2 font-normal">
              <input type="radio" name="estado" value="bueno" defaultChecked={t("estado") === "bueno"} />
              <span className="text-blue-700">Buen estado (azul)</span>
            </label>
            <label className="flex items-center gap-2 font-normal">
              <input type="radio" name="estado" value="malo" defaultChecked={t("estado") === "malo"} />
              <span className="text-red-700">Mal estado (rojo)</span>
            </label>
          </div>
          {error("estado")}
        </fieldset>
      )}

      {c?.requiere_grado && (
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="h-grado">Grado de movilidad</label>
          <input id="h-grado" name="grado" inputMode="numeric" maxLength={1} defaultValue={t("grado")}
            aria-invalid={!!e.grado} className={`${ENTRADA} w-24`} />
          {error("grado")}
        </div>
      )}

      {c && (
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="h-especificacion">Especificación (opcional)</label>
          <input id="h-especificacion" name="especificacion" maxLength={300} defaultValue={t("especificacion")} className={ENTRADA} />
          {error("especificacion")}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={guardando || !c} className={BOTON}>{guardando ? "Guardando…" : "Agregar hallazgo"}</button>
        {e.general && <p role="alert" className="text-sm text-red-700">{e.general}</p>}
        {estado.mensaje && <p role="status" className="text-sm text-teal-700">{estado.mensaje}</p>}
      </div>
    </form>
  );
}

export function AnularHallazgo({ pacienteId, id, descripcion }: { pacienteId: string; id: string; descripcion: string }) {
  const [estado, accion, enviando] = useActionState<EstadoAnular, FormData>(anularHallazgo, { error: null, intento: 0, texto: "" });
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-gray-600 hover:underline">Anular</summary>
      <form key={estado.intento} action={accion} className="mt-2 flex flex-wrap items-end gap-2" noValidate>
        <input type="hidden" name="paciente_id" value={pacienteId} />
        <input type="hidden" name="id" value={id} />
        <input name="motivo" maxLength={200} defaultValue={estado.texto} aria-label={`Motivo para anular ${descripcion}`} placeholder="Motivo"
          className="min-w-48 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <button type="submit" disabled={enviando} className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50">
          {enviando ? "Anulando…" : "Confirmar anulación"}
        </button>
        {estado.error && <p role="alert" className="w-full text-xs text-red-700">{estado.error}</p>}
      </form>
    </details>
  );
}
