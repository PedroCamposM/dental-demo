import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertasPaciente } from "@/components/alertas-paciente";
import { Encabezado } from "@/components/encabezado";
import { ESTADOS_CONSENTIMIENTO, FINES_IMAGEN, type EstadoConsentimiento, type FinImagen } from "@/lib/clinico/consentimientos";
import { fechaLima, formatearFecha, horaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { abrirHistoria } from "../datos-clinicos";
import { PestanasPaciente } from "../pestanas";
import {
  CambiarConsentimiento, GenerarProcedimiento, GenerarUsoImagen, RegistrarFirma,
  type OpcionItem, type OpcionPlantilla,
} from "./formularios";

export const metadata: Metadata = { title: "Consentimientos – Dental Demo" };

type Consentimiento = {
  id: string; tipo: "procedimiento" | "uso_imagen"; titulo: string; item_plan_id: string | null; fines: FinImagen[] | null;
  profesional_id: string; representante_nombre: string | null; creado_at: string; estado: EstadoConsentimiento;
  decidido_el: string | null; es_ejemplo: boolean; motivo_revocacion: string | null; revocado_at: string | null;
  anulado_at: string | null; motivo_anulacion: string | null; archivo_clinico: { ruta: string } | null;
};
type Item = { id: string; plan_id: string; procedimiento: string; pieza: number | null; estado: string; procedimiento_id: string | null };

const COLOR: Record<EstadoConsentimiento, string> = {
  pendiente: "bg-amber-50 text-amber-800", firmado: "bg-teal-50 text-teal-800",
  negado: "bg-red-50 text-red-800", revocado: "bg-gray-100 text-gray-700",
};
const fechaHora = (iso: string) => `${formatearFecha(fechaLima(iso))}, ${horaLima(iso)}`;

export default async function Consentimientos({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ item?: string }>;
}) {
  const { id } = await params;
  const { item: itemInicial } = await searchParams;
  if (!modulos.etapa7) notFound();
  const { sesion, paciente } = await abrirHistoria(id);
  const supabase = await createClient();

  const [consentimientos, planes, plantillas, equipo] = await Promise.all([
    supabase.from("consentimiento")
      .select("id, tipo, titulo, item_plan_id, fines, profesional_id, representante_nombre, creado_at, estado, decidido_el, "
        + "es_ejemplo, motivo_revocacion, revocado_at, anulado_at, motivo_anulacion, archivo_clinico(ruta)")
      .eq("paciente_id", id).order("creado_at", { ascending: false }).returns<Consentimiento[]>(),
    supabase.from("plan_tratamiento").select("id, titulo").eq("paciente_id", id).not("estado", "in", "(rechazado,reemplazado)")
      .returns<{ id: string; titulo: string }[]>(),
    supabase.from("plantilla_consentimiento").select("id, tipo, nombre, es_ejemplo").eq("activa", true).order("nombre")
      .returns<{ id: string; tipo: string; nombre: string; es_ejemplo: boolean }[]>(),
    supabase.from("usuario").select("id, nombre, cop").returns<{ id: string; nombre: string; cop: string | null }[]>(),
  ]);
  const idsPlanes = (planes.data ?? []).map((p) => p.id);
  const items = idsPlanes.length > 0
    ? await supabase.from("item_plan").select("id, plan_id, procedimiento, pieza, estado, procedimiento_id")
        .in("plan_id", idsPlanes).in("estado", ["propuesto", "aceptado", "programado"]).order("orden").returns<Item[]>()
    : { data: [] as Item[], error: null };
  const idsProc = [...new Set((items.data ?? []).flatMap((i) => (i.procedimiento_id ? [i.procedimiento_id] : [])))];
  const catalogo = idsProc.length > 0
    ? await supabase.from("procedimiento").select("id, requiere_consentimiento, consentimiento_plantilla_id").in("id", idsProc)
        .returns<{ id: string; requiere_consentimiento: boolean; consentimiento_plantilla_id: string | null }[]>()
    : { data: [], error: null };
  const lista = consentimientos.data ?? [];
  const rutas = lista.flatMap((c) => (c.archivo_clinico ? [c.archivo_clinico.ruta] : []));
  const firmadas = rutas.length > 0
    ? await supabase.storage.from("clinico").createSignedUrls(rutas, 300) : { data: [], error: null };
  const error = consentimientos.error ?? planes.error ?? plantillas.error ?? items.error ?? catalogo.error ?? firmadas.error;
  if (error) registrarError("consentimientos.listar", error, { paciente: id });

  const url = new Map((firmadas.data ?? []).flatMap((f) => (f.path && f.signedUrl ? [[f.path, f.signedUrl] as const] : [])));
  const autor = new Map((equipo.data ?? []).map((u) => [u.id, u.cop ? `${u.nombre} (COP ${u.cop})` : u.nombre]));
  const proc = new Map((catalogo.data ?? []).map((p) => [p.id, p]));
  const plan = new Map((planes.data ?? []).map((p) => [p.id, p.titulo]));
  const vigentePorItem = new Set(lista.filter((c) => !c.anulado_at && (c.estado === "pendiente" || c.estado === "firmado"))
    .flatMap((c) => (c.item_plan_id ? [c.item_plan_id] : [])));
  const opciones: OpcionItem[] = (items.data ?? []).filter((i) => !vigentePorItem.has(i.id)).map((i) => {
    const p = i.procedimiento_id ? proc.get(i.procedimiento_id) : undefined;
    return {
      id: i.id, texto: `${i.procedimiento}${i.pieza ? ` (pieza ${i.pieza})` : ""} · ${plan.get(i.plan_id) ?? "Plan"}`,
      plantillaId: p?.consentimiento_plantilla_id ?? null, requiere: p?.requiere_consentimiento ?? false,
    };
  }).sort((a, b) => Number(b.requiere) - Number(a.requiere));
  const faltan = opciones.filter((o) => o.requiere);
  const deProc: OpcionPlantilla[] = (plantillas.data ?? []).filter((p) => p.tipo === "procedimiento")
    .map((p) => ({ id: p.id, nombre: p.nombre, ejemplo: p.es_ejemplo }));
  const deImagen: OpcionPlantilla[] = (plantillas.data ?? []).filter((p) => p.tipo === "uso_imagen")
    .map((p) => ({ id: p.id, nombre: p.nombre, ejemplo: p.es_ejemplo }));
  const imagenVigente = lista.some((c) => c.tipo === "uso_imagen" && !c.anulado_at && (c.estado === "pendiente" || c.estado === "firmado"));
  const hoy = fechaLima(new Date());
  const puedeGenerar = sesion.esDentista && !paciente.anulado_at;

  return (
    <>
      <Encabezado sesion={sesion} seccion="pacientes" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <AlertasPaciente pacienteId={id} />
        <Link href="/pacientes" className="text-sm font-medium text-teal-700 hover:underline">← Pacientes</Link>
        <h1 className="mt-3 text-2xl font-semibold">{paciente.nombres} {paciente.apellidos}</h1>
        <PestanasPaciente id={id} actual="consentimientos" veClinico={sesion.veClinico} />

        {error && (
          <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            No se pudo cargar todo. Recarga la página.
          </p>
        )}
        <p className="mt-6 text-sm text-gray-600">
          El consentimiento se imprime y lo firma a mano el paciente o su representante, con su huella (NTS 139). Luego se sube
          el escaneo: recién entonces cuenta como firmado y el procedimiento se puede marcar como realizado.
        </p>

        {faltan.length > 0 && (
          <section aria-labelledby="t-faltan" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h2 id="t-faltan" className="font-semibold text-amber-900">Requieren consentimiento y aún no tienen formato</h2>
            <ul className="mt-1 list-disc pl-5 text-sm text-amber-900">
              {faltan.map((f) => <li key={f.id}>{f.texto}</li>)}
            </ul>
          </section>
        )}

        {puedeGenerar && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section aria-labelledby="t-generar" className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 id="t-generar" className="mb-3 text-lg font-semibold">Consentimiento de un procedimiento</h2>
              <GenerarProcedimiento pacienteId={id} items={opciones} plantillas={deProc} itemInicial={itemInicial} />
            </section>
            <section aria-labelledby="t-imagen" className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 id="t-imagen" className="mb-3 text-lg font-semibold">Uso de imagen (opcional)</h2>
              {imagenVigente
                ? <p className="text-sm text-gray-600">El paciente ya tiene un consentimiento de uso de imagen vigente o pendiente.</p>
                : <GenerarUsoImagen pacienteId={id} plantillas={deImagen} />}
            </section>
          </div>
        )}

        <section aria-labelledby="t-lista" className="mt-8">
          <h2 id="t-lista" className="text-lg font-semibold">Consentimientos del paciente</h2>
          {lista.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">Aún no hay consentimientos.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {lista.map((c) => {
                const escaneo = c.archivo_clinico ? url.get(c.archivo_clinico.ruta) : undefined;
                return (
                  <li key={c.id} data-consentimiento={c.id}
                    className={`rounded-xl border border-gray-200 bg-white p-4 ${c.anulado_at ? "opacity-60" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className={`font-medium ${c.anulado_at ? "line-through" : ""}`}>{c.titulo}</p>
                        <p className="text-sm text-gray-600">
                          Generado el {fechaHora(c.creado_at)} · responsable {autor.get(c.profesional_id) ?? "—"}
                          {c.representante_nombre && ` · firma su representante: ${c.representante_nombre}`}
                        </p>
                        {c.fines && <p className="text-sm text-gray-600">Fines: {c.fines.map((f) => FINES_IMAGEN[f]).join(" y ")}</p>}
                      </div>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${c.anulado_at ? "bg-gray-100 text-gray-500" : COLOR[c.estado]}`}>
                        {c.anulado_at ? "Anulado" : ESTADOS_CONSENTIMIENTO[c.estado]}
                      </span>
                    </div>
                    {c.decidido_el && <p className="mt-1 text-sm">Firmado el {formatearFecha(c.decidido_el)}.</p>}
                    {c.revocado_at && <p className="mt-1 text-sm">Revocado el {fechaHora(c.revocado_at)}: {c.motivo_revocacion}</p>}
                    {c.anulado_at && <p className="mt-1 text-sm">Anulado: {c.motivo_anulacion}</p>}
                    {c.es_ejemplo && c.estado === "pendiente" && !c.anulado_at && (
                      <p className="mt-1 text-xs text-amber-800">Usa una plantilla de ejemplo que la clínica aún no revisa.</p>
                    )}
                    <div className="mt-3 flex flex-col gap-2">
                      <div className="flex flex-wrap gap-4 text-sm">
                        {!c.anulado_at && (
                          <Link href={`/pacientes/${id}/consentimientos/${c.id}/imprimir`} target="_blank"
                            className="font-medium text-teal-700 hover:underline">
                            Imprimir formato
                          </Link>
                        )}
                        {escaneo && (
                          <a href={escaneo} target="_blank" rel="noopener noreferrer" className="font-medium text-teal-700 hover:underline">
                            Ver formato firmado
                          </a>
                        )}
                      </div>
                      {!c.anulado_at && c.estado === "pendiente" && !paciente.anulado_at && (
                        <RegistrarFirma clinicaId={sesion.clinicaId} pacienteId={id} id={c.id} titulo={c.titulo} hoy={hoy} />
                      )}
                      {!c.anulado_at && c.estado === "pendiente" && sesion.esDentista && (
                        <CambiarConsentimiento pacienteId={id} id={c.id} accion="anular" titulo={c.titulo} />
                      )}
                      {c.estado === "firmado" && sesion.esDentista && (
                        <CambiarConsentimiento pacienteId={id} id={c.id} accion="revocar" titulo={c.titulo} />
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
