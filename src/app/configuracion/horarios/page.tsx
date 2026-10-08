import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { TIPOS_BLOQUEO, type TipoBloqueo } from "@/lib/agenda/horario";
import { fechaLima, formatearFecha, horaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { NavegacionConfiguracion } from "../navegacion";
import { AnularBloqueo, EstadoSillon, HorarioProfesional, NuevoBloqueo, NuevoSillon, type DiaInicial } from "./formularios";

export const metadata: Metadata = { title: "Sillones y horarios – Dental Demo" };

type Sillon = { id: string; nombre: string; activo: boolean };
type Profesional = { id: string; nombre: string };
type Horario = { profesional_id: string; dia_semana: number; sillon_id: string; hora_inicio: string; hora_fin: string; activo: boolean };
type Bloqueo = { id: string; tipo: TipoBloqueo; motivo: string; inicio: string; fin: string; profesional_id: string | null };

/** "8 dic 2026" o "8 dic 2026, 14:00 – 18:00" o "8 dic – 12 dic 2026" */
function rango(b: Bloqueo): string {
  const fi = fechaLima(b.inicio);
  const finMenos = new Date(new Date(b.fin).getTime() - 1);   // el fin es exclusivo
  const ff = fechaLima(finMenos);
  const hi = horaLima(b.inicio);
  const hf = horaLima(b.fin);
  const diasCompletos = hi === "00:00" && hf === "00:00";
  if (fi === ff) return diasCompletos ? formatearFecha(fi) : `${formatearFecha(fi)}, ${hi} – ${hf}`;
  return diasCompletos
    ? `${formatearFecha(fi)} – ${formatearFecha(ff)}`
    : `${formatearFecha(fi)} ${hi} – ${formatearFecha(fechaLima(b.fin))} ${hf}`;
}

export default async function Horarios() {
  if (!modulos.etapa2) notFound();
  const sesion = await obtenerSesion();
  if (!sesion || sesion.rol !== "admin") redirect("/");

  const supabase = await createClient();
  const [sillones, profesionales, horarios, bloqueos] = await Promise.all([
    supabase.from("sillon").select("id, nombre, activo").order("nombre").returns<Sillon[]>(),
    supabase.from("usuario").select("id, nombre").in("rol", ["admin", "odontologo"]).not("cop", "is", null)
      .eq("activo", true).order("nombre").returns<Profesional[]>(),
    supabase.from("horario_profesional").select("profesional_id, dia_semana, sillon_id, hora_inicio, hora_fin, activo")
      .returns<Horario[]>(),
    supabase.from("bloqueo_agenda").select("id, tipo, motivo, inicio, fin, profesional_id")
      .is("anulado_at", null).gt("fin", new Date().toISOString()).order("inicio").returns<Bloqueo[]>(),
  ]);
  const fallo = sillones.error ?? profesionales.error ?? horarios.error ?? bloqueos.error;
  if (fallo) registrarError("horarios.cargar", fallo);

  const listaSillones = sillones.data ?? [];
  const activos = listaSillones.filter((s) => s.activo).map((s) => ({ id: s.id, nombre: s.nombre }));
  const listaProfesionales = profesionales.data ?? [];
  const nombreProfesional = new Map(listaProfesionales.map((p) => [p.id, p.nombre]));
  const semana = (id: string): Record<number, DiaInicial> => Object.fromEntries(
    (horarios.data ?? []).filter((h) => h.profesional_id === id).map((h) => [h.dia_semana, {
      activo: h.activo, sillon_id: h.sillon_id, hora_inicio: h.hora_inicio.slice(0, 5), hora_fin: h.hora_fin.slice(0, 5),
    }]),
  );

  return (
    <>
      <Encabezado sesion={sesion} seccion="configuracion" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Configuración de la clínica</h1>
        <NavegacionConfiguracion actual="horarios" />
        {fallo && (
          <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            No se pudo cargar toda la configuración. Recarga la página.
          </p>
        )}

        <section aria-labelledby="titulo-sillones" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 id="titulo-sillones" className="text-lg font-semibold">Sillones</h2>
          <ul className="mt-3 divide-y divide-gray-100">
            {listaSillones.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                <span className={s.activo ? "" : "text-gray-400"}>
                  {s.nombre}{!s.activo && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">Inactivo</span>}
                </span>
                <EstadoSillon id={s.id} nombre={s.nombre} activo={s.activo} />
              </li>
            ))}
          </ul>
          <div className="mt-4"><NuevoSillon /></div>
        </section>

        <section aria-labelledby="titulo-horarios" className="mt-6">
          <h2 id="titulo-horarios" className="text-lg font-semibold">Horario de atención</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Días, horas y sillón de cada odontólogo. La agenda no deja citar fuera de este horario; solo el administrador
            puede forzarlo, con un motivo que queda registrado.
          </p>
          {activos.length === 0 && (
            <p className="mt-3 text-sm text-amber-800">Agrega al menos un sillón activo para asignar horarios.</p>
          )}
          {listaProfesionales.map((p) => (
            <article key={p.id} className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-3 font-semibold">{p.nombre}</h3>
              <HorarioProfesional profesional={p.id} nombre={p.nombre} sillones={activos} inicial={semana(p.id)} />
            </article>
          ))}
        </section>

        <section aria-labelledby="titulo-bloqueos" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 id="titulo-bloqueos" className="text-lg font-semibold">Bloqueos de agenda</h2>
          <p className="mt-1 text-sm text-gray-600">Vacaciones, feriados o capacitación: ese tiempo no se puede citar.</p>
          {(bloqueos.data ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No hay bloqueos vigentes.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100">
              {(bloqueos.data ?? []).map((b) => {
                const quien = b.profesional_id ? nombreProfesional.get(b.profesional_id) ?? "Profesional" : "Toda la clínica";
                return (
                  <li key={b.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium">{rango(b)}</p>
                      <p className="text-sm text-gray-600">{TIPOS_BLOQUEO[b.tipo]} · {quien} · {b.motivo}</p>
                    </div>
                    <AnularBloqueo id={b.id} descripcion={`${b.motivo} (${rango(b)})`} />
                  </li>
                );
              })}
            </ul>
          )}
          <h3 className="mb-3 mt-6 font-semibold">Nuevo bloqueo</h3>
          <NuevoBloqueo profesionales={listaProfesionales} hoy={fechaLima(new Date())} />
        </section>
      </main>
    </>
  );
}
