import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentoImprimible, LineaFirma } from "@/components/documento-imprimible";
import { edadTexto } from "@/lib/clinico/documentos";
import { fechaLima, formatearFecha } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { TIPOS_DOCUMENTO } from "@/lib/pacientes/validacion";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { abrirHistoria } from "../../../datos-clinicos";

export const metadata: Metadata = { title: "Receta – Dental Demo" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Receta = {
  id: string; indicaciones: string | null; emitida_at: string; anulado_at: string | null;
  profesional_nombre: string; profesional_cop: string | null;
  receta_item: { orden: number; medicamento: string; presentacion: string; dosis: string; frecuencia: string; duracion: string;
    indicaciones: string | null }[];
};

/** Receta para imprimir: datos del profesional y su colegiatura (COP). */
export default async function ImprimirReceta({ params }: { params: Promise<{ id: string; rid: string }> }) {
  const { id, rid } = await params;
  if (!modulos.etapa7 || !UUID.test(rid)) notFound();
  const { sesion, paciente } = await abrirHistoria(id);
  const supabase = await createClient();
  const [{ data: r, error }, { data: clinica }] = await Promise.all([
    supabase.from("receta")
      .select("id, indicaciones, emitida_at, anulado_at, profesional_nombre, profesional_cop, "
        + "receta_item(orden, medicamento, presentacion, dosis, frecuencia, duracion, indicaciones)")
      .eq("id", rid).eq("paciente_id", id).maybeSingle<Receta>(),
    supabase.from("clinica").select("nombre, ruc").eq("id", sesion.clinicaId).maybeSingle<{ nombre: string; ruc: string | null }>(),
  ]);
  if (error) registrarError("receta.imprimir", error, { receta: rid });
  if (!r || r.anulado_at) notFound();
  const fecha = fechaLima(r.emitida_at);
  return (
    <DocumentoImprimible volver={`/pacientes/${id}/documentos`}>
      <header className="flex items-start justify-between gap-4 border-b border-black pb-2">
        <div>
          <p className="text-[12pt] font-bold">{clinica?.nombre ?? "Clínica"}</p>
          {clinica?.ruc && <p className="text-[9pt]">RUC {clinica.ruc}</p>}
        </div>
        <div className="text-right text-[10pt]">
          <p className="font-bold">{r.profesional_nombre}</p>
          <p>Cirujano dentista · COP {r.profesional_cop ?? "—"}</p>
        </div>
      </header>
      <h1 className="mt-3 text-center text-[13pt] font-bold uppercase">Receta</h1>
      <section className="mt-2 grid grid-cols-2 gap-x-6 text-[10pt]">
        <p><b>Paciente:</b> {paciente.nombres} {paciente.apellidos}</p>
        <p><b>Fecha:</b> {formatearFecha(fecha)}</p>
        <p><b>Documento:</b> {paciente.numero_documento
          ? `${TIPOS_DOCUMENTO[paciente.tipo_documento as keyof typeof TIPOS_DOCUMENTO] ?? ""} ${paciente.numero_documento}` : "—"}</p>
        <p><b>Edad:</b> {edadTexto(paciente.fecha_nacimiento, fecha)}</p>
      </section>
      <p className="mt-4 text-[14pt] font-bold">Rp.</p>
      <ol className="mt-1 flex list-decimal flex-col gap-3 pl-6">
        {[...r.receta_item].sort((a, b) => a.orden - b.orden).map((i) => (
          <li key={i.orden}>
            <p className="font-bold">{i.medicamento} — {i.presentacion}</p>
            <p>{i.dosis}, {i.frecuencia}, durante {i.duracion}.</p>
            {i.indicaciones && <p className="italic">{i.indicaciones}</p>}
          </li>
        ))}
      </ol>
      {r.indicaciones && (
        <section className="mt-4">
          <h2 className="text-[10pt] font-bold uppercase">Indicaciones</h2>
          <p className="whitespace-pre-line">{r.indicaciones}</p>
        </section>
      )}
      <div className="mt-10 grid grid-cols-2 gap-8">
        <div />
        <LineaFirma rotulo={`Firma y sello · ${r.profesional_nombre} · COP ${r.profesional_cop ?? ""}`} />
      </div>
      <p className="mt-6 text-[8pt] text-gray-700">Código de la receta: {r.id}</p>
    </DocumentoImprimible>
  );
}
