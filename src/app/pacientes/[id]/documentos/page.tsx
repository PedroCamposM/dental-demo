import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertasPaciente } from "@/components/alertas-paciente";
import { Encabezado } from "@/components/encabezado";
import { finDescanso, TIPOS_CONSTANCIA, tratamientoDelDia, type TipoConstancia } from "@/lib/clinico/documentos";
import { fechaLima, formatearFecha, horaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { abrirHistoria } from "../datos-clinicos";
import { PestanasPaciente } from "../pestanas";
import { AnularDocumento, FormularioConstancia, FormularioReceta, QuitarPlantilla, type PlantillaReceta } from "./formularios";

export const metadata: Metadata = { title: "Recetas y documentos – Dental Demo" };

type Receta = {
  id: string; profesional_id: string; indicaciones: string | null; emitida_at: string; anulado_at: string | null;
  motivo_anulacion: string | null;
  receta_item: { orden: number; medicamento: string; presentacion: string; dosis: string; frecuencia: string; duracion: string }[];
};
type Constancia = {
  id: string; profesional_id: string; tipo: TipoConstancia; fecha_atencion: string; descanso_desde: string | null;
  descanso_dias: number | null; emitida_at: string; anulado_at: string | null; motivo_anulacion: string | null;
};

const fechaHora = (iso: string) => `${formatearFecha(fechaLima(iso))}, ${horaLima(iso)}`;

export default async function Documentos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!modulos.etapa7) notFound();
  const { sesion, paciente } = await abrirHistoria(id);
  const supabase = await createClient();
  const [recetas, constancias, plantillas, notas, equipo] = await Promise.all([
    supabase.from("receta")
      .select("id, profesional_id, indicaciones, emitida_at, anulado_at, motivo_anulacion, "
        + "receta_item(orden, medicamento, presentacion, dosis, frecuencia, duracion)")
      .eq("paciente_id", id).order("emitida_at", { ascending: false }).limit(50).returns<Receta[]>(),
    supabase.from("constancia")
      .select("id, profesional_id, tipo, fecha_atencion, descanso_desde, descanso_dias, emitida_at, anulado_at, motivo_anulacion")
      .eq("paciente_id", id).order("emitida_at", { ascending: false }).limit(50).returns<Constancia[]>(),
    sesion.esDentista
      ? supabase.from("plantilla_receta").select("id, nombre, items, indicaciones").eq("activa", true).order("nombre")
          .returns<PlantillaReceta[]>()
      : Promise.resolve({ data: [] as PlantillaReceta[], error: null }),
    supabase.from("nota_evolucion").select("id, fecha, texto").eq("paciente_id", id).is("anulado_at", null)
      .order("fecha", { ascending: false }).limit(20).returns<{ id: string; fecha: string; texto: string }[]>(),
    supabase.from("usuario").select("id, nombre").returns<{ id: string; nombre: string }[]>(),
  ]);
  // Tratamiento realizado sugerido por fecha (constancias): lo trabajado en evoluciones firmadas.
  const { data: firmadas, error: errorFirmadas } = await supabase.from("nota_evolucion")
    .select("fecha, evolucion_item(item_id, trabajado)").eq("paciente_id", id).is("anulado_at", null).not("firmada_at", "is", null)
    .order("fecha", { ascending: false }).limit(40)
    .returns<{ fecha: string; evolucion_item: { item_id: string; trabajado: boolean }[] }[]>();
  if (errorFirmadas) registrarError("documentos.tratamientos", errorFirmadas, { paciente: id });
  const idsTrabajados = [...new Set((firmadas ?? []).flatMap((n) => n.evolucion_item.filter((x) => x.trabajado).map((x) => x.item_id)))];
  const { data: trabajos } = idsTrabajados.length > 0
    ? await supabase.from("item_plan").select("id, procedimiento, pieza").in("id", idsTrabajados)
        .returns<{ id: string; procedimiento: string; pieza: number | null }[]>()
    : { data: [] as { id: string; procedimiento: string; pieza: number | null }[] };
  const porItem = new Map((trabajos ?? []).map((t) => [t.id, t]));
  const tratamientos: Record<string, string> = {};
  for (const fecha of [...new Set((firmadas ?? []).map((n) => fechaLima(n.fecha)))]) {
    const delDia = (firmadas ?? []).filter((n) => fechaLima(n.fecha) === fecha)
      .flatMap((n) => n.evolucion_item.filter((x) => x.trabajado).flatMap((x) => {
        const trabajo = porItem.get(x.item_id);
        return trabajo ? [trabajo] : [];
      }));
    const texto = tratamientoDelDia(delDia);
    if (texto) tratamientos[fecha] = texto.slice(0, 500);
  }
  const error = recetas.error ?? constancias.error ?? plantillas.error ?? notas.error;
  if (error) registrarError("documentos.listar", error, { paciente: id });
  const autor = new Map((equipo.data ?? []).map((u) => [u.id, u.nombre]));
  const sesiones = (notas.data ?? []).map((n) => ({
    id: n.id, texto: `${formatearFecha(fechaLima(n.fecha))} · ${n.texto.slice(0, 60) || "Evolución en borrador"}`,
  }));
  const puedeEmitir = sesion.esDentista && !paciente.anulado_at;
  const hoy = fechaLima(new Date());

  return (
    <>
      <Encabezado sesion={sesion} seccion="pacientes" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <AlertasPaciente pacienteId={id} />
        <Link href="/pacientes" className="text-sm font-medium text-teal-700 hover:underline">← Pacientes</Link>
        <h1 className="mt-3 text-2xl font-semibold">{paciente.nombres} {paciente.apellidos}</h1>
        <PestanasPaciente id={id} actual="documentos" veClinico={sesion.veClinico} />
        {error && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo cargar todo. Recarga la página.</p>}

        {puedeEmitir && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section aria-labelledby="t-receta" className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 id="t-receta" className="mb-3 text-lg font-semibold">Nueva receta</h2>
              <FormularioReceta pacienteId={id} plantillas={plantillas.data ?? []} sesiones={sesiones} />
              {(plantillas.data ?? []).length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-3 text-sm">
                  <p className="font-medium text-gray-700">Mis plantillas</p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {(plantillas.data ?? []).map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2">
                        <span>{p.nombre}</span><QuitarPlantilla pacienteId={id} id={p.id} nombre={p.nombre} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
            <section aria-labelledby="t-constancia" className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 id="t-constancia" className="mb-3 text-lg font-semibold">Constancia o certificado</h2>
              <FormularioConstancia pacienteId={id} hoy={hoy} tratamientos={tratamientos} />
            </section>
          </div>
        )}

        <section aria-labelledby="t-recetas" className="mt-8">
          <h2 id="t-recetas" className="text-lg font-semibold">Recetas emitidas</h2>
          {(recetas.data ?? []).length === 0 ? <p className="mt-2 text-sm text-gray-500">Aún no hay recetas.</p> : (
            <ul className="mt-3 flex flex-col gap-3">
              {(recetas.data ?? []).map((r) => (
                <li key={r.id} data-receta={r.id} className={`rounded-xl border border-gray-200 bg-white p-4 ${r.anulado_at ? "opacity-60" : ""}`}>
                  <p className="font-medium">Receta del {fechaHora(r.emitida_at)} · {autor.get(r.profesional_id) ?? "—"}</p>
                  <ol className={`mt-1 list-decimal pl-5 text-sm ${r.anulado_at ? "line-through" : ""}`}>
                    {[...r.receta_item].sort((a, b) => a.orden - b.orden).map((i) => (
                      <li key={i.orden}>{i.medicamento} {i.presentacion} — {i.dosis}, {i.frecuencia}, {i.duracion}</li>
                    ))}
                  </ol>
                  {r.anulado_at && <p className="mt-1 text-sm">Anulada: {r.motivo_anulacion}</p>}
                  {!r.anulado_at && (
                    <div className="mt-2 flex flex-wrap items-start gap-4 text-sm">
                      <Link href={`/pacientes/${id}/documentos/receta/${r.id}`} target="_blank" className="font-medium text-teal-700 hover:underline">
                        Imprimir receta
                      </Link>
                      {sesion.esDentista && <AnularDocumento pacienteId={id} id={r.id} tabla="receta" descripcion="la receta" />}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="t-constancias" className="mt-8">
          <h2 id="t-constancias" className="text-lg font-semibold">Constancias y certificados</h2>
          {(constancias.data ?? []).length === 0 ? <p className="mt-2 text-sm text-gray-500">Aún no hay documentos.</p> : (
            <ul className="mt-3 flex flex-col gap-3">
              {(constancias.data ?? []).map((c) => (
                <li key={c.id} data-constancia={c.id} className={`rounded-xl border border-gray-200 bg-white p-4 ${c.anulado_at ? "opacity-60" : ""}`}>
                  <p className={`font-medium ${c.anulado_at ? "line-through" : ""}`}>
                    {TIPOS_CONSTANCIA[c.tipo]} · atención del {formatearFecha(c.fecha_atencion)}
                    {c.tipo === "descanso" && c.descanso_desde && c.descanso_dias
                      && ` · ${c.descanso_dias} ${c.descanso_dias === 1 ? "día" : "días"} (hasta el ${formatearFecha(finDescanso(c.descanso_desde, c.descanso_dias))})`}
                  </p>
                  <p className="text-sm text-gray-600">Emitido el {fechaHora(c.emitida_at)} por {autor.get(c.profesional_id) ?? "—"}</p>
                  {c.anulado_at && <p className="mt-1 text-sm">Anulado: {c.motivo_anulacion}</p>}
                  {!c.anulado_at && (
                    <div className="mt-2 flex flex-wrap items-start gap-4 text-sm">
                      <Link href={`/pacientes/${id}/documentos/constancia/${c.id}`} target="_blank" className="font-medium text-teal-700 hover:underline">
                        Imprimir
                      </Link>
                      {sesion.esDentista && <AnularDocumento pacienteId={id} id={c.id} tabla="constancia" descripcion={TIPOS_CONSTANCIA[c.tipo]} />}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
