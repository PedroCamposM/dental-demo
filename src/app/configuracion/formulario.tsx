"use client";

import { useActionState, useState } from "react";
import { CONTRASTE_MINIMO, contraste, MAX_LOGO_BYTES, TIPOS_LOGO } from "@/lib/marca";
import { guardarInactividad, guardarMarca, type EstadoConfiguracion, type EstadoMarca } from "./acciones";

export function FormularioInactividad({ minutos }: { minutos: number }) {
  const [estado, accion, guardando] = useActionState<EstadoConfiguracion, FormData>(guardarInactividad, {
    mensaje: null, error: null,
  });
  return (
    <form action={accion} className="flex flex-col gap-3" noValidate>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Cerrar la sesión tras estos minutos sin actividad
        <input
          name="inactividad_minutos" type="number" min={5} max={120} step={1} defaultValue={minutos} required
          className="w-32 rounded-md border border-gray-300 px-3 py-2 text-base font-normal"
        />
        <span className="text-xs font-normal text-gray-500">Entre 5 y 120. Se avisa un minuto antes.</span>
      </label>
      {estado.error && <p role="alert" className="text-sm text-red-700">{estado.error}</p>}
      {estado.mensaje && <p role="status" className="text-sm text-teal-700">{estado.mensaje}</p>}
      <button type="submit" disabled={guardando}
        className="self-start rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60">
        {guardando ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}

/** Etapa 15: color, logo y membrete de la clínica. */
export function FormularioMarca({ valores, logo }: {
  valores: { color_marca: string | null; direccion: string | null; telefono: string | null; correo: string | null; pie_documentos: string | null };
  logo: string | null;
}) {
  const [estado, accion, guardando] = useActionState<EstadoMarca, FormData>(guardarMarca, {
    mensaje: null, errores: {}, intento: 0, valores: null,
  });
  return <CamposMarca key={estado.intento} {...{ estado, accion, guardando, valores, logo }} />;
}

/** Remontado en cada envío: si hubo error, vuelve con lo que se envió; si se guardó, con lo guardado. */
function CamposMarca({ estado, accion, guardando, valores: guardados, logo }: {
  estado: EstadoMarca; accion: (f: FormData) => void; guardando: boolean; logo: string | null;
  valores: { color_marca: string | null; direccion: string | null; telefono: string | null; correo: string | null; pie_documentos: string | null };
}) {
  const valores = estado.valores ?? guardados;
  const [color, setColor] = useState(valores.color_marca ?? "");
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const e = estado.errores;
  const valido = /^#[0-9a-fA-F]{6}$/.test(color);
  const legible = valido && contraste(color.toLowerCase(), "#ffffff") >= CONTRASTE_MINIMO;
  const entrada = "w-full rounded-md border border-gray-300 px-3 py-2 text-base font-normal aria-[invalid=true]:border-red-500";
  const campo = (c: "direccion" | "telefono" | "correo", etiqueta: string, max: number) => (
    <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
      {etiqueta}
      <input name={c} defaultValue={valores[c] ?? ""} maxLength={max} aria-invalid={!!e[c]} className={entrada} />
      {e[c] && <span className="text-xs font-normal text-red-700">{e[c]}</span>}
    </label>
  );
  return (
    <form action={accion} className="flex flex-col gap-5" noValidate
      onSubmit={(ev) => { if (errorArchivo) ev.preventDefault(); }}>
      <fieldset className="flex flex-col gap-2 text-sm font-medium text-gray-700">
        <legend>Color de la clínica</legend>
        <div className="flex flex-wrap items-center gap-3">
          <input type="color" value={valido ? color : "#0f766e"} aria-label="Elegir el color"
            onChange={(ev) => { const v = ev.target.value; setColor(v); }} className="h-10 w-14 cursor-pointer rounded border border-gray-300" />
          <input name="color_marca" value={color} onChange={(ev) => { const v = ev.target.value; setColor(v); }}
            placeholder="#0f766e (vacío: el de la app)" aria-label="Color en formato #RRGGBB" aria-invalid={!!e.color_marca}
            className={`${entrada} w-56`} />
          {valido && (
            <span className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: color }}>Así se ven los botones</span>
          )}
        </div>
        {valido && !legible && <span className="text-xs font-normal text-amber-800">Muy claro: el texto blanco no se leería bien. Elige uno más oscuro.</span>}
        {e.color_marca && <span className="text-xs font-normal text-red-700">{e.color_marca}</span>}
      </fieldset>

      <fieldset className="flex flex-col gap-2 text-sm font-medium text-gray-700">
        <legend>Logo (PNG, JPG o WebP, hasta 512 KB)</legend>
        {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada de corta duración */}
        {logo && <img src={logo} alt="Logo actual" className="h-14 max-w-[12rem] object-contain" />}
        <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" aria-label="Subir logo" className="text-sm font-normal"
          onChange={(ev) => {
            // Se revisa antes de enviar: un archivo grande no debe llegar al servidor (lo vuelve a validar igual).
            const f = ev.target.files?.[0];
            setErrorArchivo(!f ? null : !(f.type in TIPOS_LOGO) ? "El logo debe ser PNG, JPG o WebP."
              : f.size > MAX_LOGO_BYTES ? "El logo pesa más de 512 KB: redúcelo." : null);
          }} />
        {errorArchivo && <span role="alert" className="text-xs font-normal text-red-700">{errorArchivo}</span>}
        {logo && (
          <label className="flex items-center gap-2 font-normal"><input type="checkbox" name="quitar_logo" value="1" /> Quitar el logo</label>
        )}
        {e.logo && <span className="text-xs font-normal text-red-700">{e.logo}</span>}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-medium text-gray-700 sm:col-span-3">Membrete de recetas, constancias y demás documentos</legend>
        {campo("direccion", "Dirección", 200)}
        {campo("telefono", "Teléfono", 40)}
        {campo("correo", "Correo", 120)}
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 sm:col-span-3">
          Pie de página (opcional)
          <input name="pie_documentos" defaultValue={valores.pie_documentos ?? ""} maxLength={300} aria-invalid={!!e.pie_documentos}
            placeholder="p. ej. Horario de atención: lunes a sábado de 9:00 a 19:00" className={entrada} />
          {e.pie_documentos && <span className="text-xs font-normal text-red-700">{e.pie_documentos}</span>}
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={guardando}
          className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60">
          {guardando ? "Guardando…" : "Guardar marca"}
        </button>
        {e.general && <p role="alert" className="text-sm text-red-700">{e.general}</p>}
        {estado.mensaje && <p role="status" className="text-sm text-teal-700">{estado.mensaje}</p>}
      </div>
    </form>
  );
}
