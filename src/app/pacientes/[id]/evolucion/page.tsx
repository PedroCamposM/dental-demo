import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertasPaciente } from "@/components/alertas-paciente";
import { Encabezado } from "@/components/encabezado";
import { SUPERFICIES, type Superficie } from "@/lib/clinico/diagnostico";
import { CAMPOS_EVOLUCION, LISTA_CAMPOS_EVOLUCION, type CampoEvolucion } from "@/lib/clinico/evolucion";
import { fechaLima, formatearFecha, horaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { nombreVersion } from "@/lib/plan/plan";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { abrirHistoria } from "../datos-clinicos";
import { PestanasPaciente } from "../pestanas";
import { Adenda, AnularEvolucion, EditorEvolucion, NuevaEvolucion, type ItemPendiente } from "./formularios";

export const metadata: Metadata = { title: "Evolución – Dental Demo" };

type Nota = Record<Exclude<CampoEvolucion, "texto">, string | null> & {
  id: string; texto: string; cie10: string | null; fecha: string; cita_id: string | null; odontologo_id: string;
  firmada_at: string | null; anulado_at: string | null; motivo_anulacion: string | null;
  cita: { inicio: string } | null;
  evolucion_adenda: { id: string; texto: string; registrado_at: string; registrado_por: string | null }[];
  evolucion_item: { item_id: string; trabajado: boolean; terminado: boolean }[];
};
type Item = {
  id: string; plan_id: string; procedimiento: string; pieza: number | null; superficies: Superficie[] | null;
  estado: string; nota_evolucion_id: string | null; fase: number | null; orden: number;
};
type Plan = { id: string; titulo: string; version: number; alternativa: string; estado: string };

const fechaHora = (iso: string) => `${formatearFecha(fechaLima(iso))}, ${horaLima(iso)}`;
const describir = (i: Pick<Item, "procedimiento" | "pieza" | "superficies">) =>
  `${i.procedimiento}${i.pieza === null ? "" : ` · pieza ${i.pieza}`}${
    i.superficies?.length ? ` (${i.superficies.map((s) => SUPERFICIES[s].toLowerCase()).join(", ")})` : ""}`;

export default async function Evolucion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!modulos.etapa6) notFound();
  const { sesion, paciente } = await abrirHistoria(id);
  const supabase = await createClient();

  const [notas, planes, equipo] = await Promise.all([
    supabase.from("nota_evolucion")
      .select("id, texto, cie10, fecha, cita_id, odontologo_id, firmada_at, anulado_at, motivo_anulacion, "
        + LISTA_CAMPOS_EVOLUCION.filter((c) => c !== "texto").join(", ")
        + ", cita(inicio), evolucion_adenda(id, texto, registrado_at, registrado_por), evolucion_item(item_id, trabajado, terminado)")
      .eq("paciente_id", id).order("fecha", { ascending: false }).limit(100).returns<Nota[]>(),
    supabase.from("plan_tratamiento").select("id, titulo, version, alternativa, estado").eq("paciente_id", id)
      .returns<Plan[]>(),
    supabase.from("usuario").select("id, nombre, cop").returns<{ id: string; nombre: string; cop: string | null }[]>(),
  ]);
  const idsPlanes = (planes.data ?? []).map((p) => p.id);
  const items = idsPlanes.length > 0
    ? await supabase.from("item_plan")
        .select("id, plan_id, procedimiento, pieza, superficies, estado, nota_evolucion_id, fase, orden")
        .in("plan_id", idsPlanes).order("fase", { nullsFirst: true }).order("orden").returns<Item[]>()
    : { data: [] as Item[], error: null };
  const error = notas.error ?? planes.error ?? items.error;
  if (error) registrarError("evolucion.listar", error, { paciente: id });

  // NTS 139: cada evolución con el nombre y la colegiatura de quien la firma.
  const autor = new Map((equipo.data ?? []).map((u) => [u.id, u.cop ? `${u.nombre} (COP ${u.cop})` : u.nombre]));
  const plan = new Map((planes.data ?? []).map((p) => [p.id, p]));
  const conAlternativas = (planes.data ?? []).some((p) => p.alternativa !== "A");
  const todos = new Map((items.data ?? []).map((i) => [i.id, i]));
  const pendientes: ItemPendiente[] = (items.data ?? [])
    .filter((i) => i.estado === "aceptado" || i.estado === "programado")
    .map((i) => {
      const p = plan.get(i.plan_id);
      return { id: i.id, descripcion: describir(i), plan: p ? `${p.titulo} (${nombreVersion(p, conAlternativas)})` : "Plan" };
    });
  const lista = notas.data ?? [];
  const borradores = lista.filter((n) => !n.firmada_at && !n.anulado_at);
  const resto = lista.filter((n) => n.firmada_at || n.anulado_at);

  return (
    <>
      <Encabezado sesion={sesion} seccion="pacientes" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <AlertasPaciente pacienteId={id} />
        <Link href="/pacientes" className="text-sm font-medium text-teal-700 hover:underline">← Pacientes</Link>
        <h1 className="mt-3 text-2xl font-semibold">{paciente.nombres} {paciente.apellidos}</h1>
        <PestanasPaciente id={id} actual="evolucion" veClinico={sesion.veClinico} />

        {error && (
          <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            No se pudo cargar toda la evolución. Recarga la página.
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            Cada sesión se abre desde la agenda con «Atender». La evolución firmada ya no se edita: solo admite adendas.
          </p>
          {sesion.esDentista && !paciente.anulado_at && <NuevaEvolucion pacienteId={id} />}
        </div>

        {borradores.length > 0 && (
          <section aria-labelledby="t-borradores" className="mt-6 flex flex-col gap-4">
            <h2 id="t-borradores" className="text-lg font-semibold">En curso (sin firmar)</h2>
            {borradores.map((n) => {
              const propio = n.odontologo_id === sesion.usuarioId && sesion.esDentista;
              return (
                <article key={n.id} id={`evolucion-${n.id}`} aria-label={`Evolución en borrador del ${fechaHora(n.fecha)}`}
                  className="scroll-mt-4 rounded-xl border-2 border-amber-300 bg-white p-5">
                  <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold">
                      Borrador · {n.cita ? `cita del ${fechaHora(n.cita.inicio)}` : `abierta el ${fechaHora(n.fecha)}`}
                    </p>
                    <p className="text-sm text-gray-600">{autor.get(n.odontologo_id) ?? "Profesional"}</p>
                  </header>
                  {propio ? (
                    <>
                      <EditorEvolucion pacienteId={id} notaId={n.id} items={pendientes}
                        guardado={Object.fromEntries(LISTA_CAMPOS_EVOLUCION.map((c) => [c, (c === "texto" ? n.texto : n[c]) ?? ""])) as Record<CampoEvolucion, string>}
                        marcados={{
                          trabajados: n.evolucion_item.filter((e) => e.trabajado).map((e) => e.item_id),
                          terminados: n.evolucion_item.filter((e) => e.terminado).map((e) => e.item_id),
                        }} />
                      <div className="mt-4 border-t border-gray-100 pt-3">
                        <AnularEvolucion pacienteId={id} notaId={n.id} borrador />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-600">
                      Solo su autor la edita y la firma. {n.texto ? <span className="whitespace-pre-line">{n.texto}</span> : "Aún sin descripción."}
                    </p>
                  )}
                </article>
              );
            })}
          </section>
        )}

        <section aria-labelledby="t-firmadas" className="mt-8">
          <h2 id="t-firmadas" className="text-lg font-semibold">Evoluciones firmadas y anuladas</h2>
          {resto.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">Aún no hay evoluciones firmadas.</p>
          ) : (
            <ol className="mt-3 flex flex-col gap-4">
              {resto.map((n) => {
                const realizados = (items.data ?? []).filter((i) => i.nota_evolucion_id === n.id);
                const trabajados = n.evolucion_item.filter((e) => e.trabajado && !realizados.some((r) => r.id === e.item_id))
                  .flatMap((e) => (todos.get(e.item_id) ? [todos.get(e.item_id) as Item] : []));
                return (
                  <li key={n.id} id={`evolucion-${n.id}`}
                    className={`scroll-mt-4 rounded-xl border border-gray-200 bg-white p-5 ${n.anulado_at ? "opacity-60" : ""}`}>
                    <header className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold">
                        {fechaHora(n.fecha)}
                        {n.cita && <span className="font-normal text-gray-600"> · cita del {fechaHora(n.cita.inicio)}</span>}
                      </p>
                      <p className="text-sm text-gray-600">
                        {n.firmada_at ? "Firmada por" : "Borrador anulado ·"} {autor.get(n.odontologo_id) ?? "Profesional"}
                        {n.firmada_at && fechaLima(n.firmada_at) !== fechaLima(n.fecha) && ` el ${fechaHora(n.firmada_at)}`}
                      </p>
                    </header>
                    {n.anulado_at && (
                      <p className="mt-2 text-sm font-medium text-gray-700">Anulada: {n.motivo_anulacion}</p>
                    )}
                    <p className={`mt-2 whitespace-pre-line ${n.anulado_at ? "line-through" : ""}`}>{n.texto}</p>
                    {n.cie10 && <p className="mt-1 text-sm text-gray-600">CIE-10: {n.cie10}</p>}
                    <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                      {LISTA_CAMPOS_EVOLUCION.filter((c) => c !== "texto" && n[c]).map((c) => (
                        <div key={c}>
                          <dt className="text-xs uppercase tracking-wide text-gray-500">{CAMPOS_EVOLUCION[c].etiqueta}</dt>
                          <dd className="whitespace-pre-line">{n[c as Exclude<CampoEvolucion, "texto">]}</dd>
                        </div>
                      ))}
                    </dl>
                    {(realizados.length > 0 || trabajados.length > 0) && (
                      <ul className="mt-3 flex flex-col gap-1 text-sm">
                        {realizados.map((i) => (
                          <li key={i.id}><span className="rounded bg-teal-50 px-1.5 py-0.5 text-xs text-teal-800">Realizado</span> {describir(i)}</li>
                        ))}
                        {trabajados.map((i) => (
                          <li key={i.id}><span className="rounded bg-sky-50 px-1.5 py-0.5 text-xs text-sky-800">Trabajado</span> {describir(i)}</li>
                        ))}
                      </ul>
                    )}
                    {n.evolucion_adenda.length > 0 && (
                      <ul className="mt-3 flex flex-col gap-2 border-l-2 border-gray-200 pl-3 text-sm">
                        {[...n.evolucion_adenda].sort((a, b) => a.registrado_at.localeCompare(b.registrado_at)).map((a) => (
                          <li key={a.id}>
                            <p className="text-xs text-gray-500">
                              Adenda · {fechaHora(a.registrado_at)} · {a.registrado_por ? autor.get(a.registrado_por) ?? "Profesional" : "Sistema"}
                            </p>
                            <p className="whitespace-pre-line">{a.texto}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                    {!n.anulado_at && sesion.esDentista && (
                      <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3">
                        <Adenda pacienteId={id} notaId={n.id} />
                        {n.odontologo_id === sesion.usuarioId && realizados.length === 0 && (
                          <AnularEvolucion pacienteId={id} notaId={n.id} borrador={false} />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </main>
    </>
  );
}
