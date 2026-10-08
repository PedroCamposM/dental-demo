"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cerrarPorInactividad, desbloquear } from "@/app/sesion/acciones";
import {
  COOKIE_ACTIVIDAD, COOKIE_LIMITE, estadoInactividad, type EstadoInactividad,
} from "@/lib/sesion-segura/inactividad";

const CLAVE_ACTIVIDAD = "dental:ultima-actividad";
const CLAVE_BLOQUEO = "dental:bloqueado";
const EVENTOS = ["pointerdown", "keydown", "touchstart", "wheel", "pointermove"] as const;

// El almacenamiento puede no estar disponible (modo privado): nunca debe romper la página.
function leer(almacen: "local" | "session", clave: string): string | null {
  try { return (almacen === "local" ? localStorage : sessionStorage).getItem(clave); } catch { return null; }
}
function escribir(almacen: "local" | "session", clave: string, valor: string | null) {
  try {
    const s = almacen === "local" ? localStorage : sessionStorage;
    if (valor === null) s.removeItem(clave); else s.setItem(clave, valor);
  } catch { /* sin almacenamiento: el estado vive solo en esta pestaña */ }
}

/**
 * Cierra la sesión tras `minutos` sin actividad (avisa el último minuto) y ofrece
 * bloquear la pantalla, que pide la contraseña para volver. La última actividad se
 * comparte entre pestañas para que una pestaña olvidada no cierre la que se usa.
 */
export function ControlSesion({ minutos }: { minutos: number }) {
  const ultima = useRef(Date.now());
  const cerrando = useRef(false);
  const [estado, setEstado] = useState<EstadoInactividad>({ tipo: "activa" });
  const [bloqueado, setBloqueado] = useState(false);

  const registrarActividad = useCallback(() => {
    const ahora = Date.now();
    if (ahora - ultima.current < 2000) return;   // sin escribir en cada movimiento
    ultima.current = ahora;
    escribir("local", CLAVE_ACTIVIDAD, String(ahora));
    document.cookie = `${COOKIE_ACTIVIDAD}=${ahora}; path=/; samesite=lax`;
  }, []);

  useEffect(() => {
    setBloqueado(leer("session", CLAVE_BLOQUEO) === "1");
    document.cookie = `${COOKIE_LIMITE}=${minutos}; path=/; samesite=lax; max-age=31536000`;
    escribir("local", CLAVE_ACTIVIDAD, String(ultima.current));
    for (const e of EVENTOS) window.addEventListener(e, registrarActividad, { passive: true });
    const reloj = setInterval(() => {
      const compartida = Number(leer("local", CLAVE_ACTIVIDAD) ?? 0);
      if (compartida > ultima.current) ultima.current = compartida;
      const nuevo = estadoInactividad(ultima.current, Date.now(), minutos);
      setEstado(nuevo);
      if (nuevo.tipo === "expirada" && !cerrando.current) {
        cerrando.current = true;
        escribir("session", CLAVE_BLOQUEO, null);
        void cerrarPorInactividad();
      }
    }, 1000);
    return () => {
      clearInterval(reloj);
      for (const e of EVENTOS) window.removeEventListener(e, registrarActividad);
    };
  }, [minutos, registrarActividad]);

  function bloquear() {
    escribir("session", CLAVE_BLOQUEO, "1");
    setBloqueado(true);
  }

  return (
    <>
      <button
        type="button" onClick={bloquear}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
      >
        Bloquear pantalla
      </button>
      {estado.tipo === "aviso" && !bloqueado && (
        <div role="alertdialog" aria-labelledby="aviso-inactividad"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-md rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-lg">
          <p id="aviso-inactividad" className="font-medium text-amber-900">
            Tu sesión se cerrará en {estado.segundosRestantes} s por inactividad.
          </p>
          <button type="button" onClick={() => { ultima.current = 0; registrarActividad(); }}
            className="mt-2 rounded-md bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800">
            Seguir trabajando
          </button>
        </div>
      )}
      {bloqueado && <PantallaBloqueada alDesbloquear={() => { escribir("session", CLAVE_BLOQUEO, null); setBloqueado(false); }} />}
    </>
  );
}

function PantallaBloqueada({ alDesbloquear }: { alDesbloquear: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(formulario: FormData) {
    setEnviando(true);
    const r = await desbloquear(String(formulario.get("password") ?? ""));
    setEnviando(false);
    if (r.ok) alDesbloquear(); else setError(r.error);
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="titulo-bloqueo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-white p-4">
      <form action={enviar} className="w-full max-w-sm rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 id="titulo-bloqueo" className="text-xl font-semibold">Pantalla bloqueada</h2>
        <p className="mt-1 text-sm text-gray-600">Ingresa tu contraseña para continuar.</p>
        <label className="mt-4 flex flex-col gap-1 text-sm font-medium">
          Contraseña
          <input name="password" type="password" autoComplete="current-password" autoFocus required
            className="rounded-md border border-gray-300 px-3 py-2 text-base font-normal" />
        </label>
        {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={enviando}
          className="mt-4 w-full rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60">
          {enviando ? "Verificando…" : "Desbloquear"}
        </button>
      </form>
    </div>
  );
}
