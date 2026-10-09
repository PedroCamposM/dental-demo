"use client";

import { useActionState } from "react";
import {
  CAMPOS_EXTRAORAL, CAMPOS_INTRAORAL, HIGIENE, SUPERFICIES, TIPOS_DIAGNOSTICO, type CampoDiagnostico,
} from "@/lib/clinico/diagnostico";
import {
  agregarAdenda, anularRegistro, registrarDiagnostico, registrarExamen,
  type EstadoDiagnostico, type EstadoExamen, type EstadoSimple,
} from "./acciones";

const ENTRADA =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-base font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 aria-[invalid=true]:border-red-500";
const BOTON = "rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60";

// ---------------------------------------------------------------------------
// Examen clínico
// ---------------------------------------------------------------------------
export function FormularioExamen({ pacienteId }: { pacienteId: string }) {
  const [estado, accion, guardando] = useActionState<EstadoExamen, FormData>(registrarExamen, {
    errores: {}, mensaje: null, valores: {},
  });
  const e = estado.errores;
  const v = estado.valores;
  const campo = (c: string, etiqueta: string, filas = 1, placeholder = "Sin alteraciones") => (
    <div key={c} className="flex flex-col gap-1 text-sm font-medium text-gray-700">
      <label htmlFor={`x-${c}`}>{etiqueta}</label>
      <textarea id={`x-${c}`} name={c} rows={filas} defaultValue={v[c] ?? ""} placeholder={placeholder}
        aria-invalid={!!e[c as keyof typeof e]} className={ENTRADA} />
      {e[c as keyof typeof e] && <span className="text-xs font-normal text-red-700">{e[c as keyof typeof e]}</span>}
    </div>
  );
  return (
    // La `key` vuelve a montar el formulario con lo enviado si el servidor devuelve errores.
    <form key={JSON.stringify(v)} action={accion} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <p className="text-sm text-gray-500">Escribe solo lo observado. Lo que dejes en blanco queda «no registrado».</p>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-semibold">Extraoral</legend>
        {Object.entries(CAMPOS_EXTRAORAL).map(([c, t]) => campo(c, t))}
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-semibold">Intraoral</legend>
        {Object.entries(CAMPOS_INTRAORAL).map(([c, t]) =>
          campo(c, t, 1, c === "oclusion" ? "p. ej. Clase I de Angle" : "Sin alteraciones"))}
        <fieldset className="flex flex-col gap-2 text-sm font-medium text-gray-700">
          <legend>Higiene oral</legend>
          <div className="flex flex-wrap gap-4 pt-1">
            {[["", "Sin registrar"] as const, ...Object.entries(HIGIENE)].map(([op, t]) => (
              <label key={op} className="flex items-center gap-2 font-normal">
                <input type="radio" name="higiene" value={op} defaultChecked={(v.higiene ?? "") === op} />
                {t}
              </label>
            ))}
          </div>
          {e.higiene && <span className="text-xs font-normal text-red-700">{e.higiene}</span>}
        </fieldset>
      </fieldset>
      {campo("observaciones", "Observaciones", 2, "")}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={guardando} className={BOTON}>{guardando ? "Guardando…" : "Registrar examen"}</button>
        {e.general && <p role="alert" className="text-sm text-red-700">{e.general}</p>}
        {estado.mensaje && <p role="status" className="text-sm text-teal-700">{estado.mensaje}</p>}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Diagnóstico
// ---------------------------------------------------------------------------
export type InicialDiagnostico = {
  cie10?: string; tipo?: string; pieza?: string; superficies?: string[]; hallazgo_id?: string; confirma_id?: string;
  /** Texto que explica de dónde viene (hallazgo del odontograma o presuntivo a confirmar). */
  origen?: string;
};

export function FormularioDiagnostico({ pacienteId, opciones, inicial }: {
  pacienteId: string; opciones: { codigo: string; descripcion: string }[]; inicial: InicialDiagnostico;
}) {
  const vacio = { textos: {
    cie10: inicial.cie10 ?? "", tipo: inicial.tipo ?? "", pieza: inicial.pieza ?? "",
    hallazgo_id: inicial.hallazgo_id ?? "", confirma_id: inicial.confirma_id ?? "",
  }, superficies: inicial.superficies ?? [] };
  const [estado, accion, guardando] = useActionState<EstadoDiagnostico, FormData>(registrarDiagnostico, {
    errores: {}, mensaje: null, valores: vacio,
  });
  // Tras guardar, el formulario vuelve a quedar vacío (sin el origen).
  const v = estado.mensaje ? { textos: {}, superficies: [] } : estado.valores;
  const t = (c: string) => (v.textos as Record<string, string>)[c] ?? "";
  const e = estado.errores;
  const error = (c: CampoDiagnostico) =>
    e[c] ? <span id={`d-${c}-error`} className="text-xs font-normal text-red-700">{e[c]}</span> : null;
  const confirmando = !!t("confirma_id");
  return (
    <form key={JSON.stringify(v) + String(estado.mensaje)} action={accion} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <input type="hidden" name="hallazgo_id" value={t("hallazgo_id")} />
      <input type="hidden" name="confirma_id" value={t("confirma_id")} />
      {inicial.origen && !estado.mensaje && (
        <p className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-900">{inicial.origen}</p>
      )}
      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <label htmlFor="d-cie10">Código CIE-10 *</label>
        <input id="d-cie10" name="cie10" list="cie10-opciones" defaultValue={t("cie10")} autoComplete="off"
          placeholder="Escribe el código o una palabra: K02.1, caries, pulpitis…" aria-invalid={!!e.cie10}
          aria-describedby={e.cie10 ? "d-cie10-error" : "d-cie10-ayuda"} className={ENTRADA} />
        <datalist id="cie10-opciones">
          {opciones.map((o) => <option key={o.codigo} value={`${o.codigo} — ${o.descripcion}`} />)}
        </datalist>
        {!e.cie10 && <span id="d-cie10-ayuda" className="text-xs font-normal text-gray-500">
          Capítulo K00–K14 y códigos de uso odontológico. El sistema no sugiere diagnósticos.
        </span>}
        {error("cie10")}
      </div>
      <fieldset className="flex flex-col gap-2 text-sm font-medium text-gray-700">
        <legend>Tipo *</legend>
        <div className="flex flex-wrap gap-4 pt-1">
          {Object.entries(TIPOS_DIAGNOSTICO).map(([op, texto]) => (
            <label key={op} className="flex items-center gap-2 font-normal">
              <input type="radio" name="tipo" value={op} defaultChecked={t("tipo") === op}
                disabled={confirmando && op === "presuntivo"} />
              {texto}
            </label>
          ))}
        </div>
        {error("tipo")}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="d-pieza">Pieza (FDI)</label>
          <input id="d-pieza" name="pieza" inputMode="numeric" maxLength={2} defaultValue={t("pieza")} placeholder="p. ej. 36"
            aria-invalid={!!e.pieza} aria-describedby={e.pieza ? "d-pieza-error" : undefined} className={ENTRADA} />
          {error("pieza")}
        </div>
        <fieldset className="flex flex-col gap-2 text-sm font-medium text-gray-700">
          <legend>Superficies</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
            {Object.entries(SUPERFICIES).map(([op, texto]) => (
              <label key={op} className="flex items-center gap-2 font-normal">
                <input type="checkbox" name="superficies" value={op} defaultChecked={v.superficies.includes(op)} />
                {texto}
              </label>
            ))}
          </div>
          {error("superficies")}
        </fieldset>
      </div>
      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <label htmlFor="d-observacion">Observación</label>
        <textarea id="d-observacion" name="observacion" rows={2} maxLength={1000} defaultValue={t("observacion")}
          aria-invalid={!!e.observacion} className={ENTRADA} />
        {error("observacion")}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={guardando} className={BOTON}>
          {guardando ? "Guardando…" : confirmando ? "Confirmar diagnóstico" : "Registrar diagnóstico"}
        </button>
        {e.general && <p role="alert" className="text-sm text-red-700">{e.general}</p>}
        {estado.mensaje && <p role="status" className="text-sm text-teal-700">{estado.mensaje}</p>}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Adenda y anulación
// ---------------------------------------------------------------------------
export function Adenda({ pacienteId, diagnosticoId }: { pacienteId: string; diagnosticoId: string }) {
  const [estado, accion, enviando] = useActionState<EstadoSimple, FormData>(agregarAdenda, { error: null, ok: false });
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-teal-700 hover:underline">Agregar adenda</summary>
      <form key={String(estado.ok)} action={accion} className="mt-2 flex flex-col gap-2" noValidate>
        <input type="hidden" name="paciente_id" value={pacienteId} />
        <input type="hidden" name="diagnostico_id" value={diagnosticoId} />
        <textarea name="texto" rows={2} maxLength={2000} aria-label="Texto de la adenda"
          placeholder="Lo que se agrega o precisa (p. ej. resultado de la radiografía)" className={ENTRADA} />
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

export function Anular({ pacienteId, id, tabla, descripcion }: {
  pacienteId: string; id: string; tabla: "diagnostico" | "examen_clinico"; descripcion: string;
}) {
  const [estado, accion, enviando] = useActionState<EstadoSimple, FormData>(anularRegistro, { error: null, ok: false });
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-gray-600 hover:underline">Anular</summary>
      <form action={accion} className="mt-2 flex flex-wrap items-end gap-2" noValidate>
        <input type="hidden" name="paciente_id" value={pacienteId} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="tabla" value={tabla} />
        <input name="motivo" maxLength={200} aria-label={`Motivo para anular ${descripcion}`}
          placeholder="Motivo (p. ej. registrado en el paciente equivocado)"
          className="min-w-64 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <button type="submit" disabled={enviando} className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50">
          {enviando ? "Anulando…" : "Confirmar anulación"}
        </button>
        {estado.error && <p role="alert" className="w-full text-xs text-red-700">{estado.error}</p>}
      </form>
    </details>
  );
}
