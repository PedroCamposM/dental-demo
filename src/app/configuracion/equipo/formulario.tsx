"use client";

import { useActionState } from "react";
import type { CampoInvitacion, RolEquipo } from "@/lib/equipo";
import { cambiarEstado, invitar, reenviarAcceso, type EstadoAccion, type EstadoInvitacion } from "./acciones";

const ENTRADA =
  "rounded-md border border-gray-300 px-3 py-2 text-base font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 aria-[invalid=true]:border-red-500";
const NOMBRE_ROL: Record<RolEquipo, string> = {
  odontologo: "Odontólogo (con COP)", asistente: "Asistente", recepcion: "Recepción", admin: "Administrador",
};

export function FormularioInvitar() {
  const [estado, accion, enviando] = useActionState<EstadoInvitacion, FormData>(invitar, {
    errores: {}, valores: {}, mensaje: null, exitos: 0,
  });
  const e = estado.errores;
  const v = estado.valores;
  const error = (c: CampoInvitacion) => e[c] ? <span className="text-xs font-normal text-red-700">{e[c]}</span> : null;
  return (
    <form key={estado.exitos} action={accion} aria-label="Invitar al equipo" className="grid gap-4 sm:grid-cols-2" noValidate>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Correo
        <input name="correo" type="email" defaultValue={v.correo ?? ""} maxLength={200} aria-invalid={!!e.correo} className={ENTRADA} />
        {error("correo")}
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Nombre
        <input name="nombre" defaultValue={v.nombre ?? ""} maxLength={120} aria-invalid={!!e.nombre} className={ENTRADA} />
        {error("nombre")}
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Rol
        <select name="rol" defaultValue={v.rol || "asistente"} aria-invalid={!!e.rol} className={ENTRADA}>
          {(Object.keys(NOMBRE_ROL) as RolEquipo[]).map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
        </select>
        {error("rol")}
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        N.º de colegiatura (COP)
        <input name="cop" defaultValue={v.cop ?? ""} inputMode="numeric" maxLength={6} aria-invalid={!!e.cop} className={ENTRADA}
          placeholder="Obligatorio para odontólogos" />
        {error("cop")}
      </label>
      <p className="text-xs text-gray-500 sm:col-span-2">
        Odontólogo: registra y firma la historia clínica. Asistente: la ve y ayuda (signos vitales, imágenes). Recepción: pacientes,
        agenda y cobros, sin ver lo clínico. Administrador: todo lo de gestión; con COP, también lo clínico.
      </p>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={enviando}
          className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60">
          {enviando ? "Enviando…" : "Enviar invitación"}
        </button>
        {e.general && <p role="alert" className="text-sm text-red-700">{e.general}</p>}
        {estado.mensaje && <p role="status" className="text-sm text-teal-800">{estado.mensaje}</p>}
      </div>
    </form>
  );
}

export function AccionesUsuario({ id, nombre, correo, activo, pendiente }: {
  id: string; nombre: string; correo: string | null; activo: boolean; pendiente: boolean;
}) {
  const [estado, accion, enviando] = useActionState<EstadoAccion, FormData>(cambiarEstado, { error: null, mensaje: null });
  const [reenvio, accionReenvio, reenviando] = useActionState<EstadoAccion, FormData>(reenviarAcceso, { error: null, mensaje: null });
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {activo && correo && (
        <form action={accionReenvio}>
          <input type="hidden" name="correo" value={correo} />
          <button type="submit" disabled={reenviando} aria-label={`Reenviar acceso a ${nombre}`}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-60">
            {pendiente ? "Reenviar invitación" : "Enviar enlace de contraseña"}
          </button>
        </form>
      )}
      <form action={accion}>
        <input type="hidden" name="usuario_id" value={id} />
        <input type="hidden" name="activar" value={activo ? "0" : "1"} />
        <button type="submit" disabled={enviando} aria-label={`${activo ? "Desactivar" : "Reactivar"} a ${nombre}`}
          onClick={(ev) => { if (activo && !window.confirm(`¿Desactivar a ${nombre}? Ya no podrá entrar (no se borra nada).`)) ev.preventDefault(); }}
          className={`rounded-md border px-2 py-1 text-xs disabled:opacity-60 ${activo ? "border-red-300 text-red-700 hover:bg-red-50" : "border-gray-300 hover:bg-gray-50"}`}>
          {activo ? "Desactivar" : "Reactivar"}
        </button>
      </form>
      {(estado.error || reenvio.error) && <p role="alert" className="w-full text-right text-xs text-red-700">{estado.error ?? reenvio.error}</p>}
      {(estado.mensaje || reenvio.mensaje) && <p role="status" className="w-full text-right text-xs text-teal-800">{estado.mensaje ?? reenvio.mensaje}</p>}
    </div>
  );
}
