import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { ESTADOS_ACTIVOS, ESTADOS_CITA, type EstadoCita } from "@/lib/agenda/citas";
import { DIAS_PLURAL, TIPOS_BLOQUEO, type TipoBloqueo } from "@/lib/agenda/horario";
import { diaSemana, fechaLima, formatearFechaLarga, horaLima, sumarDias } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { obtenerSesion } from "@/lib/sesion";
import { AccionesCita } from "./acciones-cita";
import { cargarDia, type BloqueoDia, type CitaDia } from "./datos";

export const metadata: Metadata = { title: "Agenda – Dental Demo" };

const COLOR: Record<EstadoCita, string> = {
  programada: "bg-sky-50 text-sky-800",
  confirmada: "bg-teal-50 text-teal-800",
  atendida: "bg-gray-100 text-gray-700",
  no_asistio: "bg-amber-50 text-amber-800",
  cancelada: "bg-gray-100 text-gray-500 line-through",
};

function textoBloqueo(b: BloqueoDia, fecha: string): string {
  const todoElDia = fechaLima(b.inicio) < fecha || horaLima(b.inicio) === "00:00";
  const hastaFin = fechaLima(new Date(new Date(b.fin).getTime() - 1)) > fecha || horaLima(b.fin) === "00:00";
  const horas = todoElDia && hastaFin ? "todo el día"
    : `${todoElDia ? "desde el inicio del día" : `desde ${horaLima(b.inicio)}`} ${hastaFin ? "hasta el cierre" : `hasta ${horaLima(b.fin)}`}`;
  return `${TIPOS_BLOQUEO[b.tipo as TipoBloqueo] ?? "Bloqueo"}: ${b.motivo} (${horas})`;
}

export default async function Agenda({ searchParams }: { searchParams: Promise<{ fecha?: string; creada?: string }> }) {
  if (!modulos.etapa2) notFound();
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/");
  const params = await searchParams;
  const hoy = fechaLima(new Date());
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(params.fecha ?? "") && !Number.isNaN(Date.parse(params.fecha ?? ""))
    ? (params.fecha as string) : hoy;

  const d = await cargarDia(fecha);
  const generales = d.bloqueos.filter((b) => b.profesional_id === null);
  const conHorario = new Set(d.horarios.map((h) => h.profesional_id));
  const conCitas = new Set(d.citas.map((c) => c.odontologo_id));
  const columnas = d.profesionales.filter((p) => conHorario.has(p.id) || conCitas.has(p.id));
  const activas = d.citas.filter((c) => ESTADOS_ACTIVOS.includes(c.estado)).length;
  const navegar = (f: string) => `/agenda?fecha=${f}`;

  return (
    <>
      <Encabezado sesion={sesion} seccion="agenda" />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Agenda</h1>
            <p className="text-gray-600">
              <span className="capitalize">{formatearFechaLarga(fecha)}</span>
              {fecha === hoy && " · hoy"} · {activas} {activas === 1 ? "cita" : "citas"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <nav aria-label="Cambiar de día" className="flex items-center gap-1">
              <Link href={navegar(sumarDias(fecha, -1))} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
                ← Anterior
              </Link>
              <Link href={navegar(hoy)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">Hoy</Link>
              <Link href={navegar(sumarDias(fecha, 1))} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
                Siguiente →
              </Link>
            </nav>
            <form action="/agenda" className="flex items-center gap-1">
              <label htmlFor="ir-a-fecha" className="sr-only">Ir a la fecha</label>
              <input id="ir-a-fecha" type="date" name="fecha" defaultValue={fecha}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm" />
              <button type="submit" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">Ir</button>
            </form>
            <Link href={`/agenda/nueva?fecha=${fecha < hoy ? hoy : fecha}`}
              className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800">
              Nueva cita
            </Link>
          </div>
        </div>

        {params.creada && <p role="status" className="mt-4 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">Cita agendada.</p>}
        {d.error && (
          <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            No se pudo cargar toda la agenda. Recarga la página.
          </p>
        )}
        {generales.map((b) => (
          <p key={b.id} role="note" className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Clínica cerrada · {textoBloqueo(b, fecha)}
          </p>
        ))}

        {columnas.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-600">
            Nadie atiende los {DIAS_PLURAL[diaSemana(fecha)] ?? "ese día"} según el horario de la clínica.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {columnas.map((p) => {
              const horario = d.horarios.find((h) => h.profesional_id === p.id);
              const propios = d.bloqueos.filter((b) => b.profesional_id === p.id);
              const citas = d.citas.filter((c) => c.odontologo_id === p.id);
              return (
                <section key={p.id} aria-labelledby={`prof-${p.id}`} className="rounded-xl border border-gray-200 bg-white">
                  <header className="border-b border-gray-100 px-4 py-3">
                    <h2 id={`prof-${p.id}`} className="font-semibold">{p.nombre}</h2>
                    <p className="text-sm text-gray-600">
                      {horario
                        ? `${horario.hora_inicio} – ${horario.hora_fin} · ${d.sillones.get(horario.sillon_id) ?? "Sillón"}`
                        : "No atiende este día"}
                    </p>
                    {propios.map((b) => (
                      <p key={b.id} role="note" className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
                        {textoBloqueo(b, fecha)}
                      </p>
                    ))}
                  </header>
                  {citas.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-gray-500">Sin citas</p>
                  ) : (
                    <ol className="divide-y divide-gray-100">
                      {citas.map((c) => <Cita key={c.id} c={c} sillon={c.sillon_id ? d.sillones.get(c.sillon_id) : undefined} />)}
                    </ol>
                  )}
                  <div className="border-t border-gray-100 px-4 py-2">
                    <Link href={`/agenda/nueva?fecha=${fecha < hoy ? hoy : fecha}&profesional=${p.id}`}
                      className="text-sm font-medium text-teal-700 hover:underline">
                      + Agendar con {p.nombre.split(" ").slice(0, 2).join(" ")}
                    </Link>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

function Cita({ c, sillon }: { c: CitaDia; sillon?: string }) {
  const nombre = c.paciente ? `${c.paciente.nombres} ${c.paciente.apellidos}` : "Paciente";
  const activa = c.estado === "programada" || c.estado === "confirmada";
  const descripcion = `la cita de ${nombre} a las ${horaLima(c.inicio)}`;
  return (
    <li data-cita={c.id} className={`px-4 py-3 ${activa ? "" : "opacity-70"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium tabular-nums">{horaLima(c.inicio)} – {horaLima(c.fin)}</p>
        <span className={`rounded px-1.5 py-0.5 text-xs ${COLOR[c.estado]}`}>{ESTADOS_CITA[c.estado]}</span>
      </div>
      {c.paciente ? (
        <Link href={`/pacientes/${c.paciente.id}`} className="font-medium text-teal-800 hover:underline">{nombre}</Link>
      ) : <p>{nombre}</p>}
      {c.nota && <p className="text-sm text-gray-600">{c.nota}</p>}
      {sillon && <p className="text-xs text-gray-500">{sillon}</p>}
      {c.forzada_motivo && (
        <p className="mt-1 text-xs text-amber-800">Fuera del horario (autorizado): {c.forzada_motivo}</p>
      )}
      {activa && <AccionesCita id={c.id} estado={c.estado as "programada" | "confirmada"} descripcion={descripcion} />}
    </li>
  );
}
