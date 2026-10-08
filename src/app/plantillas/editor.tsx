"use client";

import { useRef, useState, useTransition } from "react";
import { MAX_CARACTERES, validarPlantilla, variablesDeEjemplo, type Variable } from "@/lib/plantillas";
import type { TipoSeguimiento } from "@/lib/tablero/mensajes";
import { rellenarPlantilla } from "@/lib/whatsapp";
import { guardarPlantilla } from "./acciones";

type Props = {
  tipo: TipoSeguimiento;
  titulo: string;
  variables: Variable[];
  id: string | null;
  cuerpoGuardado: string;
};

export function EditorPlantilla({ tipo, titulo, variables, id: idInicial, cuerpoGuardado }: Props) {
  const [id, setId] = useState(idInicial);
  const [guardado, setGuardado] = useState(cuerpoGuardado);
  const [cuerpo, setCuerpo] = useState(cuerpoGuardado);
  const [aviso, setAviso] = useState<{ ok: boolean; textos: string[] } | null>(null);
  const [guardando, iniciar] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);

  const errores = validarPlantilla(tipo, cuerpo);
  const cambiado = cuerpo !== guardado;
  const campo = `plantilla-${tipo}`;

  function insertar(nombre: string) {
    const el = area.current;
    const marca = `{{${nombre}}}`;
    const inicio = el?.selectionStart ?? cuerpo.length;
    const fin = el?.selectionEnd ?? cuerpo.length;
    setCuerpo(cuerpo.slice(0, inicio) + marca + cuerpo.slice(fin));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(inicio + marca.length, inicio + marca.length);
    });
  }

  function guardar() {
    iniciar(async () => {
      const r = await guardarPlantilla(id, tipo, cuerpo);
      if (r.ok) {
        setId(r.id);
        setGuardado(cuerpo);
        setAviso({ ok: true, textos: ["Plantilla guardada"] });
      } else {
        setAviso({ ok: false, textos: r.errores });
      }
    });
  }

  return (
    <section aria-labelledby={`${campo}-titulo`} className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 id={`${campo}-titulo`} className="text-lg font-semibold">{titulo}</h2>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <label htmlFor={campo} className="text-sm font-medium text-gray-700">Mensaje</label>
          <textarea
            id={campo}
            ref={area}
            value={cuerpo}
            onChange={(e) => { setCuerpo(e.target.value); setAviso(null); }}
            rows={6}
            maxLength={MAX_CARACTERES + 200}
            aria-invalid={errores.length > 0}
            aria-describedby={`${campo}-ayuda`}
            className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
          />
          <div id={`${campo}-ayuda`}>
            <p className="text-xs text-gray-500">
              {cuerpo.trim().length} / {MAX_CARACTERES} caracteres. Toca una variable para insertarla donde está el cursor:
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {variables.map((v) => (
                <button
                  key={v.nombre}
                  type="button"
                  onClick={() => insertar(v.nombre)}
                  title={v.descripcion}
                  className="rounded-full border border-gray-300 px-2.5 py-1 font-mono text-xs text-gray-700 hover:border-teal-600 hover:bg-teal-50"
                >
                  {`{{${v.nombre}}}`}
                </button>
              ))}
            </div>
          </div>
          {errores.length > 0 && (
            <ul className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {errores.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={guardar}
              disabled={guardando || !cambiado || errores.length > 0}
              className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
            {cambiado && (
              <button
                type="button"
                onClick={() => { setCuerpo(guardado); setAviso(null); }}
                className="text-sm text-gray-600 hover:underline"
              >
                Deshacer cambios
              </button>
            )}
            {aviso && (
              <span role="status" className={`text-sm ${aviso.ok ? "text-teal-700" : "text-red-700"}`}>
                {aviso.textos.join(" ")}
              </span>
            )}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700">Vista previa con datos de ejemplo</p>
          <div className="mt-2 whitespace-pre-wrap rounded-lg rounded-tl-none bg-[#dcf8c6] p-3 text-sm text-gray-900 shadow-sm">
            {cuerpo.trim() ? rellenarPlantilla(cuerpo, variablesDeEjemplo(tipo)) : "…"}
          </div>
        </div>
      </div>
    </section>
  );
}
