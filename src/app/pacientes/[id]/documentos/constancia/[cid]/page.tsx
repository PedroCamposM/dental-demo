import { MembreteClinica, PieClinica } from "@/components/membrete";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentoImprimible, LineaFirma } from "@/components/documento-imprimible";
import { finDescanso, TIPOS_CONSTANCIA, type TipoConstancia } from "@/lib/clinico/documentos";
import { fechaLima, formatearFecha, formatearFechaLarga } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { TIPOS_DOCUMENTO } from "@/lib/pacientes/validacion";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { abrirHistoria } from "../../../datos-clinicos";

export const metadata: Metadata = { title: "Constancia – Dental Demo" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Constancia = {
  id: string; tipo: TipoConstancia; fecha_atencion: string; hora_inicio: string | null; hora_fin: string | null;
  descanso_desde: string | null; descanso_dias: number | null; cie10: string | null; tratamiento: string | null;
  observaciones: string | null;
  emitida_at: string; anulado_at: string | null; profesional_nombre: string; profesional_cop: string | null;
  catalogo_cie10: { descripcion: string } | null;
};

/** Constancia de atención o certificado de descanso, con los datos del profesional y su COP. */
export default async function ImprimirConstancia({ params }: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await params;
  if (!modulos.etapa7 || !UUID.test(cid)) notFound();
  const { sesion, paciente } = await abrirHistoria(id);
  const supabase = await createClient();
  const [{ data: c, error }] = await Promise.all([
    supabase.from("constancia")
      .select("id, tipo, fecha_atencion, hora_inicio, hora_fin, descanso_desde, descanso_dias, cie10, tratamiento, observaciones, emitida_at, "
        + "anulado_at, profesional_nombre, profesional_cop, catalogo_cie10(descripcion)")
      .eq("id", cid).eq("paciente_id", id).maybeSingle<Constancia>(),
  ]);
  if (error) registrarError("constancia.imprimir", error, { constancia: cid });
  if (!c || c.anulado_at) notFound();
  const documento = paciente.numero_documento
    ? `${TIPOS_DOCUMENTO[paciente.tipo_documento as keyof typeof TIPOS_DOCUMENTO] ?? "documento"} N° ${paciente.numero_documento}`
    : "documento no registrado";
  const horas = c.hora_inicio
    ? c.hora_fin ? `, de ${c.hora_inicio.slice(0, 5)} a ${c.hora_fin.slice(0, 5)} horas` : `, a las ${c.hora_inicio.slice(0, 5)} horas`
    : "";
  return (
    <DocumentoImprimible volver={`/pacientes/${id}/documentos`}>
      <header className="border-b border-black pb-2">
        <MembreteClinica clinicaId={sesion.clinicaId} />
      </header>
      <h1 className="mt-6 text-center text-[14pt] font-bold uppercase">{TIPOS_CONSTANCIA[c.tipo]}</h1>
      <div className="mt-6 flex flex-col gap-4 text-justify text-[12pt] leading-relaxed">
        <p>
          El cirujano dentista que suscribe, {c.profesional_nombre}, con COP {c.profesional_cop ?? "—"}, hace constar que{" "}
          <b>{paciente.nombres} {paciente.apellidos}</b>, identificado(a) con {documento}, fue atendido(a) en este consultorio
          el día {formatearFechaLarga(c.fecha_atencion)}{horas}.
        </p>
        {c.tipo === "descanso" && c.descanso_desde && c.descanso_dias && (
          <p>
            Por indicación profesional, requiere descanso por <b>{c.descanso_dias} {c.descanso_dias === 1 ? "día" : "días"}</b>,
            del {formatearFecha(c.descanso_desde)} al {formatearFecha(finDescanso(c.descanso_desde, c.descanso_dias))}, inclusive.
          </p>
        )}
        {c.cie10 && <p>Diagnóstico: {c.cie10}{c.catalogo_cie10 ? ` — ${c.catalogo_cie10.descripcion}` : ""}.</p>}
        {c.tratamiento && <p>Tratamiento realizado: {c.tratamiento.replace(/\.$/, "")}.</p>}
        {c.observaciones && <p className="whitespace-pre-line">{c.observaciones}</p>}
        <p>Se expide a solicitud del interesado para los fines que estime conveniente.</p>
        <p className="text-right">{formatearFechaLarga(fechaLima(c.emitida_at))}</p>
      </div>
      <div className="mt-16 grid grid-cols-2 gap-8">
        <div />
        <LineaFirma rotulo={`Firma y sello · ${c.profesional_nombre} · COP ${c.profesional_cop ?? ""}`} />
      </div>
      <p className="mt-6 text-[8pt] text-gray-700">Código del documento: {c.id}</p>
      <PieClinica clinicaId={sesion.clinicaId} />
    </DocumentoImprimible>
  );
}
