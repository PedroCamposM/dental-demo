"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { CampoRegistro } from "@/lib/prueba";
import { registrarse, type EstadoRegistro } from "./acciones";

const ENTRADA =
  "rounded-md border border-gray-300 px-3 py-2 text-base font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 aria-[invalid=true]:border-red-500";

export function FormularioRegistro() {
  const [estado, accion, enviando] = useActionState<EstadoRegistro, FormData>(registrarse, {
    errores: {}, valores: {}, enviadoA: null,
  });
  if (estado.enviadoA) {
    return (
      <p role="status" className="rounded-md bg-teal-50 px-3 py-3 text-sm text-teal-900">
        Te enviamos un correo a <strong>{estado.enviadoA}</strong>. Abre el enlace para confirmar tu cuenta y crear tu clínica.
        Si no llega en unos minutos, revisa la carpeta de spam.
      </p>
    );
  }
  const e = estado.errores;
  const v = estado.valores;
  const error = (c: CampoRegistro) => e[c]
    ? <span id={`r-${c}-error`} className="text-xs font-normal text-red-700">{e[c]}</span> : null;
  const campo = (c: CampoRegistro, etiqueta: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {etiqueta}
      <input {...props} name={c} defaultValue={c === "password" ? undefined : v[c] ?? ""} aria-invalid={!!e[c]}
        aria-describedby={e[c] ? `r-${c}-error` : undefined} className={ENTRADA} />
      {error(c)}
    </label>
  );
  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      {campo("clinica", "Nombre de la clínica o consultorio", { maxLength: 120, autoComplete: "organization" })}
      {campo("nombre", "Tu nombre", { maxLength: 120, autoComplete: "name" })}
      {campo("cop", "N.º de colegiatura (COP), si eres cirujano dentista", { inputMode: "numeric", maxLength: 6 })}
      {campo("email", "Correo", { type: "email", autoComplete: "username", maxLength: 200 })}
      {campo("password", "Contraseña", { type: "password", autoComplete: "new-password", maxLength: 72 })}
      <div className="flex flex-col gap-1 text-sm">
        <label className="flex items-start gap-2">
          <input type="checkbox" name="acepta" value="1" defaultChecked={v.acepta === "1"} aria-invalid={!!e.acepta} className="mt-1" />
          <span>
            Acepto los <Link href="/terminos" target="_blank" className="font-medium text-teal-700 hover:underline">términos
            y la política de privacidad</Link>.
          </span>
        </label>
        {error("acepta")}
      </div>
      {e.general && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{e.general}</p>}
      <button type="submit" disabled={enviando}
        className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60">
        {enviando ? "Creando cuenta…" : "Crear cuenta"}
      </button>
    </form>
  );
}
