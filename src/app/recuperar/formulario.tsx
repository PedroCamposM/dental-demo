"use client";

import { useActionState } from "react";
import { recuperar, type EstadoRecuperar } from "./acciones";

export function FormularioRecuperar() {
  const [estado, accion, enviando] = useActionState<EstadoRecuperar, FormData>(recuperar, { enviado: false, error: null, correo: "" });
  if (estado.enviado) {
    return (
      <p role="status" className="rounded-md bg-teal-50 px-3 py-3 text-sm text-teal-900">
        Si <strong>{estado.correo}</strong> tiene una cuenta, te enviamos un enlace para crear una contraseña nueva.
        Revisa también la carpeta de spam.
      </p>
    );
  }
  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Correo
        <input name="correo" type="email" autoComplete="username" defaultValue={estado.correo}
          className="rounded-md border border-gray-300 px-3 py-2 text-base font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30" />
      </label>
      {estado.error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{estado.error}</p>}
      <button type="submit" disabled={enviando}
        className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60">
        {enviando ? "Enviando…" : "Enviar enlace"}
      </button>
    </form>
  );
}
