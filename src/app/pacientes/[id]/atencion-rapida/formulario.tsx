"use client";

import { useActionState } from "react";
import { FILAS_PROCEDIMIENTO, type CampoAtencion } from "@/lib/clinico/atencion-rapida";
import { registrarAtencion, type EstadoAtencion } from "./acciones";

const ENTRADA =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-base font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 aria-[invalid=true]:border-red-500";
const ETIQUETA = "flex flex-col gap-1 text-sm font-medium text-gray-700";

export type Previo = {
  alergias: string[]; anticoagulado: boolean; anticoagulante: string | null; medicacion: string | null; embarazo: string;
};

export function FormularioAtencionRapida({ pacienteId, previo, preguntarEmbarazo, procedimientos, conConsentimiento }: {
  pacienteId: string; previo: Previo | null; preguntarEmbarazo: boolean;
  procedimientos: { id: string; codigo: string; nombre: string }[]; conConsentimiento: string[];
}) {
  // Lo ya registrado en la historia se trae para confirmarlo con el paciente (no se adivina nada).
  const inicial: Record<string, string> = previo ? {
    alergias: previo.alergias.join(", "), alergias_ninguna: "",
    anticoagulado: previo.anticoagulado ? "si" : "no", anticoagulante: previo.anticoagulante ?? "",
    medicacion: previo.medicacion ?? "", embarazo: preguntarEmbarazo ? "" : "no_aplica",
  } : { embarazo: preguntarEmbarazo ? "" : "no_aplica" };
  const [estado, accion, enviando] = useActionState<EstadoAtencion, FormData>(registrarAtencion, {
    errores: {}, valores: inicial, intento: 0,
  });
  const v = estado.valores;
  const e = estado.errores;
  const t = (c: string) => v[c] ?? "";
  const error = (c: CampoAtencion) => e[c] ? <span className="text-xs font-normal text-red-700">{e[c]}</span> : null;
  const campo = (c: CampoAtencion, etiqueta: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className={ETIQUETA}>
      <label htmlFor={`ar-${c}`}>{etiqueta}</label>
      <input {...props} id={`ar-${c}`} name={c} defaultValue={t(c)} aria-invalid={!!e[c]} className={ENTRADA} />
      {error(c)}
    </div>
  );
  const area = (c: CampoAtencion, etiqueta: string, filas = 2) => (
    <div className={ETIQUETA}>
      <label htmlFor={`ar-${c}`}>{etiqueta}</label>
      <textarea id={`ar-${c}`} name={c} rows={filas} defaultValue={t(c)} aria-invalid={!!e[c]} className={ENTRADA} />
      {error(c)}
    </div>
  );
  const seccion = "mt-6 rounded-xl border border-gray-200 bg-white p-5";

  return (
    <form key={estado.intento} action={accion} className="flex flex-col" noValidate>
      <input type="hidden" name="paciente_id" value={pacienteId} />

      <section aria-labelledby="ar-t-historia" className={seccion}>
        <h2 id="ar-t-historia" className="mb-3 text-lg font-semibold">1. Anamnesis</h2>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          {area("motivo_consulta", "Motivo de consulta")}
          {campo("tiempo_enfermedad", "Tiempo de enfermedad", { placeholder: "p. ej. 3 días", maxLength: 100 })}
        </div>
        <fieldset className="mt-4 flex flex-col gap-2 text-sm font-medium text-gray-700">
          <legend>Alergias</legend>
          <input id="ar-alergias" name="alergias" defaultValue={t("alergias")} aria-label="Alergias (separadas por comas)"
            placeholder="p. ej. Penicilina, látex" aria-invalid={!!e.alergias} className={ENTRADA} />
          <label className="flex items-center gap-2 font-normal">
            <input type="checkbox" name="alergias_ninguna" value="1" defaultChecked={t("alergias_ninguna") === "1"} /> Ninguna conocida
          </label>
          {error("alergias")}
        </fieldset>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <fieldset className="flex flex-col gap-2 text-sm font-medium text-gray-700">
            <legend>¿Toma anticoagulantes?</legend>
            <div className="flex gap-4 pt-1">
              {(["no", "si"] as const).map((x) => (
                <label key={x} className="flex items-center gap-2 font-normal">
                  <input type="radio" name="anticoagulado" value={x} defaultChecked={t("anticoagulado") === x} /> {x === "si" ? "Sí" : "No"}
                </label>
              ))}
            </div>
            {error("anticoagulado")}
          </fieldset>
          {campo("anticoagulante", "¿Cuál? (si toma)", { maxLength: 200 })}
        </div>
        {preguntarEmbarazo ? (
          <fieldset className="mt-4 flex flex-col gap-2 text-sm font-medium text-gray-700">
            <legend>¿Embarazo?</legend>
            <div className="flex flex-wrap gap-4 pt-1">
              {([["no", "No"], ["si", "Sí"], ["no_sabe", "No sabe"]] as const).map(([x, texto]) => (
                <label key={x} className="flex items-center gap-2 font-normal">
                  <input type="radio" name="embarazo" value={x} defaultChecked={t("embarazo") === x} /> {texto}
                </label>
              ))}
            </div>
            {error("embarazo")}
          </fieldset>
        ) : <input type="hidden" name="embarazo" value="no_aplica" />}
        <div className="mt-4">{area("medicacion", "Medicación actual (opcional)")}</div>
      </section>

      <section aria-labelledby="ar-t-examen" className={seccion}>
        <h2 id="ar-t-examen" className="mb-3 text-lg font-semibold">2. Examen y diagnóstico</h2>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          {area("examen", "Examen (lo encontrado)", 3)}
          <div className={ETIQUETA}>
            <label htmlFor="ar-higiene">Higiene (opcional)</label>
            <select id="ar-higiene" name="higiene" defaultValue={t("higiene")} className={ENTRADA}>
              <option value="">—</option><option value="buena">Buena</option><option value="regular">Regular</option><option value="mala">Mala</option>
            </select>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {campo("cie10", "Diagnóstico CIE-10", { placeholder: "p. ej. K02.1", maxLength: 10 })}
          <fieldset className="flex flex-col gap-2 text-sm font-medium text-gray-700">
            <legend>Tipo</legend>
            <div className="flex gap-4 pt-1">
              {(["definitivo", "presuntivo"] as const).map((x) => (
                <label key={x} className="flex items-center gap-2 font-normal">
                  <input type="radio" name="tipo_dx" value={x} defaultChecked={(t("tipo_dx") || "definitivo") === x} />
                  {x === "definitivo" ? "Definitivo" : "Presuntivo"}
                </label>
              ))}
            </div>
          </fieldset>
          {campo("pieza_dx", "Pieza (opcional)", { inputMode: "numeric", maxLength: 2 })}
        </div>
      </section>

      <section aria-labelledby="ar-t-tratamiento" className={seccion}>
        <h2 id="ar-t-tratamiento" className="mb-3 text-lg font-semibold">3. Tratamiento realizado</h2>
        <div className="flex flex-col gap-3">
          {Array.from({ length: FILAS_PROCEDIMIENTO }, (_, n) => (
            <div key={n} className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <select name={`procedimiento_${n}`} defaultValue={t(`procedimiento_${n}`)} aria-label={`Procedimiento ${n + 1}`}
                className={ENTRADA}>
                <option value="">{n === 0 ? "Elegir procedimiento…" : "(otro procedimiento, opcional)"}</option>
                {procedimientos.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}
              </select>
              <input name={`piezas_${n}`} defaultValue={t(`piezas_${n}`)} aria-label={`Piezas del procedimiento ${n + 1}`}
                placeholder="Piezas (p. ej. 36 o 16, 26)" inputMode="numeric" className={ENTRADA} />
            </div>
          ))}
          {error("procedimientos")}
          {conConsentimiento.length > 0 && (
            <p className="text-xs text-gray-500">
              No aparecen porque requieren consentimiento informado firmado (flujo completo): {conConsentimiento.join(", ")}.
            </p>
          )}
        </div>
        <div className="mt-4">{area("descripcion", "Descripción de lo realizado", 3)}</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {campo("anestesia_tipo", "Anestesia (opcional)", { placeholder: "p. ej. infiltrativa, lidocaína 2 %", maxLength: 100 })}
          {campo("anestesia_cantidad", "Cantidad (opcional)", { placeholder: "p. ej. 1 cartucho", maxLength: 100 })}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {area("indicaciones", "Indicaciones (opcional)")}
          {campo("proxima_cita", "Próxima cita sugerida (opcional)", { maxLength: 200 })}
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enviando}
          onClick={(ev) => { if (!window.confirm("¿Firmar la atención? Después no se edita: solo admite adendas.")) ev.preventDefault(); }}
          className="rounded-md bg-teal-700 px-5 py-2.5 font-medium text-white hover:bg-teal-800 disabled:opacity-60">
          {enviando ? "Registrando…" : "Firmar atención"}
        </button>
        {(e.general || Object.keys(e).length > 0) && (
          <p role="alert" className="text-sm text-red-700">{e.general ?? "Revisa los campos marcados."}</p>
        )}
      </div>
    </form>
  );
}
