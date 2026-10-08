"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { bloquearPantalla, cerrarPorInactividad, desbloquear } from "@/app/sesion/acciones";
import {
  COOKIE_ACTIVIDAD, COOKIE_LIMITE, DURACION_COOKIE_S, estadoInactividad, type EstadoInactividad,
} from "@/lib/sesion-segura/inactividad";

const CLAVE_ACTIVIDAD = "dental:ultima-actividad";
const CLAVE_BLOQUEO = "dental:bloqueo";   // aviso entre pestañas; la fuente de verdad es la cookie del servidor
const EVENTOS = ["pointerdown", "keydown", "touchstart", "wheel", "pointermove"] as const;

// El almacenamiento puede no estar disponible (modo privado): nunca debe romper la página.
function leer(clave: string): string | null {
  try { return localStorage.getItem(clave); } catch { return null; }
}
function escribir(clave: string, valor: string) {
  try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento: solo esta pestaña */ }
}

type Props = {
  minutos: number;
  /** La pantalla ya estaba bloqueada (cookie del servidor): también en pestañas nuevas. */
  bloqueadoInicial: boolean;
  /** Hora del servidor al renderizar: corrige relojes de tablets adelantados o atrasados. */
  ahoraServidor: number;
};

/**
 * Cierra la sesión tras `minutos` sin actividad (avisa el último minuto) y ofrece
 * bloquear la pantalla, que pide la contraseña para volver. La última actividad se
 * comparte entre pestañas y con el servidor (cookie), en hora del servidor.
 */
export function ControlSesion({ minutos, bloqueadoInicial, ahoraServidor }: Props) {
  const desfase = useRef(0);
  const ultima = useRef(0);
  const cerrando = useRef(false);
  const [estado, setEstado] = useState<EstadoInactividad>({ tipo: "activa" });
  const [bloqueado, setBloqueado] = useState(bloqueadoInicial);

  const ahora = () => Date.now() + desfase.current;

  const registrarActividad = useCallback((forzar = false) => {
    const t = Date.now() + desfase.current;
    if (!forzar && t - ultima.current < 2000) return;   // sin escribir en cada movimiento
    ultima.current = t;
    escribir(CLAVE_ACTIVIDAD, String(t));
    document.cookie = `${COOKIE_ACTIVIDAD}=${t}; path=/; samesite=lax; max-age=${DURACION_COOKIE_S}`;
  }, []);

  useEffect(() => {
    desfase.current = ahoraServidor - Date.now();
    registrarActividad(true);
    document.cookie = `${COOKIE_LIMITE}=${minutos}; path=/; samesite=lax; max-age=31536000`;
    const alActuar = () => registrarActividad();
    for (const e of EVENTOS) window.addEventListener(e, alActuar, { passive: true });
    const alCambiarOtraPestana = (e: StorageEvent) => {
      if (e.key === CLAVE_BLOQUEO && e.newValue?.startsWith("1")) setBloqueado(true);
      if (e.key === CLAVE_BLOQUEO && e.newValue?.startsWith("0")) setBloqueado(false);
    };
    window.addEventListener("storage", alCambiarOtraPestana);
    const reloj = setInterval(() => {
      const compartida = Number(leer(CLAVE_ACTIVIDAD) ?? 0);
      if (compartida > ultima.current) ultima.current = compartida;
      const nuevo = estadoInactividad(ultima.current, Date.now() + desfase.current, minutos);
      setEstado(nuevo);
      if (nuevo.tipo === "expirada" && !cerrando.current) {
        cerrando.current = true;
        void cerrarPorInactividad();
      }
    }, 1000);
    return () => {
      clearInterval(reloj);
      for (const e of EVENTOS) window.removeEventListener(e, alActuar);
      window.removeEventListener("storage", alCambiarOtraPestana);
    };
  }, [minutos, ahoraServidor, registrarActividad]);

  async function bloquear() {
    setBloqueado(true);
    escribir(CLAVE_BLOQUEO, `1:${ahora()}`);
    await bloquearPantalla();
  }

  function alDesbloquear() {
    escribir(CLAVE_BLOQUEO, `0:${ahora()}`);
    setBloqueado(false);
    registrarActividad(true);
  }

  return (
    <>
      <button
        type="button" onClick={() => void bloquear()}
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
          <button type="button" onClick={() => registrarActividad(true)}
            className="mt-2 rounded-md bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800">
            Seguir trabajando
          </button>
        </div>
      )}
      {bloqueado && <PantallaBloqueada alDesbloquear={alDesbloquear} />}
    </>
  );
}

function PantallaBloqueada({ alDesbloquear }: { alDesbloquear: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [destino, setDestino] = useState<HTMLElement | null>(null);

  // Se monta directo en <body> y todo lo demás queda inerte: con Tab no se llega a
  // enlaces ni botones de la página que queda debajo.
  useEffect(() => {
    const capa = document.createElement("div");
    document.body.appendChild(capa);
    const otros = Array.from(document.body.children).filter((n): n is HTMLElement => n !== capa && n instanceof HTMLElement);
    for (const n of otros) n.inert = true;
    setDestino(capa);
    return () => {
      for (const n of otros) n.inert = false;
      capa.remove();
    };
  }, []);

  async function enviar(formulario: FormData) {
    setEnviando(true);
    const r = await desbloquear(String(formulario.get("password") ?? ""));
    setEnviando(false);
    if (r.ok) alDesbloquear(); else setError(r.error);
  }

  const contenido = (
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
  // Antes de montar (render del servidor) se muestra igual, para no dejar ver la página.
  return destino ? createPortal(contenido, destino) : contenido;
}
