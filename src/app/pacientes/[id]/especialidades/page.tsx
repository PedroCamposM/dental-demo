import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertasPaciente } from "@/components/alertas-paciente";
import { Encabezado } from "@/components/encabezado";
import { FASES_IMPLANTE, type TipoRegistro } from "@/lib/clinico/especialidades";
import { fechaLima, formatearFecha } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { abrirHistoria } from "../datos-clinicos";
import { cargarRegistros, describirRegistro } from "../evolucion/registros";
import { PestanasPaciente } from "../pestanas";

export const metadata: Metadata = { title: "Especialidades – Dental Demo" };

type Item = { id: string; procedimiento: string; pieza: number | null; estado: string };
type Nota = { id: string; fecha: string; firmada_at: string | null; anulado_at: string | null };

/** Historial por especialidad: lo registrado en cada sesión, agrupado por ítem del plan. */
export default async function Especialidades({ params }: { params: Promise<{ id: string }> }) {
  if (!modulos.etapa9) notFound();
  const { id } = await params;
  const { sesion, paciente } = await abrirHistoria(id);
  const supabase = await createClient();
  const [{ registros, error: errorRegistros }, notas, planes] = await Promise.all([
    cargarRegistros(supabase, id),
    supabase.from("nota_evolucion").select("id, fecha, firmada_at, anulado_at").eq("paciente_id", id).returns<Nota[]>(),
    supabase.from("plan_tratamiento").select("id").eq("paciente_id", id).returns<{ id: string }[]>(),
  ]);
  const idsPlanes = (planes.data ?? []).map((p) => p.id);
  const items = idsPlanes.length > 0
    ? await supabase.from("item_plan").select("id, procedimiento, pieza, estado").in("plan_id", idsPlanes).returns<Item[]>()
    : { data: [] as Item[], error: null };
  const error = errorRegistros || !!notas.error || !!planes.error || !!items.error;
  if (notas.error ?? planes.error ?? items.error) registrarError("especialidades.ver", notas.error ?? planes.error ?? items.error, { paciente: id });

  const nota = new Map((notas.data ?? []).map((n) => [n.id, n]));
  const item = new Map((items.data ?? []).map((i) => [i.id, i]));
  // Lo de evoluciones anuladas o registros anulados no cuenta en el historial.
  const vigente = (r: { nota_id: string; anulado_at: string | null }) => !r.anulado_at && !nota.get(r.nota_id)?.anulado_at;
  const sesionDe = (notaId: string) => {
    const n = nota.get(notaId);
    return n ? `${formatearFecha(fechaLima(n.fecha))}${n.firmada_at ? "" : " (borrador)"}` : "—";
  };
  const nombreItem = (itemId: string | null) => {
    const i = itemId ? item.get(itemId) : undefined;
    return i ? `${i.procedimiento}${i.pieza ? ` · pieza ${i.pieza}` : ""}` : "Sin ítem";
  };
  const porItem = <T extends { item_plan_id: string | null }>(lista: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of lista) m.set(r.item_plan_id ?? "", [...(m.get(r.item_plan_id ?? "") ?? []), r]);
    return [...m.entries()];
  };

  const endo = porItem(registros.endodoncia.filter(vigente));
  const casos = registros.ortodoncia_caso.filter(vigente);
  const controles = registros.ortodoncia_control.filter(vigente);
  const itemsOrto = [...new Set([...casos.map((c) => c.item_plan_id), ...controles.map((c) => c.item_plan_id)])];
  const implantes = registros.implante.filter(vigente);
  const cirugias = registros.cirugia.filter(vigente);
  const pediatria = registros.odontopediatria.filter(vigente);
  const vacio = endo.length + itemsOrto.length + implantes.length + cirugias.length + pediatria.length === 0;

  const Lista = ({ tipo, filas }: { tipo: TipoRegistro; filas: { id: string; nota_id: string }[] }) => (
    <ul className="mt-1 flex flex-col gap-1 text-sm">
      {filas.map((r) => (
        <li key={r.id}><span className="text-xs text-gray-500">{sesionDe(r.nota_id)} · </span>
          {describirRegistro(tipo, r as unknown as Parameters<typeof describirRegistro>[1])}</li>
      ))}
    </ul>
  );

  return (
    <>
      <Encabezado sesion={sesion} seccion="pacientes" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <AlertasPaciente pacienteId={id} />
        <Link href="/pacientes" className="text-sm font-medium text-teal-700 hover:underline">← Pacientes</Link>
        <h1 className="mt-3 text-2xl font-semibold">{paciente.nombres} {paciente.apellidos}</h1>
        <PestanasPaciente id={id} actual="especialidades" veClinico={sesion.veClinico} />
        {error && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo cargar todo. Recarga la página.</p>}
        <p className="mt-6 text-sm text-gray-600">
          Se registran en la evolución de cada sesión. La periodoncia se sigue en el{" "}
          <Link href={`/pacientes/${id}/periodontograma`} className="text-teal-800 hover:underline">periodontograma</Link>.
        </p>
        {vacio && <p className="mt-4 text-sm text-gray-500">Aún no hay registros de especialidad.</p>}

        {endo.length > 0 && (
          <section aria-labelledby="t-endo" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
            <h2 id="t-endo" className="text-lg font-semibold">Endodoncia</h2>
            {endo.map(([itemId, filas]) => (
              <div key={itemId} className="mt-3">
                <h3 className="font-medium">{nombreItem(itemId)}
                  <span className="ml-2 text-sm font-normal text-gray-600">
                    {new Set(filas.map((f) => f.nota_id)).size} sesión(es) · {item.get(itemId)?.estado === "realizado" ? "terminada" : "en curso"}
                  </span>
                </h3>
                <Lista tipo="endodoncia" filas={filas} />
              </div>
            ))}
          </section>
        )}

        {itemsOrto.length > 0 && (
          <section aria-labelledby="t-orto" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
            <h2 id="t-orto" className="text-lg font-semibold">Ortodoncia</h2>
            {itemsOrto.map((itemId) => (
              <div key={itemId} className="mt-3">
                <h3 className="font-medium">{nombreItem(itemId)}</h3>
                <Lista tipo="ortodoncia_caso" filas={casos.filter((c) => c.item_plan_id === itemId)} />
                <h4 className="mt-2 text-sm font-medium text-gray-700">
                  Controles ({controles.filter((c) => c.item_plan_id === itemId).length})
                </h4>
                <Lista tipo="ortodoncia_control" filas={controles.filter((c) => c.item_plan_id === itemId)} />
                <p className="mt-1 text-xs text-gray-500">Las fotos de evolución se guardan en Imágenes y archivos, con su sesión.</p>
              </div>
            ))}
          </section>
        )}

        {implantes.length > 0 && (
          <section aria-labelledby="t-impl" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
            <h2 id="t-impl" className="text-lg font-semibold">Implantes</h2>
            {implantes.map((imp) => {
              const fases = registros.implante_fase.filter((f) => f.implante_id === imp.id && vigente(f));
              const actual = fases.at(-1);
              const carga = fases.find((f) => f.fase === "carga");
              return (
                <div key={imp.id} className="mt-3">
                  <h3 className="font-medium">Pieza {imp.pieza}
                    <span className="ml-2 text-sm font-normal text-gray-600">
                      {actual ? FASES_IMPLANTE[actual.fase] : "—"}{carga ? ` · fecha de carga ${formatearFecha(carga.fecha)}` : ""}
                    </span>
                  </h3>
                  <Lista tipo="implante" filas={[imp]} />
                  <Lista tipo="implante_fase" filas={fases} />
                </div>
              );
            })}
          </section>
        )}

        {cirugias.length > 0 && (
          <section aria-labelledby="t-cir" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
            <h2 id="t-cir" className="text-lg font-semibold">Cirugía</h2>
            {porItem(cirugias).map(([itemId, filas]) => (
              <div key={itemId} className="mt-3">
                <h3 className="font-medium">{nombreItem(itemId)}</h3>
                <Lista tipo="cirugia" filas={filas} />
              </div>
            ))}
          </section>
        )}

        {pediatria.length > 0 && (
          <section aria-labelledby="t-ped" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
            <h2 id="t-ped" className="text-lg font-semibold">Odontopediatría</h2>
            <Lista tipo="odontopediatria" filas={pediatria} />
          </section>
        )}
      </main>
    </>
  );
}
