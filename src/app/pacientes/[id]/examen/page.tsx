import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertasPaciente } from "@/components/alertas-paciente";
import { Encabezado } from "@/components/encabezado";
import {
  CAMPOS_EXTRAORAL, CAMPOS_INTRAORAL, codigosElegibles, HIGIENE, SUPERFICIES, TIPOS_DIAGNOSTICO,
  type CodigoCie10, type Higiene, type Superficie, type TipoDiagnostico,
} from "@/lib/clinico/diagnostico";
import { fechaLima, formatearFecha, horaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { abrirHistoria } from "../datos-clinicos";
import { PestanasPaciente } from "../pestanas";
import { Adenda, Anular, FormularioDiagnostico, FormularioExamen, type InicialDiagnostico } from "./formularios";

export const metadata: Metadata = { title: "Examen y diagnóstico – Dental Demo" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Examen = Record<keyof typeof CAMPOS_EXTRAORAL | keyof typeof CAMPOS_INTRAORAL | "observaciones", string | null> & {
  id: string; registrado_at: string; registrado_por: string | null; higiene: Higiene | null;
  anulado_at: string | null; motivo_anulacion: string | null;
};
type Diagnostico = {
  id: string; cie10: string; tipo: TipoDiagnostico; pieza: number | null; superficies: Superficie[] | null;
  observacion: string | null; hallazgo_id: string | null; confirma_id: string | null; registrado_at: string;
  registrado_por: string | null; anulado_at: string | null; motivo_anulacion: string | null;
  diagnostico_adenda: { id: string; texto: string; registrado_at: string; registrado_por: string | null }[];
};
type Hallazgo = {
  id: string; pieza: number | null; superficies: string[] | null; cie10: string | null; anulado_at: string | null;
  catalogo_hallazgo: { nombre: string } | null; odontograma: { paciente_id: string } | null;
};

const fechaHora = (iso: string) => `${formatearFecha(fechaLima(iso))}, ${horaLima(iso)}`;

export default async function ExamenDiagnostico({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ hallazgo?: string; confirmar?: string }>;
}) {
  const { id } = await params;
  const { hallazgo, confirmar } = await searchParams;
  if (!modulos.etapa4) notFound();
  const { sesion, paciente } = await abrirHistoria(id);
  const supabase = await createClient();

  const [examenes, diagnosticos, catalogo, equipo, origen] = await Promise.all([
    supabase.from("examen_clinico").select("*").eq("paciente_id", id).order("registrado_at", { ascending: false })
      .returns<Examen[]>(),
    supabase.from("diagnostico")
      .select("id, cie10, tipo, pieza, superficies, observacion, hallazgo_id, confirma_id, registrado_at, registrado_por, "
        + "anulado_at, motivo_anulacion, diagnostico_adenda(id, texto, registrado_at, registrado_por)")
      .eq("paciente_id", id).order("registrado_at", { ascending: false }).returns<Diagnostico[]>(),
    supabase.from("catalogo_cie10").select("codigo, descripcion, es_categoria").order("codigo").returns<CodigoCie10[]>(),
    supabase.from("usuario").select("id, nombre, cop").returns<{ id: string; nombre: string; cop: string | null }[]>(),
    hallazgo && UUID.test(hallazgo)
      ? supabase.from("odontograma_hallazgo")
          .select("id, pieza, superficies, cie10, anulado_at, catalogo_hallazgo(nombre), odontograma(paciente_id)")
          .eq("id", hallazgo).maybeSingle<Hallazgo>()
      : Promise.resolve({ data: null, error: null }),
  ]);
  for (const [que, r] of [["examenes", examenes], ["diagnosticos", diagnosticos], ["cie10", catalogo]] as const) {
    if (r.error) registrarError(`examen.${que}`, r.error, { paciente: id });
  }
  const autor = new Map((equipo.data ?? []).map((u) => [u.id, u.cop ? `${u.nombre} (COP ${u.cop})` : u.nombre]));
  const descripcion = new Map((catalogo.data ?? []).map((c) => [c.codigo, c.descripcion]));
  const opciones = codigosElegibles(catalogo.data ?? []);
  const listaDiagnosticos = diagnosticos.data ?? [];
  const puedeRegistrar = sesion.esDentista && !paciente.anulado_at;

  // El formulario de diagnóstico puede venir de un hallazgo del odontograma o confirmar un presuntivo.
  let inicial: InicialDiagnostico = {};
  const h = origen.data;
  if (h && h.odontograma?.paciente_id === id && !h.anulado_at) {
    inicial = {
      cie10: h.cie10 && descripcion.has(h.cie10) ? `${h.cie10} — ${descripcion.get(h.cie10)}` : "",
      pieza: h.pieza ? String(h.pieza) : "", superficies: h.superficies ?? [], hallazgo_id: h.id,
      origen: `Desde el hallazgo del odontograma: ${h.catalogo_hallazgo?.nombre ?? ""}${h.pieza ? ` en la pieza ${h.pieza}` : ""}.`,
    };
  }
  const confirmados = new Set(listaDiagnosticos.filter((d) => d.confirma_id && !d.anulado_at).map((d) => d.confirma_id));
  const aConfirmar = confirmar
    ? listaDiagnosticos.find((d) => d.id === confirmar && d.tipo === "presuntivo" && !d.anulado_at && !confirmados.has(d.id))
    : undefined;
  if (aConfirmar) {
    inicial = {
      cie10: `${aConfirmar.cie10} — ${descripcion.get(aConfirmar.cie10) ?? ""}`, tipo: "definitivo",
      pieza: aConfirmar.pieza ? String(aConfirmar.pieza) : "", superficies: aConfirmar.superficies ?? [],
      confirma_id: aConfirmar.id,
      origen: `Confirma el diagnóstico presuntivo ${aConfirmar.cie10} del ${formatearFecha(fechaLima(aConfirmar.registrado_at))}. `
        + "Puedes cambiar el código si el definitivo es otro.",
    };
  }

  return (
    <>
      <Encabezado sesion={sesion} seccion="pacientes" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <AlertasPaciente pacienteId={id} />
        <Link href="/pacientes" className="text-sm font-medium text-teal-700 hover:underline">← Pacientes</Link>
        <h1 className="mt-3 text-2xl font-semibold">{paciente.nombres} {paciente.apellidos}</h1>
        <PestanasPaciente id={id} actual="examen" veClinico={sesion.veClinico} />

        {/* ---------------------------------------------------------------- Diagnósticos */}
        <section aria-labelledby="t-diagnosticos" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 id="t-diagnosticos" className="text-lg font-semibold">Diagnósticos (CIE-10)</h2>
          {diagnosticos.error && <p role="alert" className="mt-2 text-sm text-red-700">No se pudieron cargar los diagnósticos. Recarga la página.</p>}
          {listaDiagnosticos.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">Aún no tiene diagnósticos registrados.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100">
              {listaDiagnosticos.map((d) => {
                const anulado = !!d.anulado_at;
                const confirmado = confirmados.has(d.id);
                return (
                  <li key={d.id} data-diagnostico={d.id} className={`py-3 ${anulado ? "text-gray-400" : ""}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className={anulado ? "line-through" : ""}>
                        <span className="font-mono font-semibold">{d.cie10}</span>{" "}
                        {descripcion.get(d.cie10) ?? ""}
                        {d.pieza && <> · pieza {d.pieza}</>}
                        {d.superficies && <> ({d.superficies.map((s) => SUPERFICIES[s] ?? s).join(", ").toLowerCase()})</>}
                      </p>
                      <span className={`rounded px-1.5 py-0.5 text-xs ${
                        d.tipo === "definitivo" ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-900"}`}>
                        {TIPOS_DIAGNOSTICO[d.tipo]}{confirmado ? " · confirmado" : ""}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {fechaHora(d.registrado_at)} · {d.registrado_por ? autor.get(d.registrado_por) ?? "—" : "—"}
                      {d.hallazgo_id && " · desde el odontograma"}
                      {d.confirma_id && " · confirma un presuntivo"}
                    </p>
                    {d.observacion && <p className="mt-1 whitespace-pre-line text-sm">{d.observacion}</p>}
                    {anulado && <p className="mt-1 text-xs">Anulado: {d.motivo_anulacion}</p>}
                    {d.diagnostico_adenda.length > 0 && (
                      <ul className="mt-2 space-y-1 border-l-2 border-gray-200 pl-3 text-sm">
                        {[...d.diagnostico_adenda].sort((a, b) => a.registrado_at.localeCompare(b.registrado_at)).map((a) => (
                          <li key={a.id}>
                            <span className="text-xs text-gray-500">
                              Adenda del {fechaHora(a.registrado_at)} · {a.registrado_por ? autor.get(a.registrado_por) ?? "—" : "—"}:
                            </span>{" "}
                            <span className="whitespace-pre-line">{a.texto}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {puedeRegistrar && !anulado && (
                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                        {d.tipo === "presuntivo" && !confirmado && (
                          <Link href={`/pacientes/${id}/examen?confirmar=${d.id}#nuevo-diagnostico`}
                            className="text-sm text-teal-700 hover:underline">Confirmar como definitivo</Link>
                        )}
                        <Adenda pacienteId={id} diagnosticoId={d.id} />
                        <Anular pacienteId={id} id={d.id} tabla="diagnostico" descripcion={`el diagnóstico ${d.cie10}`} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {puedeRegistrar && (
          <section id="nuevo-diagnostico" aria-labelledby="t-nuevo-diagnostico" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
            <h2 id="t-nuevo-diagnostico" className="mb-3 text-lg font-semibold">
              {aConfirmar ? "Confirmar diagnóstico" : "Nuevo diagnóstico"}
            </h2>
            {catalogo.error ? (
              <p role="alert" className="text-sm text-red-700">No se pudo cargar el catálogo CIE-10. Recarga la página.</p>
            ) : (
              <FormularioDiagnostico key={`${hallazgo ?? ""}${confirmar ?? ""}`} pacienteId={id} opciones={opciones} inicial={inicial} />
            )}
          </section>
        )}

        {/* ---------------------------------------------------------------- Examen clínico */}
        {puedeRegistrar && (
          <section aria-labelledby="t-nuevo-examen" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
            <h2 id="t-nuevo-examen" className="mb-3 text-lg font-semibold">Registrar examen clínico</h2>
            <FormularioExamen pacienteId={id} />
          </section>
        )}

        <section aria-labelledby="t-examenes" className="mt-6">
          <h2 id="t-examenes" className="text-lg font-semibold">Exámenes clínicos</h2>
          {examenes.error && <p role="alert" className="mt-2 text-sm text-red-700">No se pudieron cargar los exámenes. Recarga la página.</p>}
          {(examenes.data ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">Aún no tiene examen clínico registrado.</p>
          ) : (
            (examenes.data ?? []).map((x) => (
              <article key={x.id} className={`mt-3 rounded-xl border border-gray-200 bg-white p-5 ${x.anulado_at ? "text-gray-400" : ""}`}>
                <p className="text-sm text-gray-600">
                  <span className={x.anulado_at ? "line-through" : ""}>{fechaHora(x.registrado_at)}</span>
                  {" · "}{x.registrado_por ? autor.get(x.registrado_por) ?? "—" : "—"}
                  {x.anulado_at && <span className="block text-xs">Anulado: {x.motivo_anulacion}</span>}
                </p>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  {Object.entries({ ...CAMPOS_EXTRAORAL, ...CAMPOS_INTRAORAL }).map(([c, t]) => (
                    <div key={c}>
                      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{t}</dt>
                      <dd className="mt-0.5 whitespace-pre-line">{x[c as keyof typeof CAMPOS_EXTRAORAL] ?? "—"}</dd>
                    </div>
                  ))}
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Higiene oral</dt>
                    <dd className="mt-0.5">{x.higiene ? HIGIENE[x.higiene] : "—"}</dd>
                  </div>
                  {x.observaciones && (
                    <div className="sm:col-span-3">
                      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Observaciones</dt>
                      <dd className="mt-0.5 whitespace-pre-line">{x.observaciones}</dd>
                    </div>
                  )}
                </dl>
                {puedeRegistrar && !x.anulado_at && (
                  <div className="mt-3">
                    <Anular pacienteId={id} id={x.id} tabla="examen_clinico" descripcion={`el examen del ${fechaHora(x.registrado_at)}`} />
                  </div>
                )}
              </article>
            ))
          )}
        </section>
      </main>
    </>
  );
}
