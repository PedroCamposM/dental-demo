import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentoImprimible, LineaFirma, RecuadroHuella } from "@/components/documento-imprimible";
import { FINES_IMAGEN, type FinImagen } from "@/lib/clinico/consentimientos";
import { edadTexto } from "@/lib/clinico/documentos";
import { fechaLima, formatearFecha, horaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { TIPOS_DOCUMENTO } from "@/lib/pacientes/validacion";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { abrirHistoria } from "../../../datos-clinicos";

export const metadata: Metadata = { title: "Consentimiento informado – Dental Demo" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Consentimiento = {
  id: string; tipo: "procedimiento" | "uso_imagen"; titulo: string; descripcion: string; riesgos: string;
  efectos_adversos: string | null; pronostico: string | null; es_ejemplo: boolean; fines: FinImagen[] | null;
  representante_nombre: string | null; representante_documento: string | null; representante_parentesco: string | null;
  creado_at: string; anulado_at: string | null;
  profesional: { nombre: string; cop: string | null } | null;
};

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-3 break-inside-avoid">
      <h2 className="text-[10pt] font-bold uppercase">{titulo}</h2>
      <div className="mt-0.5 whitespace-pre-line text-justify">{children}</div>
    </section>
  );
}

/**
 * Formato de consentimiento informado para imprimir y firmar a mano (NTS 139, formato 16):
 * IPRESS, N° de historia, fecha y hora, paciente, procedimiento, descripción, riesgos,
 * efectos adversos de los fármacos, pronóstico y recomendaciones, profesional responsable
 * (firma, sello y colegiatura) y conformidad, negativa o revocación con firma y huella.
 */
export default async function ImprimirConsentimiento({ params }: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await params;
  if (!modulos.etapa7 || !UUID.test(cid)) notFound();
  const { sesion, paciente } = await abrirHistoria(id);
  const supabase = await createClient();
  const [{ data: c, error }, { data: clinica }] = await Promise.all([
    supabase.from("consentimiento")
      .select("id, tipo, titulo, descripcion, riesgos, efectos_adversos, pronostico, es_ejemplo, fines, representante_nombre, "
        + "representante_documento, representante_parentesco, creado_at, anulado_at, "
        + "profesional:usuario!consentimiento_clinica_id_profesional_id_fkey(nombre, cop)")
      .eq("id", cid).eq("paciente_id", id).maybeSingle<Consentimiento>(),
    supabase.from("clinica").select("nombre, ruc").eq("id", sesion.clinicaId).maybeSingle<{ nombre: string; ruc: string | null }>(),
  ]);
  if (error) registrarError("consentimiento.imprimir", error, { consentimiento: cid });
  if (!c || c.anulado_at) notFound();
  const hoy = fechaLima(new Date());
  const documento = paciente.numero_documento
    ? `${TIPOS_DOCUMENTO[paciente.tipo_documento as keyof typeof TIPOS_DOCUMENTO] ?? ""} ${paciente.numero_documento}` : "—";
  const firmante = c.representante_nombre ? "representante legal" : "paciente";

  return (
    <DocumentoImprimible volver={`/pacientes/${id}/consentimientos`}>
      {c.es_ejemplo && (
        <p className="mb-3 border-2 border-black p-2 text-center text-[9pt] font-bold">
          PLANTILLA DE EJEMPLO: LA CLÍNICA DEBE REVISAR ESTE TEXTO ANTES DE USARLO CON PACIENTES.
        </p>
      )}
      <header className="flex items-start justify-between gap-4 border-b border-black pb-2">
        <div>
          <p className="text-[12pt] font-bold">{clinica?.nombre ?? "Clínica"}</p>
          {clinica?.ruc && <p className="text-[9pt]">RUC {clinica.ruc}</p>}
        </div>
        <div className="text-right text-[9pt]">
          <p>Historia clínica N° {paciente.numero_documento ?? "—"}</p>
          <p>Fecha: {formatearFecha(fechaLima(c.creado_at))} · Hora: {horaLima(c.creado_at)}</p>
        </div>
      </header>
      <h1 className="mt-3 text-center text-[13pt] font-bold uppercase">
        {c.tipo === "uso_imagen" ? "Consentimiento para el uso de imágenes clínicas" : "Consentimiento informado"}
      </h1>

      <section className="mt-3 grid grid-cols-2 gap-x-6 text-[10pt]">
        <p><b>Paciente:</b> {paciente.nombres} {paciente.apellidos}</p>
        <p><b>Documento:</b> {documento}</p>
        <p><b>Edad:</b> {edadTexto(paciente.fecha_nacimiento, hoy)}</p>
        {c.representante_nombre && (
          <p><b>Representante:</b> {c.representante_nombre}{c.representante_parentesco ? ` (${c.representante_parentesco})` : ""}
            {c.representante_documento ? ` · DNI ${c.representante_documento}` : ""}</p>
        )}
      </section>

      <Seccion titulo={c.tipo === "uso_imagen" ? "Autorización" : "Procedimiento"}>{c.titulo}</Seccion>
      <Seccion titulo={c.tipo === "uso_imagen" ? "En qué consiste" : "Descripción del procedimiento"}>{c.descripcion}</Seccion>
      <Seccion titulo={c.tipo === "uso_imagen" ? "Riesgos" : "Riesgos reales y potenciales"}>{c.riesgos}</Seccion>
      {c.efectos_adversos && <Seccion titulo="Efectos adversos de los medicamentos que se prevé usar">{c.efectos_adversos}</Seccion>}
      {c.pronostico && <Seccion titulo="Pronóstico y recomendaciones">{c.pronostico}</Seccion>}
      {c.fines && (
        <Seccion titulo="Fines autorizados">
          {Object.entries(FINES_IMAGEN).map(([v, t]) => `(${c.fines?.includes(v as FinImagen) ? "X" : " "}) ${t}`).join("     ")}
        </Seccion>
      )}

      <Seccion titulo="Profesional responsable">
        {c.profesional?.nombre ?? "—"}{c.profesional?.cop ? ` · COP ${c.profesional.cop}` : ""}
      </Seccion>
      <div className="grid grid-cols-2 gap-8">
        <LineaFirma rotulo="Firma y sello del cirujano dentista" />
        <div />
      </div>

      <section className="mt-5 break-inside-avoid border-t border-black pt-2">
        <h2 className="text-[10pt] font-bold uppercase">Conformidad</h2>
        <p className="mt-1 text-justify">
          Declaro que el profesional me explicó en términos sencillos el procedimiento, sus riesgos, efectos adversos,
          pronóstico y recomendaciones; que pude hacer preguntas y que fueron respondidas; y que sé que puedo negarme o retirar
          este consentimiento en cualquier momento. En forma libre y voluntaria, como {firmante}, doy mi conformidad.
        </p>
        <div className="mt-2 grid grid-cols-[1fr_1fr_auto] items-end gap-6">
          <LineaFirma rotulo={`Firma del ${firmante}`} />
          <LineaFirma rotulo="Nombres, apellidos y DNI" />
          <RecuadroHuella />
        </div>
      </section>

      <section className="mt-4 break-inside-avoid border-t border-black pt-2">
        <h2 className="text-[10pt] font-bold uppercase">Negativa</h2>
        <p className="mt-1 text-justify">
          Habiendo sido informado(a) de las consecuencias, NO acepto el procedimiento descrito. Fecha: ____ / ____ / ________
        </p>
        <div className="mt-2 grid grid-cols-[1fr_1fr_auto] items-end gap-6">
          <LineaFirma rotulo={`Firma del ${firmante}`} />
          <LineaFirma rotulo="Firma y sello del cirujano dentista" />
          <RecuadroHuella />
        </div>
      </section>

      <section className="mt-4 break-inside-avoid border-t border-black pt-2">
        <h2 className="text-[10pt] font-bold uppercase">Revocación</h2>
        <p className="mt-1 text-justify">
          Retiro el consentimiento que otorgué en este documento. Fecha: ____ / ____ / ________
        </p>
        <div className="mt-2 grid grid-cols-[1fr_1fr_auto] items-end gap-6">
          <LineaFirma rotulo={`Firma del ${firmante}`} />
          <LineaFirma rotulo="Firma y sello del cirujano dentista" />
          <RecuadroHuella />
        </div>
      </section>
      <p className="mt-4 text-[8pt] text-gray-700">Código del formato: {c.id}</p>
    </DocumentoImprimible>
  );
}
