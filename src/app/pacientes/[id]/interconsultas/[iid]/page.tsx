import { MembreteClinica, PieClinica } from "@/components/membrete";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentoImprimible, LineaFirma } from "@/components/documento-imprimible";
import { edadTexto } from "@/lib/clinico/documentos";
import { fechaLima, formatearFecha } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { cargarAlertas } from "@/lib/historia/alertas";
import { TIPOS_DOCUMENTO } from "@/lib/pacientes/validacion";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { abrirHistoria } from "../../datos-clinicos";

export const metadata: Metadata = { title: "Interconsulta – Dental Demo" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Interconsulta = {
  id: string; tipo: string; destino: string | null; motivo: string; datos_clinicos: string | null; creada_at: string;
  estado: string; solicitante: { nombre: string; cop: string | null } | null;
};

/** Hoja de interconsulta externa: motivo, datos clínicos relevantes y espacio para la respuesta. */
export default async function ImprimirInterconsulta({ params }: { params: Promise<{ id: string; iid: string }> }) {
  const { id, iid } = await params;
  if (!modulos.etapa7 || !UUID.test(iid)) notFound();
  const { sesion, paciente } = await abrirHistoria(id);
  const supabase = await createClient();
  const [{ data: i, error }, alertas] = await Promise.all([
    supabase.from("interconsulta")
      .select("id, tipo, destino, motivo, datos_clinicos, creada_at, estado, "
        + "solicitante:usuario!interconsulta_clinica_id_solicitante_id_fkey(nombre, cop)")
      .eq("id", iid).eq("paciente_id", id).maybeSingle<Interconsulta>(),
    cargarAlertas([id]),
  ]);
  if (error) registrarError("interconsulta.imprimir", error, { interconsulta: iid });
  if (!i || i.tipo !== "externa" || i.estado === "cancelada") notFound();
  const fecha = fechaLima(i.creada_at);
  const frases = alertas.porPaciente.get(id)?.frases ?? [];
  return (
    <DocumentoImprimible volver={`/pacientes/${id}/interconsultas`}>
      <header className="flex items-start justify-between gap-4 border-b border-black pb-2">
        <div>
          <MembreteClinica clinicaId={sesion.clinicaId} />
        </div>
        <p className="text-right text-[9pt]">Historia clínica N° {paciente.numero_documento ?? "—"}<br />Fecha: {formatearFecha(fecha)}</p>
      </header>
      <h1 className="mt-3 text-center text-[13pt] font-bold uppercase">Interconsulta</h1>
      <section className="mt-3 grid grid-cols-2 gap-x-6 text-[10pt]">
        <p><b>Paciente:</b> {paciente.nombres} {paciente.apellidos}</p>
        <p><b>Documento:</b> {paciente.numero_documento
          ? `${TIPOS_DOCUMENTO[paciente.tipo_documento as keyof typeof TIPOS_DOCUMENTO] ?? ""} ${paciente.numero_documento}` : "—"}</p>
        <p><b>Edad:</b> {edadTexto(paciente.fecha_nacimiento, fecha)}</p>
        <p><b>Se deriva a:</b> {i.destino}</p>
      </section>
      <section className="mt-4">
        <h2 className="text-[10pt] font-bold uppercase">Motivo</h2>
        <p className="whitespace-pre-line">{i.motivo}</p>
      </section>
      {(i.datos_clinicos || frases.length > 0) && (
        <section className="mt-3">
          <h2 className="text-[10pt] font-bold uppercase">Datos clínicos relevantes</h2>
          {frases.length > 0 && <p>Registrado en la historia: {frases.join(" · ")}.</p>}
          {i.datos_clinicos && <p className="whitespace-pre-line">{i.datos_clinicos}</p>}
        </section>
      )}
      <div className="mt-6 grid grid-cols-2 gap-8">
        <div />
        <LineaFirma rotulo={`Solicita: ${i.solicitante?.nombre ?? ""} · COP ${i.solicitante?.cop ?? ""}`} />
      </div>
      <section className="mt-8 break-inside-avoid border-t border-black pt-2">
        <h2 className="text-[10pt] font-bold uppercase">Respuesta del especialista</h2>
        <div className="mt-2 flex flex-col gap-6">
          {[0, 1, 2, 3, 4, 5].map((n) => <span key={n} className="block border-b border-gray-500" />)}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-8">
          <div />
          <LineaFirma rotulo="Firma, sello y colegiatura" />
        </div>
      </section>
      <p className="mt-6 text-[8pt] text-gray-700">Código: {i.id}</p>
      <PieClinica clinicaId={sesion.clinicaId} />
    </DocumentoImprimible>
  );
}
