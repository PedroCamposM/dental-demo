import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertasPaciente } from "@/components/alertas-paciente";
import { Encabezado } from "@/components/encabezado";
import { esImagen, TIPOS_ARCHIVO, TIPOS_OTROS } from "@/lib/clinico/archivos";
import { FINES_IMAGEN, type FinImagen } from "@/lib/clinico/consentimientos";
import { fechaLima, formatearFecha } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { abrirHistoria } from "../datos-clinicos";
import { PestanasPaciente } from "../pestanas";
import { AnularArchivo, SubirArchivo } from "./formularios";

export const metadata: Metadata = { title: "Imágenes y archivos – Dental Demo" };

/** Las URLs firmadas vencen pronto: quien quiera volver a ver el archivo recarga la página. */
const SEGUNDOS_URL = 300;
const TIPOS: Record<string, string> = { ...TIPOS_ARCHIVO, ...TIPOS_OTROS };

type Archivo = {
  id: string; tipo: string; ruta: string; nombre: string | null; mime: string; bytes: number; tomada_el: string;
  pieza: number | null; nota_id: string | null; descripcion: string | null; subido_por: string | null;
  anulado_at: string | null; motivo_anulacion: string | null;
};

const peso = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

export default async function Archivos({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ tipo?: string }>;
}) {
  const { id } = await params;
  const { tipo } = await searchParams;
  if (!modulos.etapa7) notFound();
  const { sesion, paciente } = await abrirHistoria(id);
  const supabase = await createClient();
  const filtro = tipo && Object.hasOwn(TIPOS, tipo) ? tipo : null;

  let consulta = supabase.from("archivo_clinico")
    .select("id, tipo, ruta, nombre, mime, bytes, tomada_el, pieza, nota_id, descripcion, subido_por, anulado_at, motivo_anulacion")
    .eq("paciente_id", id).order("tomada_el", { ascending: false }).order("subido_at", { ascending: false }).limit(200);
  if (filtro) consulta = consulta.eq("tipo", filtro);
  const [archivos, notas, equipo, usoImagen] = await Promise.all([
    consulta.returns<Archivo[]>(),
    supabase.from("nota_evolucion").select("id, fecha, texto").eq("paciente_id", id).is("anulado_at", null)
      .order("fecha", { ascending: false }).limit(30).returns<{ id: string; fecha: string; texto: string }[]>(),
    supabase.from("usuario").select("id, nombre").returns<{ id: string; nombre: string }[]>(),
    // Consentimiento de uso de imagen firmado y vigente: sin él, las imágenes son solo de uso clínico.
    supabase.from("consentimiento").select("fines").eq("paciente_id", id).eq("tipo", "uso_imagen").eq("estado", "firmado")
      .is("anulado_at", null).maybeSingle<{ fines: FinImagen[] }>(),
  ]);
  const usoAutorizado = usoImagen.data?.fines.map((f) => FINES_IMAGEN[f].toLowerCase()).join(" y ") ?? null;
  const lista = archivos.data ?? [];
  const vigentes = lista.filter((a) => !a.anulado_at);
  // URLs firmadas de corta duración, solo para los vigentes (Storage vuelve a aplicar RLS).
  const firmadas = vigentes.length > 0
    ? await supabase.storage.from("clinico").createSignedUrls(vigentes.map((a) => a.ruta), SEGUNDOS_URL)
    : { data: [], error: null };
  const error = archivos.error ?? notas.error ?? firmadas.error ?? usoImagen.error;
  if (error) registrarError("archivos.listar", error, { paciente: id });
  const url = new Map((firmadas.data ?? []).flatMap((f) => (f.path && f.signedUrl ? [[f.path, f.signedUrl] as const] : [])));
  const autor = new Map((equipo.data ?? []).map((u) => [u.id, u.nombre]));
  const sesiones = (notas.data ?? []).map((n) => ({
    id: n.id, texto: `${formatearFecha(fechaLima(n.fecha))} · ${n.texto.slice(0, 60) || "Evolución en borrador"}`,
  }));
  const sesionTexto = new Map(sesiones.map((s) => [s.id, s.texto]));

  return (
    <>
      <Encabezado sesion={sesion} seccion="pacientes" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <AlertasPaciente pacienteId={id} />
        <Link href="/pacientes" className="text-sm font-medium text-teal-700 hover:underline">← Pacientes</Link>
        <h1 className="mt-3 text-2xl font-semibold">{paciente.nombres} {paciente.apellidos}</h1>
        <PestanasPaciente id={id} actual="archivos" veClinico={sesion.veClinico} />

        {error && (
          <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            No se pudieron cargar todos los archivos. Recarga la página.
          </p>
        )}

        {!paciente.anulado_at && (
          <section aria-labelledby="t-subir" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
            <h2 id="t-subir" className="mb-3 text-lg font-semibold">Agregar imagen o documento</h2>
            <SubirArchivo clinicaId={sesion.clinicaId} pacienteId={id} hoy={fechaLima(new Date())} sesiones={sesiones} />
          </section>
        )}

        <section aria-labelledby="t-archivos" className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="t-archivos" className="text-lg font-semibold">Archivos del paciente</h2>
            <nav aria-label="Filtrar por tipo" className="flex flex-wrap gap-1 text-sm">
              <Link href={`/pacientes/${id}/archivos`} aria-current={!filtro ? "page" : undefined}
                className={`rounded-md px-2 py-1 ${!filtro ? "bg-teal-50 font-medium text-teal-800" : "text-gray-600 hover:bg-gray-50"}`}>
                Todos
              </Link>
              {Object.entries(TIPOS).map(([v, t]) => (
                <Link key={v} href={`/pacientes/${id}/archivos?tipo=${v}`} aria-current={filtro === v ? "page" : undefined}
                  className={`rounded-md px-2 py-1 ${filtro === v ? "bg-teal-50 font-medium text-teal-800" : "text-gray-600 hover:bg-gray-50"}`}>
                  {t}
                </Link>
              ))}
            </nav>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Los enlaces son temporales (5 minutos): si vencen, recarga la página.{" "}
            {usoAutorizado
              ? `El paciente autorizó el uso de sus imágenes con ${usoAutorizado} (consentimiento firmado).`
              : "Sin consentimiento de uso de imagen firmado, las imágenes son solo de uso clínico."}
          </p>
          {lista.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">{filtro ? "No hay archivos de este tipo." : "Aún no hay archivos."}</p>
          ) : (
            <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lista.map((a) => {
                const enlace = url.get(a.ruta);
                const titulo = `${TIPOS[a.tipo] ?? "Archivo"} del ${formatearFecha(a.tomada_el)}${a.pieza ? ` · pieza ${a.pieza}` : ""}`;
                return (
                  <li key={a.id} data-archivo={a.id}
                    className={`flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white ${a.anulado_at ? "opacity-60" : ""}`}>
                    {!a.anulado_at && enlace && esImagen(a.mime) ? (
                      <a href={enlace} target="_blank" rel="noopener noreferrer" className="block bg-gray-100">
                        {/* URL firmada que vence: no pasa por el optimizador de imágenes de Next. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={enlace} alt={titulo} loading="lazy" className="h-44 w-full object-contain" />
                      </a>
                    ) : (
                      <div className="flex h-24 items-center justify-center bg-gray-50 text-sm text-gray-500">
                        {a.anulado_at ? "Anulado" : a.mime === "application/pdf" ? "PDF" : "Sin vista previa"}
                      </div>
                    )}
                    <div className="flex flex-1 flex-col gap-1 p-3 text-sm">
                      <p className={`font-medium ${a.anulado_at ? "line-through" : ""}`}>{titulo}</p>
                      {a.descripcion && <p className="text-gray-700">{a.descripcion}</p>}
                      {a.nota_id && sesionTexto.get(a.nota_id) && (
                        <p className="text-xs text-gray-500">Sesión: {sesionTexto.get(a.nota_id)}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        {a.nombre ?? "Archivo"} · {peso(a.bytes)} · subió {a.subido_por ? autor.get(a.subido_por) ?? "—" : "el sistema"}
                      </p>
                      {esImagen(a.mime) && !a.anulado_at && a.tipo !== "consentimiento" && (
                        <p>
                          {usoAutorizado
                            ? <span className="rounded bg-teal-50 px-1.5 py-0.5 text-xs text-teal-800">Uso autorizado: {usoAutorizado}</span>
                            : <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">Solo uso clínico</span>}
                        </p>
                      )}
                      {a.anulado_at && <p className="text-xs text-gray-700">Anulado: {a.motivo_anulacion}</p>}
                      {!a.anulado_at && enlace && !esImagen(a.mime) && (
                        <a href={enlace} target="_blank" rel="noopener noreferrer" className="font-medium text-teal-700 hover:underline">
                          Abrir documento
                        </a>
                      )}
                      {!a.anulado_at && Object.hasOwn(TIPOS_ARCHIVO, a.tipo) && (a.subido_por === sesion.usuarioId || sesion.esDentista) && (
                        <div className="mt-auto pt-2"><AnularArchivo pacienteId={id} id={a.id} descripcion={titulo} /></div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
