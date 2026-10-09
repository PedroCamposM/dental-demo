import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertasPaciente } from "@/components/alertas-paciente";
import { Encabezado } from "@/components/encabezado";
import { Odontograma, type HallazgoDibujo } from "@/components/odontograma";
import { fechaLima, formatearFecha, horaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import {
  DENTICIONES, SIGNIFICADO_SIGLAS, ubicacion, type Denticion, type ItemCatalogo, type TipoOdontograma,
} from "@/lib/odontograma/hallazgo";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { abrirHistoria } from "../datos-clinicos";
import { PestanasPaciente } from "../pestanas";
import { AnularHallazgo, FormularioHallazgo, NuevoOdontograma } from "./formularios";

export const metadata: Metadata = { title: "Odontograma – Dental Demo" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Registro = {
  id: string; tipo: TipoOdontograma; fecha: string; denticion: Denticion; odontologo_id: string;
  especificaciones: string | null; observaciones: string | null; anulado_at: string | null; motivo_anulacion: string | null;
};
type Hallazgo = HallazgoDibujo & {
  nombre: string; numeral: string; estado: "bueno" | "malo" | null; especificacion: string | null; cie10: string | null;
  anulado_at: string | null; motivo_anulacion: string | null; hallazgo_codigo: string;
};

const NOMBRE_TIPO: Record<TipoOdontograma, string> = { inicial: "Inicial", evolucion: "Evolución", alta: "Alta" };

function edad(nacimiento: string | null): number | null {
  if (!nacimiento) return null;
  const [a, m, d] = nacimiento.split("-").map(Number) as [number, number, number];
  const [ah, mh, dh] = fechaLima(new Date()).split("-").map(Number) as [number, number, number];
  return ah - a - (mh < m || (mh === m && dh < d) ? 1 : 0);
}

export default async function PaginaOdontograma({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ o?: string; pieza?: string; nuevo?: string; aviso?: string }>;
}) {
  const { id } = await params;
  const { o, pieza: piezaParam, nuevo, aviso } = await searchParams;
  if (!modulos.etapa4) notFound();
  const { sesion, paciente } = await abrirHistoria(id);
  const supabase = await createClient();

  const [registros, catalogo, equipo] = await Promise.all([
    supabase.from("odontograma")
      .select("id, tipo, fecha, denticion, odontologo_id, especificaciones, observaciones, anulado_at, motivo_anulacion")
      .eq("paciente_id", id).order("fecha", { ascending: false }).returns<Registro[]>(),
    supabase.from("catalogo_hallazgo").select("*").order("numeral").returns<ItemCatalogo[]>(),
    supabase.from("usuario").select("id, nombre, cop").returns<{ id: string; nombre: string; cop: string | null }[]>(),
  ]);
  if (registros.error) registrarError("odontograma.lista", registros.error, { paciente: id });
  const lista = registros.data ?? [];
  const vigentes = lista.filter((r) => !r.anulado_at);
  const actual = (o && UUID.test(o) ? lista.find((r) => r.id === o) : undefined) ?? vigentes[0] ?? lista[0];
  const autor = new Map((equipo.data ?? []).map((u) => [u.id, u.cop ? `${u.nombre} (COP ${u.cop})` : u.nombre]));
  // Orden natural de los numerales (6.1.2 antes que 6.1.10).
  const items = [...(catalogo.data ?? [])].sort((a, b) => Number(a.numeral.split(".")[2]) - Number(b.numeral.split(".")[2]));

  const { data: hallazgosData, error: errorHallazgos } = actual
    ? await supabase.from("v_hallazgo")
        .select("id, hallazgo_codigo, nombre, numeral, pieza, pieza_hasta, arcada, superficies, siglas, estado, grado, "
          + "especificacion, cie10, color, anulado_at, motivo_anulacion")
        .eq("odontograma_id", actual.id).order("created_at").returns<(Omit<Hallazgo, "codigo">)[]>()
    : { data: [], error: null };
  if (errorHallazgos) registrarError("odontograma.hallazgos", errorHallazgos, { odontograma: actual?.id ?? null });
  const hallazgos: Hallazgo[] = (hallazgosData ?? []).map((h) => ({ ...h, codigo: h.hallazgo_codigo }));
  const vigentesH = hallazgos.filter((h) => !h.anulado_at);

  const puedeRegistrar = sesion.esDentista && !paciente.anulado_at;
  const esAutor = !!actual && actual.odontologo_id === sesion.usuarioId && !actual.anulado_at && puedeRegistrar;
  const pieza = piezaParam && /^\d{2}$/.test(piezaParam) ? Number(piezaParam) : null;
  const e = edad(paciente.fecha_nacimiento);
  const denticionSugerida: Denticion = e === null ? "permanente" : e < 6 ? "temporal" : e < 12 ? "mixta" : "permanente";
  const mostrarNuevo = puedeRegistrar && (nuevo === "1" || lista.length === 0);
  const base = `/pacientes/${id}/odontograma`;

  return (
    <>
      <Encabezado sesion={sesion} seccion="pacientes" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <AlertasPaciente pacienteId={id} />
        <Link href="/pacientes" className="text-sm font-medium text-teal-700 hover:underline">← Pacientes</Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">{paciente.nombres} {paciente.apellidos}</h1>
          {puedeRegistrar && lista.length > 0 && !mostrarNuevo && (
            <Link href={`${base}?nuevo=1`} className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">
              Nuevo odontograma
            </Link>
          )}
        </div>
        <PestanasPaciente id={id} actual="odontograma" veClinico={sesion.veClinico} />

        {aviso === "copia" && (
          <p role="alert" className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            El odontograma se creó, pero no se pudieron copiar todos los hallazgos del anterior. Regístralos aquí.
          </p>
        )}
        {registros.error && (
          <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            No se pudo cargar el odontograma. Recarga la página.
          </p>
        )}

        {mostrarNuevo && (
          <section aria-labelledby="t-nuevo" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
            <h2 id="t-nuevo" className="mb-3 text-lg font-semibold">Nuevo odontograma</h2>
            <NuevoOdontograma pacienteId={id}
              tipoSugerido={lista.length === 0 ? "inicial" : "evolucion"} denticionSugerida={denticionSugerida}
              anterior={vigentes[0] ? {
                id: vigentes[0].id,
                descripcion: `odontograma ${NOMBRE_TIPO[vigentes[0].tipo].toLowerCase()} del ${formatearFecha(fechaLima(vigentes[0].fecha))}`,
              } : null} />
          </section>
        )}

        {!actual ? (
          !mostrarNuevo && (
            <p className="mt-8 rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-600">
              Aún no tiene odontograma.
            </p>
          )
        ) : (
          <>
            <section aria-labelledby="t-odontograma" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="t-odontograma" className="text-lg font-semibold">
                  Odontograma {NOMBRE_TIPO[actual.tipo].toLowerCase()} · {formatearFecha(fechaLima(actual.fecha))}
                </h2>
                <p className="text-sm text-gray-600">
                  Dentición {DENTICIONES[actual.denticion].toLowerCase()} · {autor.get(actual.odontologo_id) ?? "—"}
                </p>
              </div>
              {actual.anulado_at && (
                <p role="alert" className="mt-2 rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700">Anulado: {actual.motivo_anulacion}</p>
              )}
              <div className="mt-4 overflow-x-auto">
                <div className="min-w-[44rem]">
                  <Odontograma hallazgos={vigentesH} seleccionada={pieza}
                    enlace={esAutor ? (p) => `${base}?o=${actual.id}&pieza=${p}#agregar` : undefined}
                    titulo={`Odontograma ${NOMBRE_TIPO[actual.tipo].toLowerCase()} del ${formatearFecha(fechaLima(actual.fecha))}`} />
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Azul: buen estado. Rojo: mal estado, temporal o patológico (NTS 188, 5.13).
                {esAutor && " Toca una pieza para registrar un hallazgo en ella."}
              </p>
              {(actual.especificaciones || actual.observaciones) && (
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  {actual.especificaciones && <div><dt className="font-medium">Especificaciones</dt><dd className="whitespace-pre-line">{actual.especificaciones}</dd></div>}
                  {actual.observaciones && <div><dt className="font-medium">Observaciones</dt><dd className="whitespace-pre-line">{actual.observaciones}</dd></div>}
                </dl>
              )}
            </section>

            {esAutor && (
              <section id="agregar" aria-labelledby="t-agregar" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
                <h2 id="t-agregar" className="mb-3 text-lg font-semibold">
                  Agregar hallazgo{pieza ? ` en la pieza ${pieza}` : ""}
                </h2>
                <FormularioHallazgo key={pieza ?? 0} pacienteId={id} odontogramaId={actual.id} catalogo={items} pieza={pieza} />
              </section>
            )}

            <section aria-labelledby="t-hallazgos" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
              <h2 id="t-hallazgos" className="text-lg font-semibold">Hallazgos</h2>
              {errorHallazgos && <p role="alert" className="mt-2 text-sm text-red-700">No se pudieron cargar los hallazgos. Recarga la página.</p>}
              {hallazgos.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">Sin hallazgos registrados.</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[42rem] text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th scope="col" className="px-3 py-2 font-medium">Hallazgo</th>
                        <th scope="col" className="px-3 py-2 font-medium">Pieza</th>
                        <th scope="col" className="px-3 py-2 font-medium">Siglas</th>
                        <th scope="col" className="px-3 py-2 font-medium">Estado</th>
                        <th scope="col" className="px-3 py-2 font-medium">CIE-10</th>
                        <th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">Acciones</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {hallazgos.map((h) => (
                        <tr key={h.id} data-hallazgo={h.id} className={h.anulado_at ? "text-gray-400" : ""}>
                          <td className="px-3 py-2">
                            <span className={h.anulado_at ? "line-through" : ""}>
                              <span className="text-gray-500">{h.numeral}</span> {h.nombre}
                            </span>
                            {h.especificacion && <span className="block text-xs text-gray-500">{h.especificacion}</span>}
                            {h.anulado_at && <span className="block text-xs">Anulado: {h.motivo_anulacion}</span>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">{ubicacion(h)}</td>
                          <td className="px-3 py-2">
                            {[...h.siglas, ...(h.grado ? [`M${h.grado}`] : [])].map((s) => (
                              <abbr key={s} title={SIGNIFICADO_SIGLAS[s] ?? ""} className={`mr-1 font-semibold no-underline ${h.color === "rojo" ? "text-red-700" : "text-blue-700"}`}>{s}</abbr>
                            ))}
                          </td>
                          <td className="px-3 py-2">{h.estado === "bueno" ? "Bueno" : h.estado === "malo" ? "Malo" : "—"}</td>
                          <td className="px-3 py-2 font-mono">{h.cie10 ?? "—"}</td>
                          <td className="px-3 py-2">
                            {!h.anulado_at && puedeRegistrar && (
                              <div className="flex flex-col gap-1">
                                {h.pieza !== null && h.pieza_hasta === null && (
                                  <Link href={`/pacientes/${id}/examen?hallazgo=${h.id}#nuevo-diagnostico`} className="text-teal-700 hover:underline">
                                    Registrar diagnóstico
                                  </Link>
                                )}
                                <AnularHallazgo pacienteId={id} id={h.id} descripcion={`${h.nombre} ${ubicacion(h)}`} />
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {lista.length > 1 && (
              <section aria-labelledby="t-historial" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
                <h2 id="t-historial" className="text-lg font-semibold">Odontogramas del paciente</h2>
                <ol className="mt-2 divide-y divide-gray-100 text-sm">
                  {lista.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className={r.anulado_at ? "text-gray-400 line-through" : ""}>
                        {NOMBRE_TIPO[r.tipo]} · {formatearFecha(fechaLima(r.fecha))}, {horaLima(r.fecha)} · {autor.get(r.odontologo_id) ?? "—"}
                      </span>
                      {r.id === actual.id
                        ? <span className="rounded bg-teal-50 px-1.5 py-0.5 text-xs text-teal-800">En pantalla</span>
                        : <Link href={`${base}?o=${r.id}`} className="font-medium text-teal-700 hover:underline">Ver</Link>}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
