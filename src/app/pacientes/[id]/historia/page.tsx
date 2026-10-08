import type { Metadata } from "next";
import Link from "next/link";
import { AlertasPaciente } from "@/components/alertas-paciente";
import { Encabezado } from "@/components/encabezado";
import { fechaLima, formatearFecha, horaLima } from "@/lib/fechas";
import { EMBARAZO, ENFERMEDADES, HABITOS } from "@/lib/historia/cuestionario";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { abrirHistoria, COLUMNAS_VERSION, type Version } from "../datos-clinicos";
import { PestanasPaciente } from "../pestanas";

export const metadata: Metadata = { title: "Historia clínica – Dental Demo" };

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{etiqueta}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-gray-900">{children || "—"}</dd>
    </div>
  );
}

export default async function Historia({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ version?: string; guardada?: string }>;
}) {
  const { id } = await params;
  const { version, guardada } = await searchParams;
  const { sesion, paciente } = await abrirHistoria(id);
  const supabase = await createClient();

  // El acceso a la historia queda en la auditoría
  const lectura = await supabase.rpc("registrar_lectura_historia", { id_paciente: id });
  if (lectura.error) registrarError("historia.lectura", lectura.error, { paciente: id });

  const [{ data: versiones, error }, { data: equipo }] = await Promise.all([
    supabase.from("cuestionario_salud").select(COLUMNAS_VERSION).eq("paciente_id", id)
      .order("registrado_at", { ascending: false }).order("version", { ascending: false }).returns<Version[]>(),
    supabase.from("usuario").select("id, nombre").returns<{ id: string; nombre: string }[]>(),
  ]);
  if (error) registrarError("historia.versiones", error, { paciente: id });
  const lista = versiones ?? [];
  const autor = new Map((equipo ?? []).map((u) => [u.id, u.nombre]));
  const elegida = lista.find((v) => String(v.version) === version) ?? lista[0];
  const vigente = lista[0];

  return (
    <>
      <Encabezado sesion={sesion} seccion="pacientes" />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <AlertasPaciente pacienteId={id} />
        <Link href="/pacientes" className="text-sm font-medium text-teal-700 hover:underline">← Pacientes</Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">{paciente.nombres} {paciente.apellidos}</h1>
          {!paciente.anulado_at && (
            <Link href={`/pacientes/${id}/historia/nueva`}
              className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">
              {vigente ? "Actualizar historia" : "Registrar historia"}
            </Link>
          )}
        </div>
        <PestanasPaciente id={id} actual="historia" veClinico={sesion.veClinico} />

        {guardada && (
          <p role="status" className="mt-4 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
            Historia guardada como versión {vigente?.version}. Las versiones anteriores se conservan.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            No se pudo cargar la historia clínica. Recarga la página.
          </p>
        )}

        {!elegida ? (
          <p className="mt-8 rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-600">
            Aún no tiene historia clínica. Regístrala en la primera consulta.
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm text-gray-600">
              {elegida.id === vigente?.id ? "Versión vigente" : "Versión anterior"} {elegida.version} · registrada el{" "}
              {formatearFecha(fechaLima(elegida.registrado_at))} a las {horaLima(elegida.registrado_at)}
              {elegida.registrado_por && ` por ${autor.get(elegida.registrado_por) ?? "—"}`}
              {elegida.id !== vigente?.id && (
                <> · <Link href={`/pacientes/${id}/historia`} className="font-medium text-teal-700 hover:underline">Ver la vigente</Link></>
              )}
            </p>

            <section aria-labelledby="t-anamnesis" className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
              <h2 id="t-anamnesis" className="text-lg font-semibold">Anamnesis</h2>
              <dl className="mt-3 grid gap-4">
                <Dato etiqueta="Motivo de consulta">{elegida.motivo_consulta}</Dato>
                <Dato etiqueta="Enfermedad actual">{elegida.enfermedad_actual}</Dato>
              </dl>
            </section>

            <section aria-labelledby="t-antecedentes" className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
              <h2 id="t-antecedentes" className="text-lg font-semibold">Antecedentes médicos</h2>
              <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                <Dato etiqueta="Enfermedades">
                  {[...elegida.enfermedades.map((e) => ENFERMEDADES[e] ?? e), elegida.enfermedades_otras].filter(Boolean).join(", ")
                    || "No refiere"}
                </Dato>
                <Dato etiqueta="Alergias">{elegida.alergias.length > 0 ? elegida.alergias.join(", ") : "No refiere"}</Dato>
                <Dato etiqueta="Medicación actual">{elegida.medicacion ?? "No refiere"}</Dato>
                <Dato etiqueta="Anticoagulación">{elegida.anticoagulado ? elegida.anticoagulante : "No"}</Dato>
                <Dato etiqueta="Cirugías">{elegida.cirugias ?? "No refiere"}</Dato>
                <Dato etiqueta="Hospitalizaciones">{elegida.hospitalizaciones ?? "No refiere"}</Dato>
                {elegida.embarazo !== "no_aplica" && (
                  <>
                    <Dato etiqueta="Embarazo">
                      {EMBARAZO[elegida.embarazo]}
                      {elegida.semanas_gestacion ? ` (${elegida.semanas_gestacion} semanas)` : ""}
                    </Dato>
                    <Dato etiqueta="Lactancia">{elegida.lactancia ? "Sí" : "No"}</Dato>
                  </>
                )}
              </dl>
            </section>

            <section aria-labelledby="t-habitos" className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
              <h2 id="t-habitos" className="text-lg font-semibold">Hábitos y antecedentes odontológicos</h2>
              <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                <Dato etiqueta="Hábitos">
                  {[...elegida.habitos.map((h) => HABITOS[h] ?? h), elegida.habitos_otros].filter(Boolean).join(", ") || "No refiere"}
                </Dato>
                <Dato etiqueta="Antecedentes odontológicos">{elegida.antecedentes_odontologicos}</Dato>
                <div className="sm:col-span-2"><Dato etiqueta="Observaciones">{elegida.observaciones}</Dato></div>
              </dl>
            </section>

            {lista.length > 1 && (
              <section aria-labelledby="t-versiones" className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
                <h2 id="t-versiones" className="text-lg font-semibold">Versiones</h2>
                <ol className="mt-2 divide-y divide-gray-100">
                  {lista.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <span>
                        Versión {v.version} · {formatearFecha(fechaLima(v.registrado_at))}
                        {v.registrado_por && ` · ${autor.get(v.registrado_por) ?? ""}`}
                        {v.id === vigente?.id && <span className="ml-2 rounded bg-teal-50 px-1.5 py-0.5 text-xs text-teal-800">Vigente</span>}
                      </span>
                      {v.id !== elegida.id && (
                        <Link href={`/pacientes/${id}/historia?version=${v.version}`} className="font-medium text-teal-700 hover:underline">
                          Ver versión {v.version}
                        </Link>
                      )}
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
