"use client";

import { useActionState } from "react";
import { guardarClave, type EstadoClave } from "./acciones";

const ENTRADA =
  "rounded-md border border-gray-300 px-3 py-2 text-base font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30";

export function FormularioClave() {
  const [estado, accion, enviando] = useActionState<EstadoClave, FormData>(guardarClave, { error: null });
  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Contraseña nueva
        <input name="clave" type="password" autoComplete="new-password" maxLength={72} className={ENTRADA} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Repite la contraseña
        <input name="repetir" type="password" autoComplete="new-password" maxLength={72} className={ENTRADA} />
      </label>
      <p className="text-xs text-gray-500">De 8 a 72 caracteres, con letras y números.</p>
      {estado.error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{estado.error}</p>}
      <button type="submit" disabled={enviando}
        className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60">
        {enviando ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
