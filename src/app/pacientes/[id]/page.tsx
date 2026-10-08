import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertasPaciente } from "@/components/alertas-paciente";
import { Encabezado } from "@/components/encabezado";
import { ESTADOS_CITA, type EstadoCita } from "@/lib/agenda/citas";
import { fechaLima, formatearFecha, horaLima } from "@/lib/fechas";
import { esMenorDeEdad, SEXOS, TIPOS_DOCUMENTO, type EntradaPaciente } from "@/lib/pacientes/validacion";
import { registrarError } from "@/lib/registro";
import { modulos } from "@/lib/funciones";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { FormularioPaciente } from "../formulario";
import { PestanasPaciente } from "./pestanas";

export const metadata: Metadata = { title: "Paciente – Dental Demo" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Paciente = Record<keyof EntradaPaciente, string | null> & {
  id: string; anulado_at: string | null; motivo_anulacion: string | null; consentimiento_datos_at: string | null;
  fusionado_en: string | null;
};

export default async function FichaPaciente({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editar?: string; creado?: string; guardado?: string; fusionado?: string }>;
}) {
  const { id } = await params;
  const { editar, creado, guardado, fusionado } = await searchParams;
  if (!UUID.test(id)) notFound();
  if (!modulos.etapa1) notFound();
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/");

  const supabase = await createClient();
  const { data, error } = await supabase.from("paciente").select("*").eq("id", id).maybeSingle<Paciente>();
  if (error) {
    registrarError("pacientes.ficha", error, { paciente: id });
    throw new Error("No se pudo cargar el paciente");
  }
  if (!data) notFound();
  const p = data;
  // Próximas citas (Etapa 2: agenda)
  const { data: citas } = modulos.etapa2
    ? await supabase.from("cita").select("id, inicio, estado, nota, usuario!cita_clinica_id_odontologo_id_fkey(nombre)")
        .eq("paciente_id", id).in("estado", ["programada", "confirmada"]).gte("inicio", new Date().toISOString())
        .order("inicio").limit(5)
        .returns<{ id: string; inicio: string; estado: EstadoCita; nota: string | null; usuario: { nombre: string } | null }[]>()
    : { data: null };
  const menor = p.fecha_nacimiento ? esMenorDeEdad(p.fecha_nacimiento, fechaLima(new Date())) : false;
  const inicial = Object.fromEntries(
    Object.entries(p).filter(([, valor]) => typeof valor === "string").map(([k, valor]) => [k, valor]),
  ) as EntradaPaciente;
  if (inicial.telefono) inicial.telefono = inicial.telefono.slice(2);
  if (inicial.contacto_emergencia_telefono) inicial.contacto_emergencia_telefono = inicial.contacto_emergencia_telefono.slice(2);
  if (inicial.apoderado_telefono) inicial.apoderado_telefono = inicial.apoderado_telefono.slice(2);

  const dato = (etiqueta: string, valor: string | null | undefined) => (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{etiqueta}</dt>
      <dd className="mt-0.5 text-gray-900">{valor || "—"}</dd>
    </div>
  );

  return (
    <>
      <Encabezado sesion={sesion} seccion="pacientes" />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <AlertasPaciente pacienteId={id} />
        <Link href="/pacientes" className="text-sm font-medium text-teal-700 hover:underline">← Pacientes</Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{p.nombres} {p.apellidos}</h1>
            <p className="text-gray-600">
              {p.numero_documento ? `${TIPOS_DOCUMENTO[p.tipo_documento as keyof typeof TIPOS_DOCUMENTO] ?? ""} ${p.numero_documento}` : "Sin documento"}
              {menor && " · Menor de edad"}
            </p>
          </div>
          {!editar && !p.anulado_at && (
            <div className="flex flex-wrap gap-2">
              {modulos.etapa2 && (
                <Link href={`/agenda/nueva?paciente=${id}`}
                  className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">
                  Agendar cita
                </Link>
              )}
              <Link href={`/pacientes/${id}?editar=1`} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
                Editar filiación
              </Link>
              {sesion.rol === "admin" && (
                <Link href={`/pacientes/${id}/fusionar`} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
                  Fusionar duplicado
                </Link>
              )}
            </div>
          )}
        </div>

        <PestanasPaciente id={id} actual="filiacion" veClinico={sesion.veClinico} />

        {(creado || guardado || fusionado) && (
          <p role="status" className="mt-4 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
            {creado ? "Paciente registrado." : fusionado ? "Registros fusionados. El duplicado quedó anulado." : "Cambios guardados."}
          </p>
        )}
        {p.anulado_at && (
          <p role="alert" className="mt-4 rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700">
            Registro anulado: {p.motivo_anulacion}
            {p.fusionado_en && (
              <> · <Link href={`/pacientes/${p.fusionado_en}`} className="font-medium text-teal-800 underline">Ver el registro que se conservó</Link></>
            )}
          </p>
        )}

        {editar && !p.anulado_at ? (
          <section className="mt-6"><FormularioPaciente id={id} inicial={inicial} /></section>
        ) : (
          <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold">Filiación</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              {dato("Fecha de nacimiento", p.fecha_nacimiento ? formatearFecha(p.fecha_nacimiento) : null)}
              {dato("Sexo", p.sexo ? SEXOS[p.sexo as keyof typeof SEXOS] : null)}
              {dato("Celular", p.telefono?.slice(2))}
              {dato("Ocupación", p.ocupacion)}
              <div className="sm:col-span-2">{dato("Dirección", p.direccion)}</div>
              {dato("Contacto de emergencia", p.contacto_emergencia_nombre &&
                `${p.contacto_emergencia_nombre}${p.contacto_emergencia_parentesco ? ` (${p.contacto_emergencia_parentesco})` : ""}`)}
              {dato("Celular de emergencia", p.contacto_emergencia_telefono?.slice(2))}
              {dato("Consentimiento de datos", p.consentimiento_datos_at ? formatearFecha(fechaLima(p.consentimiento_datos_at)) : "No registrado")}
            </dl>
            {p.apoderado_nombre && (
              <>
                <h3 className="mt-6 font-semibold">Apoderado</h3>
                <dl className="mt-2 grid gap-4 sm:grid-cols-3">
                  {dato("Nombre", `${p.apoderado_nombre}${p.apoderado_parentesco ? ` (${p.apoderado_parentesco})` : ""}`)}
                  {dato("DNI", p.apoderado_dni)}
                  {dato("Celular", p.apoderado_telefono?.slice(2))}
                </dl>
              </>
            )}
          </section>
        )}

        {modulos.etapa2 && !editar && (
          <section aria-labelledby="titulo-citas" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
            <h2 id="titulo-citas" className="text-lg font-semibold">Próximas citas</h2>
            {(citas ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">No tiene citas agendadas.</p>
            ) : (
              <ul className="mt-3 divide-y divide-gray-100">
                {(citas ?? []).map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/agenda?fecha=${fechaLima(c.inicio)}`} className="font-medium text-teal-800 hover:underline">
                      {formatearFecha(fechaLima(c.inicio))}, {horaLima(c.inicio)}
                    </Link>
                    <span className="text-sm text-gray-600">
                      {c.usuario?.nombre ?? ""}{c.nota ? ` · ${c.nota}` : ""} · {ESTADOS_CITA[c.estado]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </>
  );
}
