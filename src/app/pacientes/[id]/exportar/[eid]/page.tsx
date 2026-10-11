import { MembreteClinica, PieClinica } from "@/components/membrete";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DocumentoImprimible } from "@/components/documento-imprimible";
import { Odontograma, type HallazgoDibujo } from "@/components/odontograma";
import { ESTADOS_CONSENTIMIENTO, type EstadoConsentimiento } from "@/lib/clinico/consentimientos";
import { SUPERFICIES, TIPOS_DIAGNOSTICO, type Superficie } from "@/lib/clinico/diagnostico";
import { edadTexto } from "@/lib/clinico/documentos";
import { CAMPOS_EVOLUCION, LISTA_CAMPOS_EVOLUCION, type CampoEvolucion } from "@/lib/clinico/evolucion";
import { formatearSoles } from "@/lib/dinero";
import { fechaLima, formatearFecha, horaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { EMBARAZO, ENFERMEDADES, FORMA_INICIO, HABITOS } from "@/lib/historia/cuestionario";
import { DENTICIONES, ubicacion, type Denticion } from "@/lib/odontograma/hallazgo";
import {
  ESTADOS_CIVILES, GRADOS_INSTRUCCION, SEGUROS, SEXOS, TIPOS_DOCUMENTO,
} from "@/lib/pacientes/validacion";
import { ESTADOS_ITEM, ESTADOS_PLAN, type EstadoItem, type EstadoPlan } from "@/lib/plan/plan";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { abrirHistoria, COLUMNAS_VERSION, type Version } from "../../datos-clinicos";

export const metadata: Metadata = { title: "Historia clínica – Dental Demo" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** El documento se abre desde una exportación propia de las últimas 2 horas. */
const VIGENCIA_MS = 2 * 60 * 60 * 1000;

type Paciente = Record<string, string | null> & { id: string };
type Odonto = {
  id: string; tipo: "inicial" | "evolucion" | "alta"; fecha: string; denticion: Denticion; odontologo_id: string;
  especificaciones: string | null; observaciones: string | null; anulado_at: string | null; motivo_anulacion: string | null;
};
type Hallazgo = HallazgoDibujo & {
  odontograma_id: string; hallazgo_codigo: string; nombre: string; especificacion: string | null; anulado_at: string | null;
};
type Diagnostico = {
  id: string; cie10: string; tipo: "presuntivo" | "definitivo"; pieza: number | null; superficies: Superficie[] | null;
  observacion: string | null; registrado_at: string; registrado_por: string | null; anulado_at: string | null;
  motivo_anulacion: string | null; diagnostico_adenda: { id: string; texto: string; registrado_at: string; registrado_por: string | null }[];
};
type Plan = {
  id: string; titulo: string; version: number; alternativa: string; estado: EstadoPlan; presentado_at: string;
  aceptado_at: string | null; odontologo_id: string | null;
  item_plan: { id: string; procedimiento: string; pieza: number | null; estado: EstadoItem; precio_centimos: number; fase: number | null; orden: number }[];
};
type Nota = Record<Exclude<CampoEvolucion, "texto">, string | null> & {
  id: string; texto: string; fecha: string; odontologo_id: string; firmada_at: string | null; anulado_at: string | null;
  motivo_anulacion: string | null; evolucion_adenda: { id: string; texto: string; registrado_at: string; registrado_por: string | null }[];
};
type Consentimiento = {
  id: string; tipo: string; titulo: string; estado: EstadoConsentimiento; creado_at: string; decidido_el: string | null;
  representante_nombre: string | null; profesional_id: string; anulado_at: string | null; motivo_anulacion: string | null;
  motivo_revocacion: string | null;
};
type Receta = {
  id: string; profesional_id: string; indicaciones: string | null; emitida_at: string; anulado_at: string | null;
  motivo_anulacion: string | null;
  receta_item: { orden: number; medicamento: string; presentacion: string | null; dosis: string; frecuencia: string; duracion: string }[];
};

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid-page">
      <h2 className="border-b border-black pb-0.5 text-[11pt] font-bold uppercase">{titulo}</h2>
      <div className="mt-1.5 text-[10pt]">{children}</div>
    </section>
  );
}
const Vacio = ({ texto }: { texto: string }) => <p className="italic text-gray-600">{texto}</p>;
const Anulado = ({ motivo }: { motivo: string | null }) => <span className="font-bold"> [ANULADO: {motivo ?? "—"}]</span>;

/**
 * Historia clínica completa para imprimir o guardar como PDF: filiación, historia y sus
 * versiones, odontogramas, diagnósticos, planes, evoluciones firmadas con adendas,
 * consentimientos y recetas. Lo anulado se muestra marcado (no se borra, regla 1).
 */
export default async function DocumentoHistoria({ params }: { params: Promise<{ id: string; eid: string }> }) {
  if (!modulos.etapa11) notFound();
  const { id, eid } = await params;
  if (!UUID.test(eid)) notFound();
  const { sesion, paciente: pc } = await abrirHistoria(id);
  if (!sesion.esDentista) redirect(`/pacientes/${id}`);
  const supabase = await createClient();

  const { data: exportacion } = await supabase.from("exportacion_historia").select("id, usuario_id, motivo, creada_at")
    .eq("id", eid).eq("paciente_id", id).maybeSingle<{ id: string; usuario_id: string; motivo: string; creada_at: string }>();
  if (!exportacion || exportacion.usuario_id !== sesion.usuarioId || Date.now() - Date.parse(exportacion.creada_at) > VIGENCIA_MS) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p role="alert" className="text-gray-700">Esta exportación ya no está disponible. Solicita una nueva indicando el motivo.</p>
        <Link href={`/pacientes/${id}/exportar`} className="mt-4 inline-block font-medium text-teal-700 hover:underline">Exportar historia clínica</Link>
      </main>
    );
  }

  const [pacienteR, versiones, odontos, diagnosticos, planes, notas, consentimientos, recetas, equipo] = await Promise.all([
    supabase.from("paciente").select("*").eq("id", id).maybeSingle<Paciente>(),
    supabase.from("cuestionario_salud").select(COLUMNAS_VERSION).eq("paciente_id", id).order("version").returns<Version[]>(),
    supabase.from("odontograma").select("id, tipo, fecha, denticion, odontologo_id, especificaciones, observaciones, anulado_at, motivo_anulacion")
      .eq("paciente_id", id).order("fecha").returns<Odonto[]>(),
    supabase.from("diagnostico")
      .select("id, cie10, tipo, pieza, superficies, observacion, registrado_at, registrado_por, anulado_at, motivo_anulacion, "
        + "diagnostico_adenda(id, texto, registrado_at, registrado_por)")
      .eq("paciente_id", id).order("registrado_at").returns<Diagnostico[]>(),
    supabase.from("plan_tratamiento")
      .select("id, titulo, version, alternativa, estado, presentado_at, aceptado_at, odontologo_id, "
        + "item_plan(id, procedimiento, pieza, estado, precio_centimos, fase, orden)")
      .eq("paciente_id", id).order("presentado_at").returns<Plan[]>(),
    supabase.from("nota_evolucion")
      .select("id, texto, fecha, odontologo_id, firmada_at, anulado_at, motivo_anulacion, "
        + LISTA_CAMPOS_EVOLUCION.filter((c) => c !== "texto").join(", ")
        + ", evolucion_adenda(id, texto, registrado_at, registrado_por)")
      .eq("paciente_id", id).not("firmada_at", "is", null).order("fecha").returns<Nota[]>(),
    supabase.from("consentimiento")
      .select("id, tipo, titulo, estado, creado_at, decidido_el, representante_nombre, profesional_id, anulado_at, motivo_anulacion, motivo_revocacion")
      .eq("paciente_id", id).order("creado_at").returns<Consentimiento[]>(),
    supabase.from("receta")
      .select("id, profesional_id, indicaciones, emitida_at, anulado_at, motivo_anulacion, "
        + "receta_item(orden, medicamento, presentacion, dosis, frecuencia, duracion)")
      .eq("paciente_id", id).order("emitida_at").returns<Receta[]>(),
    supabase.from("usuario").select("id, nombre, cop").returns<{ id: string; nombre: string; cop: string | null }[]>(),
  ]);
  const idsOdonto = (odontos.data ?? []).map((o) => o.id);
  const codigos = [...new Set((diagnosticos.data ?? []).map((d) => d.cie10))];
  const [hallazgos, cie10] = await Promise.all([
    idsOdonto.length > 0
      ? supabase.from("v_hallazgo")
          .select("id, odontograma_id, hallazgo_codigo, nombre, pieza, pieza_hasta, arcada, superficies, siglas, grado, color, especificacion, anulado_at")
          .in("odontograma_id", idsOdonto).order("created_at").returns<Omit<Hallazgo, "codigo">[]>()
      : Promise.resolve({ data: [] as Omit<Hallazgo, "codigo">[], error: null }),
    codigos.length > 0
      ? supabase.from("catalogo_cie10").select("codigo, descripcion").in("codigo", codigos).returns<{ codigo: string; descripcion: string }[]>()
      : Promise.resolve({ data: [] as { codigo: string; descripcion: string }[], error: null }),
  ]);
  const error = pacienteR.error ?? versiones.error ?? odontos.error ?? diagnosticos.error ?? planes.error ?? notas.error
    ?? consentimientos.error ?? recetas.error ?? hallazgos.error ?? cie10.error;
  if (error) {
    registrarError("historia.documento", error, { paciente: id });
    throw new Error("No se pudo armar la historia clínica completa");
  }
  const p = pacienteR.data;
  if (!p) notFound();

  const autor = new Map((equipo.data ?? []).map((u) => [u.id, u.cop ? `${u.nombre} (COP ${u.cop})` : u.nombre]));
  const quien = (uid: string | null) => (uid ? autor.get(uid) ?? "—" : "—");
  const cuando = (iso: string) => `${formatearFecha(fechaLima(iso))} ${horaLima(iso)}`;
  const descCie = new Map((cie10.data ?? []).map((c) => [c.codigo, c.descripcion]));
  const hallazgosDe = new Map<string, Hallazgo[]>();
  for (const h of hallazgos.data ?? []) {
    hallazgosDe.set(h.odontograma_id, [...(hallazgosDe.get(h.odontograma_id) ?? []), { ...h, codigo: h.hallazgo_codigo } as Hallazgo]);
  }
  const hoy = fechaLima(new Date());
  const doc = p.numero_documento ? `${TIPOS_DOCUMENTO[p.tipo_documento as keyof typeof TIPOS_DOCUMENTO] ?? ""} ${p.numero_documento}` : "—";
  const fila = (etiqueta: string, valor: string | null | undefined) => (
    <p><b>{etiqueta}:</b> {valor || "—"}</p>
  );

  return (
    <DocumentoImprimible volver={`/pacientes/${id}/exportar`}>
      <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-2">
        <div>
          <MembreteClinica clinicaId={sesion.clinicaId} />
        </div>
        <div className="text-right text-[9pt]">
          <p>Historia clínica N° {p.numero_documento ?? "—"}</p>
          <p>Exportada el {cuando(exportacion.creada_at)} por {quien(exportacion.usuario_id)}</p>
          <p>Motivo: {exportacion.motivo}</p>
        </div>
      </header>
      <h1 className="mt-3 text-center text-[14pt] font-bold uppercase">Historia clínica odontológica</h1>
      {pc.anulado_at && <p className="mt-1 text-center font-bold">REGISTRO DE PACIENTE ANULADO O FUSIONADO</p>}

      <Seccion titulo="Filiación">
        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
          {fila("Paciente", `${p.nombres} ${p.apellidos}`)}
          {fila("Documento", doc)}
          {fila("Fecha de nacimiento", p.fecha_nacimiento ? `${formatearFecha(p.fecha_nacimiento)} (${edadTexto(p.fecha_nacimiento, hoy)})` : null)}
          {fila("Sexo", p.sexo ? SEXOS[p.sexo as keyof typeof SEXOS] : null)}
          {fila("Celular", p.telefono?.slice(2))}
          {fila("Ocupación", p.ocupacion)}
          {fila("Dirección", p.direccion)}
          {fila("Lugar de nacimiento", p.lugar_nacimiento)}
          {fila("Procedencia", p.procedencia)}
          {fila("Grupo sanguíneo", p.grupo_sanguineo)}
          {fila("Estado civil", p.estado_civil ? ESTADOS_CIVILES[p.estado_civil as keyof typeof ESTADOS_CIVILES] : null)}
          {fila("Grado de instrucción", p.grado_instruccion ? GRADOS_INSTRUCCION[p.grado_instruccion as keyof typeof GRADOS_INSTRUCCION] : null)}
          {fila("Seguro", p.seguro ? `${SEGUROS[p.seguro as keyof typeof SEGUROS]}${p.seguro_numero ? ` N° ${p.seguro_numero}` : ""}` : null)}
          {fila("Religión", p.religion)}
          {fila("Contacto de emergencia", p.contacto_emergencia_nombre
            ? `${p.contacto_emergencia_nombre}${p.contacto_emergencia_telefono ? ` · ${p.contacto_emergencia_telefono.slice(2)}` : ""}` : null)}
          {p.apoderado_nombre && fila("Apoderado", `${p.apoderado_nombre}${p.apoderado_parentesco ? ` (${p.apoderado_parentesco})` : ""}`
            + `${p.apoderado_dni ? ` · DNI ${p.apoderado_dni}` : ""}${p.apoderado_telefono ? ` · ${p.apoderado_telefono.slice(2)}` : ""}`)}
        </div>
      </Seccion>

      <Seccion titulo="Historia clínica (cuestionario de salud y sus versiones)">
        {(versiones.data ?? []).length === 0 ? <Vacio texto="Sin historia registrada." /> : (versiones.data ?? []).map((v) => (
          <div key={v.id} className="mt-2 break-inside-avoid">
            <p className="font-bold">Versión {v.version} · {cuando(v.registrado_at)} · {quien(v.registrado_por)}</p>
            {fila("Motivo de consulta", v.motivo_consulta)}
            {(v.tiempo_enfermedad || v.forma_inicio) && fila("Tiempo y forma de inicio",
              [v.tiempo_enfermedad, v.forma_inicio ? FORMA_INICIO[v.forma_inicio] : null].filter(Boolean).join(" · "))}
            {v.enfermedad_actual && fila("Enfermedad actual", v.enfermedad_actual)}
            {fila("Enfermedades", [...v.enfermedades.map((e) => ENFERMEDADES[e]), v.enfermedades_otras].filter(Boolean).join(", ") || "Ninguna")}
            {v.cirugias && fila("Cirugías", v.cirugias)}
            {v.hospitalizaciones && fila("Hospitalizaciones", v.hospitalizaciones)}
            {fila("Medicación actual", v.medicacion)}
            {fila("Alergias", v.alergias.length > 0 ? v.alergias.join(", ") : "Ninguna registrada")}
            {fila("Anticoagulado", v.anticoagulado ? `Sí${v.anticoagulante ? ` (${v.anticoagulante})` : ""}` : "No")}
            {v.embarazo !== "no_aplica" && fila("Embarazo", `${EMBARAZO[v.embarazo]}${v.semanas_gestacion ? ` (${v.semanas_gestacion} semanas)` : ""}${v.lactancia ? " · lactancia" : ""}`)}
            {fila("Hábitos", [...v.habitos.map((h) => HABITOS[h]), v.habitos_otros].filter(Boolean).join(", ") || "Ninguno")}
            {v.antecedentes_familiares && fila("Antecedentes familiares", v.antecedentes_familiares)}
            {v.antecedentes_odontologicos && fila("Antecedentes odontológicos", v.antecedentes_odontologicos)}
            {v.observaciones && fila("Observaciones", v.observaciones)}
          </div>
        ))}
      </Seccion>

      <Seccion titulo="Odontogramas">
        {(odontos.data ?? []).length === 0 ? <Vacio texto="Sin odontogramas." /> : (odontos.data ?? []).map((o) => {
          const hs = hallazgosDe.get(o.id) ?? [];
          const vigentes = hs.filter((h) => !h.anulado_at);
          return (
            <div key={o.id} className="mt-2 break-inside-avoid">
              <p className="font-bold">
                {o.tipo === "inicial" ? "Inicial" : o.tipo === "alta" ? "Alta" : "Evolución"} · {cuando(o.fecha)} · dentición {DENTICIONES[o.denticion].toLowerCase()} · {quien(o.odontologo_id)}
                {o.anulado_at && <Anulado motivo={o.motivo_anulacion} />}
              </p>
              <div className="mx-auto mt-1 max-w-[170mm]">
                <Odontograma hallazgos={vigentes} titulo={`Odontograma del ${formatearFecha(fechaLima(o.fecha))}`} />
              </div>
              {hs.length > 0 && (
                <ul className="mt-1 list-disc pl-5">
                  {hs.map((h) => (
                    <li key={h.id}>{ubicacion(h)}: {h.nombre}{h.especificacion ? ` (${h.especificacion})` : ""}{h.anulado_at && " [anulado]"}</li>
                  ))}
                </ul>
              )}
              {o.especificaciones && fila("Especificaciones", o.especificaciones)}
              {o.observaciones && fila("Observaciones", o.observaciones)}
            </div>
          );
        })}
      </Seccion>

      <Seccion titulo="Diagnósticos (CIE-10)">
        {(diagnosticos.data ?? []).length === 0 ? <Vacio texto="Sin diagnósticos." /> : (
          <ul className="list-disc pl-5">
            {(diagnosticos.data ?? []).map((d) => (
              <li key={d.id} className="break-inside-avoid">
                <b>{d.cie10}</b> {descCie.get(d.cie10) ?? ""} · {TIPOS_DIAGNOSTICO[d.tipo]}
                {d.pieza !== null && ` · pieza ${d.pieza}`}
                {d.superficies?.length ? ` (${d.superficies.map((s) => SUPERFICIES[s].toLowerCase()).join(", ")})` : ""}
                {` · ${cuando(d.registrado_at)} · ${quien(d.registrado_por)}`}
                {d.observacion && <> · {d.observacion}</>}
                {d.anulado_at && <Anulado motivo={d.motivo_anulacion} />}
                {d.diagnostico_adenda.map((a) => (
                  <p key={a.id} className="pl-3">Adenda {cuando(a.registrado_at)} · {quien(a.registrado_por)}: {a.texto}</p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion titulo="Planes de tratamiento">
        {(planes.data ?? []).length === 0 ? <Vacio texto="Sin planes." /> : (planes.data ?? []).map((pl) => (
          <div key={pl.id} className="mt-2 break-inside-avoid">
            <p className="font-bold">
              {pl.titulo} · versión {pl.version}{pl.alternativa !== "A" ? `, alternativa ${pl.alternativa}` : ""} · {ESTADOS_PLAN[pl.estado]}
              {` · presentado ${formatearFecha(fechaLima(pl.presentado_at))}`}{pl.aceptado_at ? ` · aceptado ${formatearFecha(fechaLima(pl.aceptado_at))}` : ""}
            </p>
            <ul className="list-disc pl-5">
              {[...pl.item_plan].sort((a, b) => (a.fase ?? 0) - (b.fase ?? 0) || a.orden - b.orden).map((i) => (
                <li key={i.id}>{i.procedimiento}{i.pieza !== null ? ` · pieza ${i.pieza}` : ""} · {ESTADOS_ITEM[i.estado]} · {formatearSoles(i.precio_centimos)}</li>
              ))}
            </ul>
          </div>
        ))}
      </Seccion>

      <Seccion titulo="Evoluciones firmadas">
        {(notas.data ?? []).length === 0 ? <Vacio texto="Sin evoluciones firmadas." /> : (notas.data ?? []).map((n) => (
          <div key={n.id} className="mt-2 break-inside-avoid border-l-2 border-gray-400 pl-2">
            <p className="font-bold">{cuando(n.fecha)} · firmada por {quien(n.odontologo_id)}{n.firmada_at && ` el ${cuando(n.firmada_at)}`}
              {n.anulado_at && <Anulado motivo={n.motivo_anulacion} />}</p>
            <p className="whitespace-pre-line">{n.texto}</p>
            {LISTA_CAMPOS_EVOLUCION.filter((c) => c !== "texto" && n[c as Exclude<CampoEvolucion, "texto">]).map((c) => (
              <p key={c}><b>{CAMPOS_EVOLUCION[c].etiqueta}:</b> {n[c as Exclude<CampoEvolucion, "texto">]}</p>
            ))}
            {[...n.evolucion_adenda].sort((a, b) => a.registrado_at.localeCompare(b.registrado_at)).map((a) => (
              <p key={a.id} className="pl-3">Adenda {cuando(a.registrado_at)} · {quien(a.registrado_por)}: {a.texto}</p>
            ))}
          </div>
        ))}
      </Seccion>

      <Seccion titulo="Consentimientos">
        {(consentimientos.data ?? []).length === 0 ? <Vacio texto="Sin consentimientos." /> : (
          <ul className="list-disc pl-5">
            {(consentimientos.data ?? []).map((c) => (
              <li key={c.id}>
                {c.titulo} · {ESTADOS_CONSENTIMIENTO[c.estado]}{c.decidido_el ? ` el ${formatearFecha(c.decidido_el)}` : ""}
                {` · generado ${formatearFecha(fechaLima(c.creado_at))} · ${quien(c.profesional_id)}`}
                {c.representante_nombre && ` · representante ${c.representante_nombre}`}
                {c.motivo_revocacion && ` · revocado: ${c.motivo_revocacion}`}
                {c.anulado_at && <Anulado motivo={c.motivo_anulacion} />}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-[9pt] italic">Los formatos firmados a mano se conservan escaneados en Imágenes y archivos.</p>
      </Seccion>

      <Seccion titulo="Recetas">
        {(recetas.data ?? []).length === 0 ? <Vacio texto="Sin recetas." /> : (recetas.data ?? []).map((r) => (
          <div key={r.id} className="mt-2 break-inside-avoid">
            <p className="font-bold">{cuando(r.emitida_at)} · {quien(r.profesional_id)}{r.anulado_at && <Anulado motivo={r.motivo_anulacion} />}</p>
            <ol className="list-decimal pl-5">
              {[...r.receta_item].sort((a, b) => a.orden - b.orden).map((i) => (
                <li key={i.orden}>{i.medicamento}{i.presentacion ? ` (${i.presentacion})` : ""} · {i.dosis} · {i.frecuencia} · {i.duracion}</li>
              ))}
            </ol>
            {r.indicaciones && <p><b>Indicaciones:</b> {r.indicaciones}</p>}
          </div>
        ))}
      </Seccion>

      <p className="mt-6 border-t border-black pt-1 text-center text-[8pt]">
        Documento generado desde la historia clínica electrónica. Exportación registrada en la auditoría ({exportacion.id}).
      </p>
      <PieClinica clinicaId={sesion.clinicaId} />
    </DocumentoImprimible>
  );
}
