import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertasPaciente } from "@/components/alertas-paciente";
import { Encabezado } from "@/components/encabezado";
import { comparar, resumen, type PiezaPeriodonto, type Resumen, type Seis } from "@/lib/clinico/periodonto";
import { fechaLima, formatearFecha, horaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { abrirHistoria } from "../datos-clinicos";
import { PestanasPaciente } from "../pestanas";
import { AnularPeriodontograma, GrillaEdicion, GrillaLectura, NuevoPeriodontograma } from "./formularios";

export const metadata: Metadata = { title: "Periodontograma – Dental Demo" };

type Periodontograma = {
  id: string; fecha: string; odontologo_id: string; registrado_por: string; observaciones: string | null;
  mantenimiento_meses: number | null; firmado_at: string | null; anulado_at: string | null; motivo_anulacion: string | null;
};
type FilaPieza = {
  periodontograma_id: string; pieza: number; ausente: boolean; implante: boolean; movilidad: number | null; furca: number | null;
  ps: (number | null)[]; mg: (number | null)[]; sangrado: boolean[]; supuracion: boolean[]; placa: boolean[];
};

const aPieza = (f: FilaPieza): PiezaPeriodonto => ({
  pieza: f.pieza, ausente: f.ausente, implante: f.implante, movilidad: f.movilidad, furca: f.furca,
  ps: f.ps as Seis<number | null>, mg: f.mg as Seis<number | null>, sangrado: f.sangrado as Seis<boolean>,
  supuracion: f.supuracion as Seis<boolean>, placa: f.placa as Seis<boolean>,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cuando = (iso: string) => `${formatearFecha(fechaLima(iso))} ${horaLima(iso)}`;
const pct = (v: number | null) => (v === null ? "—" : `${v} %`);

function TextoResumen({ r }: { r: Resumen }) {
  if (r.sitios === 0) return <span className="text-gray-500">Sin mediciones</span>;
  return (
    <span>
      {r.sitios} sitios · sangrado {pct(r.sangrado)} · placa {pct(r.placa)} · PS ≥ 4 mm: {r.ps4} · PS ≥ 6 mm: {r.ps6}
      {r.nicMedio !== null && <> · NIC medio {r.nicMedio.toLocaleString("es-PE")} mm</>}
    </span>
  );
}

/** Periodontograma: seis sitios por pieza, firmado por el responsable y comparable entre fechas. */
export default async function Periodonto({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ p?: string; a?: string; b?: string; firmado?: string }>;
}) {
  if (!modulos.etapa9) notFound();
  const { id } = await params;
  const q = await searchParams;
  const { sesion, paciente } = await abrirHistoria(id);
  const supabase = await createClient();
  const [lista, equipo] = await Promise.all([
    supabase.from("periodontograma")
      .select("id, fecha, odontologo_id, registrado_por, observaciones, mantenimiento_meses, firmado_at, anulado_at, motivo_anulacion")
      .eq("paciente_id", id).order("fecha", { ascending: false }).limit(30).returns<Periodontograma[]>(),
    supabase.from("usuario").select("id, nombre, rol, cop, activo")
      .returns<{ id: string; nombre: string; rol: string; cop: string | null; activo: boolean }[]>(),
  ]);
  const ids = (lista.data ?? []).map((p) => p.id);
  const filas = ids.length > 0
    ? await supabase.from("periodonto_pieza")
        .select("periodontograma_id, pieza, ausente, implante, movilidad, furca, ps, mg, sangrado, supuracion, placa")
        .in("periodontograma_id", ids).order("pieza").returns<FilaPieza[]>()
    : { data: [] as FilaPieza[], error: null };
  const error = lista.error ?? filas.error;
  if (error) registrarError("periodonto.ver", error, { paciente: id });

  const piezasDe = new Map<string, PiezaPeriodonto[]>();
  for (const f of filas.data ?? []) piezasDe.set(f.periodontograma_id, [...(piezasDe.get(f.periodontograma_id) ?? []), aPieza(f)]);
  const nombre = new Map((equipo.data ?? []).map((u) => [u.id, u.cop ? `${u.nombre} (COP ${u.cop})` : u.nombre]));
  const dentistas = (equipo.data ?? []).filter((u) => u.activo && u.cop && (u.rol === "admin" || u.rol === "odontologo"))
    .map((u) => ({ id: u.id, nombre: u.nombre }));
  const todos = lista.data ?? [];
  const firmados = todos.filter((p) => p.firmado_at && !p.anulado_at);
  const elegido = todos.find((p) => p.id === q.p) ?? null;

  // Comparación: dos periodontogramas firmados (por defecto, los dos últimos).
  const [porDefectoB, porDefectoA] = firmados;
  const a = firmados.find((p) => p.id === q.a) ?? porDefectoA ?? null;
  const b = firmados.find((p) => p.id === q.b) ?? porDefectoB ?? null;
  const [antes, despues] = a && b ? (a.fecha <= b.fecha ? [a, b] : [b, a]) : [null, null];
  const cambios = antes && despues && antes.id !== despues.id
    ? comparar(piezasDe.get(antes.id) ?? [], piezasDe.get(despues.id) ?? []) : [];

  const puedeEditar = (p: Periodontograma) => !p.firmado_at && !p.anulado_at && !paciente.anulado_at
    && (p.odontologo_id === sesion.usuarioId || p.registrado_por === sesion.usuarioId);
  const base = `/pacientes/${id}/periodontograma`;

  return (
    <>
      <Encabezado sesion={sesion} seccion="pacientes" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <AlertasPaciente pacienteId={id} />
        <Link href="/pacientes" className="text-sm font-medium text-teal-700 hover:underline">← Pacientes</Link>
        <h1 className="mt-3 text-2xl font-semibold">{paciente.nombres} {paciente.apellidos}</h1>
        <PestanasPaciente id={id} actual="periodontograma" veClinico={sesion.veClinico} />
        {error && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo cargar todo. Recarga la página.</p>}

        <section aria-labelledby="t-lista" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="t-lista" className="text-lg font-semibold">Periodontogramas</h2>
            {!paciente.anulado_at && <NuevoPeriodontograma pacienteId={id} esDentista={sesion.esDentista} dentistas={dentistas} />}
          </div>
          {todos.length === 0 ? <p className="mt-3 text-sm text-gray-500">Aún no hay periodontogramas.</p> : (
            <ul className="mt-3 divide-y divide-gray-100 text-sm">
              {todos.map((p) => (
                <li key={p.id} className={`flex flex-wrap items-center justify-between gap-2 py-2 ${p.anulado_at ? "text-gray-400" : ""}`}>
                  <span>
                    <Link href={`${base}?p=${p.id}`} className="font-medium text-teal-800 hover:underline">{cuando(p.fecha)}</Link>
                    {" · "}{nombre.get(p.odontologo_id) ?? "—"}{" · "}
                    {p.anulado_at ? `Anulado: ${p.motivo_anulacion}` : p.firmado_at ? "Firmado" : <b className="text-amber-800">Borrador</b>}
                  </span>
                  <span className="text-xs text-gray-600"><TextoResumen r={resumen(piezasDe.get(p.id) ?? [])} /></span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {elegido && (
          <section aria-labelledby="t-elegido" className="mt-6 flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="t-elegido" className="text-lg font-semibold">
                Periodontograma del {cuando(elegido.fecha)}{" "}
                <span className="text-sm font-normal text-gray-600">
                  · responsable {nombre.get(elegido.odontologo_id) ?? "—"}
                  {elegido.registrado_por !== elegido.odontologo_id && <> · registró {nombre.get(elegido.registrado_por) ?? "—"}</>}
                  {elegido.firmado_at && <> · firmado el {cuando(elegido.firmado_at)}</>}
                </span>
              </h2>
              {!elegido.anulado_at && (elegido.firmado_at || puedeEditar(elegido)) && <AnularPeriodontograma id={elegido.id} pacienteId={id} />}
            </div>
            {elegido.anulado_at && <p className="text-sm text-red-700">Anulado: {elegido.motivo_anulacion}</p>}
            {q.firmado === "1" && elegido.firmado_at && !elegido.anulado_at && (
              <p role="status" className="text-sm text-teal-700">
                {elegido.mantenimiento_meses
                  ? `Firmado. Mantenimiento programado a ${elegido.mantenimiento_meses} ${elegido.mantenimiento_meses === 1 ? "mes" : "meses"}.`
                  : "Firmado."}
              </p>
            )}
            {puedeEditar(elegido) ? (
              <GrillaEdicion id={elegido.id} pacienteId={id} piezas={piezasDe.get(elegido.id) ?? []}
                observaciones={elegido.observaciones ?? ""} mantenimiento={elegido.mantenimiento_meses}
                puedeFirmar={sesion.esDentista && elegido.odontologo_id === sesion.usuarioId} />
            ) : (
              <>
                {!elegido.firmado_at && !elegido.anulado_at && (
                  <p className="text-sm text-gray-600">Borrador en curso: lo completan su responsable o quien lo registró.</p>
                )}
                <GrillaLectura piezas={piezasDe.get(elegido.id) ?? []} />
                <p className="text-sm"><TextoResumen r={resumen(piezasDe.get(elegido.id) ?? [])} /></p>
                {elegido.observaciones && <p className="text-sm">Observaciones: {elegido.observaciones}</p>}
                {elegido.mantenimiento_meses && <p className="text-sm">Mantenimiento periodontal indicado a {elegido.mantenimiento_meses} meses.</p>}
              </>
            )}
          </section>
        )}

        {firmados.length >= 2 && (
          <section aria-labelledby="t-comparar" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
            <h2 id="t-comparar" className="text-lg font-semibold">Comparar fechas</h2>
            <form method="get" className="mt-3 flex flex-wrap items-end gap-3 text-sm">
              {elegido && <input type="hidden" name="p" value={elegido.id} />}
              {([["a", "Desde", a], ["b", "Hasta", b]] as const).map(([campo, texto, valor]) => (
                <label key={campo} className="flex flex-col gap-1 font-medium text-gray-700">
                  {texto}
                  <select name={campo} defaultValue={valor?.id ?? ""} className="rounded-md border border-gray-300 px-3 py-2 font-normal">
                    {firmados.map((p) => <option key={p.id} value={p.id}>{cuando(p.fecha)}</option>)}
                  </select>
                </label>
              ))}
              <button type="submit" className="rounded-md border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50">Comparar</button>
            </form>
            {antes && despues && antes.id !== despues.id && (
              <div className="mt-4 text-sm">
                <p>{formatearFecha(fechaLima(antes.fecha))}: <TextoResumen r={resumen(piezasDe.get(antes.id) ?? [])} /></p>
                <p>{formatearFecha(fechaLima(despues.fecha))}: <TextoResumen r={resumen(piezasDe.get(despues.id) ?? [])} /></p>
                <h3 className="mt-3 font-semibold">Sitios que cambiaron 2 mm o más (NIC; sin MG, PS)</h3>
                {cambios.length === 0 ? <p className="text-gray-500">Ningún sitio cambió 2 mm o más.</p> : (
                  <table className="mt-1 text-sm">
                    <thead><tr className="text-left text-xs uppercase text-gray-500">
                      <th scope="col" className="pr-4">Pieza</th><th scope="col" className="pr-4">Sitio</th>
                      <th scope="col" className="pr-4">Antes</th><th scope="col" className="pr-4">Después</th><th scope="col">Cambio</th>
                    </tr></thead>
                    <tbody>
                      {cambios.map((c) => (
                        <tr key={`${c.pieza}-${c.sitio}`}>
                          <td className="pr-4">{c.pieza}</td><td className="pr-4">{c.sitio}</td>
                          <td className="pr-4 tabular-nums">{c.antes} mm</td><td className="pr-4 tabular-nums">{c.despues} mm</td>
                          <td className={`tabular-nums ${c.diferencia > 0 ? "text-red-700" : "text-teal-800"}`}>
                            {c.diferencia > 0 ? `+${c.diferencia}` : c.diferencia} mm
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </section>
        )}
        {q.p && !elegido && UUID.test(q.p) && <p className="mt-4 text-sm text-gray-500">Ese periodontograma no está disponible.</p>}
      </main>
    </>
  );
}
