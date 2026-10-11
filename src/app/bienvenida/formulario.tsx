"use client";

import { useActionState } from "react";
import { crearMiClinica, type EstadoBienvenida } from "./acciones";

const ENTRADA =
  "rounded-md border border-gray-300 px-3 py-2 text-base font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 aria-[invalid=true]:border-red-500";

export function FormularioBienvenida({ valores }: { valores: Record<string, string> }) {
  const [estado, accion, enviando] = useActionState<EstadoBienvenida, FormData>(crearMiClinica, { errores: {}, valores });
  const e = estado.errores;
  const campo = (c: "clinica" | "nombre" | "cop", etiqueta: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {etiqueta}
      <input {...props} name={c} defaultValue={estado.valores[c] ?? ""} aria-invalid={!!e[c]} className={ENTRADA} />
      {e[c] && <span className="text-xs font-normal text-red-700">{e[c]}</span>}
    </label>
  );
  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      {campo("clinica", "Nombre de la clínica o consultorio", { maxLength: 120 })}
      {campo("nombre", "Tu nombre", { maxLength: 120 })}
      {campo("cop", "N.º de colegiatura (COP), si eres cirujano dentista", { inputMode: "numeric", maxLength: 6 })}
      <p className="text-xs text-gray-500">Sin COP entras como administrador: gestionas la clínica, pero no ves ni registras la historia clínica.</p>
      {e.general && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{e.general}</p>}
      <button type="submit" disabled={enviando}
        className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60">
        {enviando ? "Creando tu clínica…" : "Crear mi clínica"}
      </button>
    </form>
  );
}
