import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertasPaciente } from "@/components/alertas-paciente";
import { Encabezado } from "@/components/encabezado";
import { ESTADOS_INTERCONSULTA, type EstadoInterconsulta, type TipoInterconsulta } from "@/lib/clinico/interconsultas";
import { fechaLima, formatearFecha, horaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { abrirHistoria } from "../datos-clinicos";
import { PestanasPaciente } from "../pestanas";
import { Cancelar, PedirInterconsulta, Responder } from "./formularios";

export const metadata: Metadata = { title: "Interconsultas – Dental Demo" };

type Interconsulta = {
  id: string; tipo: TipoInterconsulta; solicitante_id: string; destinatario_id: string | null; destino: string | null;
  motivo: string; datos_clinicos: string | null; creada_at: string; estado: EstadoInterconsulta; respuesta: string | null;
  respondida_at: string | null; respondida_por: string | null; motivo_cancelacion: string | null;
  archivo_clinico: { ruta: string } | null;
};

const COLOR: Record<EstadoInterconsulta, string> = {
  pendiente: "bg-amber-50 text-amber-800", respondida: "bg-teal-50 text-teal-800", cancelada: "bg-gray-100 text-gray-500",
};
const fechaHora = (iso: string) => `${formatearFecha(fechaLima(iso))}, ${horaLima(iso)}`;

export default async function Interconsultas({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!modulos.etapa7) notFound();
  const { sesion, paciente } = await abrirHistoria(id);
  const supabase = await createClient();
  const [lista, equipo, notas] = await Promise.all([
    supabase.from("interconsulta")
      .select("id, tipo, solicitante_id, destinatario_id, destino, motivo, datos_clinicos, creada_at, estado, respuesta, "
        + "respondida_at, respondida_por, motivo_cancelacion, archivo_clinico(ruta)")
      .eq("paciente_id", id).order("creada_at", { ascending: false }).returns<Interconsulta[]>(),
    supabase.from("usuario").select("id, nombre, rol, cop, activo")
      .returns<{ id: string; nombre: string; rol: string; cop: string | null; activo: boolean }[]>(),
    supabase.from("nota_evolucion").select("id, fecha, texto").eq("paciente_id", id).is("anulado_at", null)
      .order("fecha", { ascending: false }).limit(20).returns<{ id: string; fecha: string; texto: string }[]>(),
  ]);
  const items = lista.data ?? [];
  const rutas = items.flatMap((i) => (i.archivo_clinico ? [i.archivo_clinico.ruta] : []));
  const firmadas = rutas.length > 0 ? await supabase.storage.from("clinico").createSignedUrls(rutas, 300) : { data: [], error: null };
  const error = lista.error ?? equipo.error ?? notas.error ?? firmadas.error;
  if (error) registrarError("interconsultas.listar", error, { paciente: id });
  const url = new Map((firmadas.data ?? []).flatMap((f) => (f.path && f.signedUrl ? [[f.path, f.signedUrl] as const] : [])));
  const nombre = new Map((equipo.data ?? []).map((u) => [u.id, u.nombre]));
  const profesionales = (equipo.data ?? [])
    .filter((u) => u.activo && (u.rol === "admin" || u.rol === "odontologo") && u.cop && u.id !== sesion.usuarioId)
    .map((u) => ({ id: u.id, nombre: u.nombre }));
  const sesiones = (notas.data ?? []).map((n) => ({
    id: n.id, texto: `${formatearFecha(fechaLima(n.fecha))} · ${n.texto.slice(0, 60) || "Evolución en borrador"}`,
  }));

  return (
    <>
      <Encabezado sesion={sesion} seccion="pacientes" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <AlertasPaciente pacienteId={id} />
        <Link href="/pacientes" className="text-sm font-medium text-teal-700 hover:underline">← Pacientes</Link>
        <h1 className="mt-3 text-2xl font-semibold">{paciente.nombres} {paciente.apellidos}</h1>
        <PestanasPaciente id={id} actual="interconsultas" veClinico={sesion.veClinico} />
        {error && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo cargar todo. Recarga la página.</p>}

        {sesion.esDentista && !paciente.anulado_at && (
          <section aria-labelledby="t-nueva" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
            <h2 id="t-nueva" className="mb-3 text-lg font-semibold">Nueva interconsulta o derivación</h2>
            <PedirInterconsulta pacienteId={id} profesionales={profesionales} sesiones={sesiones} />
          </section>
        )}

        <section aria-labelledby="t-lista" className="mt-8">
          <h2 id="t-lista" className="text-lg font-semibold">Interconsultas del paciente</h2>
          {items.length === 0 ? <p className="mt-2 text-sm text-gray-500">Aún no hay interconsultas.</p> : (
            <ul className="mt-3 flex flex-col gap-3">
              {items.map((i) => {
                const para = i.tipo === "interna" ? nombre.get(i.destinatario_id ?? "") ?? "Profesional" : i.destino ?? "—";
                const documento = i.archivo_clinico ? url.get(i.archivo_clinico.ruta) : undefined;
                const puedeResponder = i.estado === "pendiente"
                  && (i.tipo === "interna" ? i.destinatario_id === sesion.usuarioId : sesion.veClinico);
                return (
                  <li key={i.id} data-interconsulta={i.id} className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{i.tipo === "interna" ? "Interna" : "Externa"} · para {para}</p>
                        <p className="text-sm text-gray-600">Pedida el {fechaHora(i.creada_at)} por {nombre.get(i.solicitante_id) ?? "—"}</p>
                      </div>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${COLOR[i.estado]}`}>{ESTADOS_INTERCONSULTA[i.estado]}</span>
                    </div>
                    <p className="mt-2 text-sm"><b>Motivo:</b> {i.motivo}</p>
                    {i.datos_clinicos && <p className="mt-1 whitespace-pre-line text-sm"><b>Datos clínicos:</b> {i.datos_clinicos}</p>}
                    {i.respuesta && i.respondida_at && (
                      <div className="mt-2 rounded-md bg-gray-50 p-2 text-sm">
                        <p className="text-xs text-gray-500">
                          Respuesta · {fechaHora(i.respondida_at)} · registró {nombre.get(i.respondida_por ?? "") ?? "—"}
                        </p>
                        <p className="whitespace-pre-line">{i.respuesta}</p>
                        {documento && (
                          <a href={documento} target="_blank" rel="noopener noreferrer" className="font-medium text-teal-700 hover:underline">
                            Ver documento de respuesta
                          </a>
                        )}
                      </div>
                    )}
                    {i.estado === "cancelada" && <p className="mt-1 text-sm">Cancelada: {i.motivo_cancelacion}</p>}
                    <div className="mt-2 flex flex-col gap-2">
                      {i.tipo === "externa" && i.estado !== "cancelada" && (
                        <Link href={`/pacientes/${id}/interconsultas/${i.id}`} target="_blank"
                          className="text-sm font-medium text-teal-700 hover:underline">Imprimir interconsulta</Link>
                      )}
                      {puedeResponder && !paciente.anulado_at && (
                        <Responder clinicaId={sesion.clinicaId} pacienteId={id} id={i.id} externa={i.tipo === "externa"} />
                      )}
                      {i.estado === "pendiente" && i.solicitante_id === sesion.usuarioId && <Cancelar pacienteId={id} id={i.id} />}
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
