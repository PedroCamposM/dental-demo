import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertasPaciente } from "@/components/alertas-paciente";
import { Encabezado } from "@/components/encabezado";
import { Odontograma, type HallazgoDibujo } from "@/components/odontograma";
import { codigosElegibles, type CodigoCie10 } from "@/lib/clinico/diagnostico";
import { LISTA_CAMPOS_EVOLUCION, type CampoEvolucion } from "@/lib/clinico/evolucion";
import { ESPECIALIDADES, type Especialidad } from "@/lib/catalogo/validacion";
import { formatearSoles } from "@/lib/dinero";
import { fechaLima, formatearFecha, horaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { ENFERMEDADES, type Enfermedad } from "@/lib/historia/cuestionario";
import { DENTICIONES, type Denticion, type ItemCatalogo } from "@/lib/odontograma/hallazgo";
import { ESTADOS_CIVILES, GRADOS_INSTRUCCION } from "@/lib/pacientes/validacion";
import { ESTADOS_ITEM, totales, ubicacionItem, type EstadoItem } from "@/lib/plan/plan";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { abrirHistoria, COLUMNAS_VERSION, puedeGestar, type Version } from "../datos-clinicos";
import { FormularioDiagnostico } from "../examen/formularios";
import { EditorEvolucion, type ItemPendiente } from "../evolucion/formularios";
import { itemsSinConsentimiento } from "../evolucion/sin-consentimiento";
import { EditorOdontograma } from "../odontograma/formularios";
import { DecisionPlan, NuevoItem, type OpcionesItem } from "../plan/formularios";
import { AbrirLabor, CrearOdontograma, CrearPlan, FormAnamnesis } from "./formulario";

export const metadata: Metadata = { title: "Atención rápida – Dental Demo" };

// Etapa 21: la atención rápida es la ficha de la clínica piloto en una sola página
// (docs/clinica-piloto): datos, anamnesis, odontograma con especificaciones, diagnósticos,
// plan de tratamiento y ficha de control (fecha | labor realizada). Cada sección se guarda por
// separado y queda igual que en el flujo completo (las pestañas muestran lo mismo).

type Paciente = {
  id: string; nombres: string; apellidos: string; fecha_nacimiento: string | null; sexo: string | null;
  tipo_documento: string | null; numero_documento: string | null; direccion: string | null; telefono: string | null;
  estado_civil: string | null; ocupacion: string | null; grado_instruccion: string | null; procedencia: string | null;
  contacto_emergencia_nombre: string | null; contacto_emergencia_telefono: string | null; contacto_emergencia_parentesco: string | null;
};
type OdontogramaFila = { id: string; tipo: string; fecha: string; denticion: Denticion; odontologo_id: string; especificaciones: string | null };
type Hallazgo = HallazgoDibujo & { hallazgo_codigo: string };
type Diagnostico = { id: string; cie10: string; tipo: string; pieza: number | null; registrado_at: string };
type Plan = { id: string; titulo: string; estado: string; presentado_at: string };
type Item = {
  id: string; plan_id: string; procedimiento: string; pieza: number | null; superficies: string[] | null; zona: string | null;
  precio_centimos: number; estado: EstadoItem; nota_evolucion_id: string | null; orden: number; procedimiento_id: string | null;
};
type Nota = Record<Exclude<CampoEvolucion, "texto">, string | null> & {
  id: string; texto: string; fecha: string; odontologo_id: string; firmada_at: string | null; anulado_at: string | null;
  motivo_anulacion: string | null; evolucion_item: { item_id: string; trabajado: boolean; terminado: boolean }[];
};

const SECCION = "mt-6 rounded-xl border border-gray-200 bg-white p-5";
const TITULO = "text-lg font-semibold";

function edad(nacimiento: string | null): number | null {
  if (!nacimiento) return null;
  const [a, m, d] = nacimiento.split("-").map(Number) as [number, number, number];
  const [ah, mh, dh] = fechaLima(new Date()).split("-").map(Number) as [number, number, number];
  return ah - a - (mh < m || (mh === m && dh < d) ? 1 : 0);
}

export default async function AtencionRapida({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!modulos.etapa14) notFound();
  const { sesion, paciente: clinico } = await abrirHistoria(id);
  if (!sesion.esDentista || clinico.anulado_at) redirect(`/pacientes/${id}`);
  const supabase = await createClient();

  const [pacienteR, versionR, odontogramasR, diagnosticosR, cie10R, planesR, notasR, equipoR, catalogoHallazgosR] = await Promise.all([
    supabase.from("paciente").select("id, nombres, apellidos, fecha_nacimiento, sexo, tipo_documento, numero_documento, direccion, "
      + "telefono, estado_civil, ocupacion, grado_instruccion, procedencia, contacto_emergencia_nombre, contacto_emergencia_telefono, "
      + "contacto_emergencia_parentesco").eq("id", id).maybeSingle<Paciente>(),
    supabase.from("cuestionario_salud").select(COLUMNAS_VERSION).eq("paciente_id", id)
      .order("version", { ascending: false }).limit(1).maybeSingle<Version>(),
    modulos.etapa4
      ? supabase.from("odontograma").select("id, tipo, fecha, denticion, odontologo_id, especificaciones").eq("paciente_id", id)
          .is("anulado_at", null).order("fecha", { ascending: false }).limit(1).returns<OdontogramaFila[]>()
      : Promise.resolve({ data: [] as OdontogramaFila[], error: null }),
    modulos.etapa4
      ? supabase.from("diagnostico").select("id, cie10, tipo, pieza, registrado_at").eq("paciente_id", id).is("anulado_at", null)
          .order("registrado_at", { ascending: false }).returns<Diagnostico[]>()
      : Promise.resolve({ data: [] as Diagnostico[], error: null }),
    modulos.etapa4
      ? supabase.from("catalogo_cie10").select("codigo, descripcion, es_categoria").order("codigo").returns<CodigoCie10[]>()
      : Promise.resolve({ data: [] as CodigoCie10[], error: null }),
    modulos.etapa5
      ? supabase.from("plan_tratamiento").select("id, titulo, estado, presentado_at").eq("paciente_id", id)
          .in("estado", ["propuesto", "aceptado", "en_curso", "detenido"]).order("presentado_at", { ascending: false }).returns<Plan[]>()
      : Promise.resolve({ data: [] as Plan[], error: null }),
    modulos.etapa6
      ? supabase.from("nota_evolucion")
          .select("id, texto, fecha, odontologo_id, firmada_at, anulado_at, motivo_anulacion, "
            + LISTA_CAMPOS_EVOLUCION.filter((c) => c !== "texto").join(", ") + ", evolucion_item(item_id, trabajado, terminado)")
          .eq("paciente_id", id).order("fecha", { ascending: false }).limit(100).returns<Nota[]>()
      : Promise.resolve({ data: [] as Nota[], error: null }),
    supabase.from("usuario").select("id, nombre, cop").returns<{ id: string; nombre: string; cop: string | null }[]>(),
    modulos.etapa4
      ? supabase.from("catalogo_hallazgo").select("*").order("numeral").returns<ItemCatalogo[]>()
      : Promise.resolve({ data: [] as ItemCatalogo[], error: null }),
  ]);
  const errorCarga = pacienteR.error ?? versionR.error ?? odontogramasR.error ?? diagnosticosR.error ?? planesR.error ?? notasR.error;
  if (errorCarga) registrarError("ficha_rapida.cargar", errorCarga, { paciente: id });
  const p = pacienteR.data;
  if (!p) notFound();
  const version = versionR.data;
  const autor = new Map((equipoR.data ?? []).map((u) => [u.id, u.cop ? `${u.nombre} (COP ${u.cop})` : u.nombre]));
  const e = edad(p.fecha_nacimiento);

  // Odontograma vigente y sus hallazgos
  const odontograma = (odontogramasR.data ?? [])[0] ?? null;
  const hallazgosR = odontograma
    ? await supabase.from("v_hallazgo").select("id, hallazgo_codigo, pieza, pieza_hasta, arcada, superficies, siglas, grado, color")
        .eq("odontograma_id", odontograma.id).is("anulado_at", null).order("created_at").returns<Hallazgo[]>()
    : { data: [] as Hallazgo[], error: null };
  const hallazgos = (hallazgosR.data ?? []).map((h) => ({ ...h, codigo: h.hallazgo_codigo }));
  const catalogoHallazgos = [...(catalogoHallazgosR.data ?? [])].sort((a, b) => Number(a.numeral.split(".")[2]) - Number(b.numeral.split(".")[2]));
  const esAutorOdontograma = !!odontograma && odontograma.odontologo_id === sesion.usuarioId;
  const tituloOdontograma = odontograma ? `Odontograma del ${formatearFecha(fechaLima(odontograma.fecha))}` : "";

  // Diagnósticos
  const descripcion = new Map((cie10R.data ?? []).map((c) => [c.codigo, c.descripcion]));
  const opcionesCie10 = codigosElegibles(cie10R.data ?? []);
  const diagnosticos = diagnosticosR.data ?? [];

  // Plan vigente (el más reciente sin cerrar) e ítems de todos los planes vigentes (para la labor de hoy)
  const planes = planesR.data ?? [];
  const plan = planes[0] ?? null;
  const itemsR = planes.length > 0
    ? await supabase.from("item_plan").select("id, plan_id, procedimiento, pieza, superficies, zona, precio_centimos, estado, nota_evolucion_id, orden, procedimiento_id")
        .in("plan_id", planes.map((x) => x.id)).order("orden").returns<Item[]>()
    : { data: [] as Item[], error: null };
  const items = itemsR.data ?? [];
  const itemsPlan = plan ? items.filter((i) => i.plan_id === plan.id) : [];
  const t = totales(itemsPlan.map((i) => ({ estado: i.estado, precio_centimos: i.precio_centimos, cobrado_centimos: 0 })));
  const [fasesR, catalogoR] = plan && plan.estado === "propuesto" ? await Promise.all([
    supabase.from("plan_fase").select("numero, nombre").eq("plan_id", plan.id).order("numero").returns<{ numero: number; nombre: string }[]>(),
    supabase.from("procedimiento").select("id, codigo, nombre, especialidad, precio_base_centimos, duracion_minutos, cobro_por")
      .eq("activo", true).order("especialidad").order("nombre").returns<(OpcionesItem["catalogo"][number] & { especialidad: Especialidad })[]>(),
  ]) : [{ data: [] }, { data: [] }];
  const opcionesItem: OpcionesItem = {
    catalogo: (catalogoR.data ?? []).map((c) => ({ ...c, especialidad: ESPECIALIDADES[c.especialidad as Especialidad] ?? c.especialidad })),
    fases: (fasesR.data ?? []).length > 0 ? fasesR.data ?? [] : [{ numero: 1, nombre: "Tratamiento" }],
    diagnosticos: diagnosticos.map((d) => ({
      id: d.id, pieza: d.pieza, texto: `${d.cie10} ${descripcion.get(d.cie10) ?? ""}${d.pieza ? ` · pieza ${d.pieza}` : ""} (${d.tipo})`,
    })),
    items: itemsPlan.filter((i) => i.estado !== "cancelado").map((i, n) => ({ id: i.id, texto: `${n + 1}. ${i.procedimiento} ${ubicacionItem(i)}` })),
  };

  // Ficha de control: lo firmado (fecha | labor realizada) y el borrador de hoy
  const notas = notasR.data ?? [];
  const control = notas.filter((n) => n.firmada_at || n.anulado_at);
  const borradores = notas.filter((n) => !n.firmada_at && !n.anulado_at && n.odontologo_id === sesion.usuarioId);
  const porId = new Map(items.map((i) => [i.id, i]));
  // Lo mismo que avisa la pestaña Evolución: sin consentimiento firmado, la firma fallaría.
  // (todas las versiones del plan: el consentimiento puede venir de una anterior)
  const todosPlanes = borradores.length > 0 && modulos.etapa7
    ? (await supabase.from("plan_tratamiento").select("id").eq("paciente_id", id).returns<{ id: string }[]>()).data ?? [] : [];
  const sinConsentimiento = await itemsSinConsentimiento(supabase, id, items, todosPlanes.map((x) => x.id));
  const pendientes: ItemPendiente[] = items.filter((i) => i.estado === "aceptado" || i.estado === "programado")
    .map((i) => ({
      id: i.id, descripcion: `${i.procedimiento}${i.pieza !== null || i.zona ? ` · ${ubicacionItem(i)}` : ""}`, plan: "Plan",
      sinConsentimiento: sinConsentimiento.has(i.id),
    }));

  const filiacion: [string, string | null][] = [
    ["Edad", e === null ? null : `${e} años`], ["Sexo", p.sexo ? p.sexo.charAt(0).toUpperCase() + p.sexo.slice(1) : null],
    ["Documento", p.numero_documento], ["Fecha de nacimiento", p.fecha_nacimiento ? formatearFecha(p.fecha_nacimiento) : null],
    ["Dirección", p.direccion], ["Celular", p.telefono ? p.telefono.replace(/^51/, "") : null],
  ];
  const masDatos: [string, string | null][] = [
    ["Estado civil", p.estado_civil ? ESTADOS_CIVILES[p.estado_civil as keyof typeof ESTADOS_CIVILES] ?? p.estado_civil : null], ["Ocupación", p.ocupacion],
    ["Grado de instrucción", p.grado_instruccion ? GRADOS_INSTRUCCION[p.grado_instruccion as keyof typeof GRADOS_INSTRUCCION] ?? p.grado_instruccion : null],
    ["Procedencia", p.procedencia],
    ["Contacto de emergencia", p.contacto_emergencia_nombre
      ? `${p.contacto_emergencia_nombre}${p.contacto_emergencia_parentesco ? ` (${p.contacto_emergencia_parentesco})` : ""}`
        + `${p.contacto_emergencia_telefono ? ` · ${p.contacto_emergencia_telefono.replace(/^51/, "")}` : ""}`
      : null],
  ];
  const faltan = masDatos.filter(([, v]) => !v).length;

  return (
    <>
      <Encabezado sesion={sesion} seccion="pacientes" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <AlertasPaciente pacienteId={id} />
        <Link href={`/pacientes/${id}`} className="text-sm font-medium text-teal-700 hover:underline">← Ficha del paciente</Link>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold">Atención rápida · {p.nombres} {p.apellidos}</h1>
          <p className="text-sm text-gray-600">{formatearFecha(fechaLima(new Date()))} · {horaLima(new Date().toISOString())}</p>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          La historia clínica en una página, como la ficha de papel. Cada sección se guarda por separado y queda en la historia
          completa (sus pestañas muestran lo mismo).
        </p>
        <nav aria-label="Secciones de la ficha" className="mt-3 flex flex-wrap gap-2 text-sm">
          {[["#datos", "Datos"], ["#anamnesis", "Anamnesis"], ["#odontograma", "Odontograma"], ["#diagnosticos", "Diagnósticos"],
            ["#plan", "Plan"], ["#control", "Ficha de control"]].map(([href, texto]) => (
            <a key={href} href={href} className="inline-flex min-h-10 items-center rounded-md border border-gray-300 px-3 hover:bg-gray-50">{texto}</a>
          ))}
        </nav>
        {errorCarga && (
          <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo cargar toda la ficha. Recarga la página.</p>
        )}

        {/* 1. Datos del paciente */}
        <section id="datos" aria-labelledby="t-datos" className={`${SECCION} scroll-mt-4`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="t-datos" className={TITULO}>Datos del paciente</h2>
            <Link href={`/pacientes/${id}?editar=1`} className="text-sm font-medium text-teal-700 hover:underline">Editar datos</Link>
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {filiacion.map(([k, v]) => (
              <div key={k}><dt className="text-gray-500">{k}</dt><dd className="font-medium">{v ?? "—"}</dd></div>
            ))}
          </dl>
          <details className="mt-3 text-sm">
            <summary className="inline-flex min-h-10 cursor-pointer items-center text-teal-700">
              Más datos (historia completa){faltan > 0 ? ` · faltan ${faltan}` : ""}
            </summary>
            <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {masDatos.map(([k, v]) => (
                <div key={k}><dt className="text-gray-500">{k}</dt><dd className="font-medium">{v ?? "—"}</dd></div>
              ))}
            </dl>
          </details>
        </section>

        {/* 2. Anamnesis */}
        <section id="anamnesis" aria-labelledby="t-anamnesis" className={`${SECCION} scroll-mt-4`}>
          <h2 id="t-anamnesis" className={TITULO}>Anamnesis</h2>
          <p className="mb-3 text-sm text-gray-600">
            {version ? `Última versión: ${formatearFecha(fechaLima(version.registrado_at))}. Al guardar se crea una versión nueva; la anterior se conserva.`
              : "Aún no tiene historia registrada."}
          </p>
          <FormAnamnesis pacienteId={id} preguntarEmbarazo={puedeGestar(clinico)} inicial={{
            motivo_consulta: version?.motivo_consulta ?? "", enfermedad_actual: version?.enfermedad_actual ?? "",
            alergias: (version?.alergias ?? []).join(", "), alergias_ninguna: !!version && version.alergias.length === 0,
            enfermedades: version?.enfermedades ?? [], enfermedades_otras: version?.enfermedades_otras ?? "",
            antecedentes_familiares: version?.antecedentes_familiares ?? "", medicacion: version?.medicacion ?? "",
            anticoagulado: version?.anticoagulado ?? false, anticoagulante: version?.anticoagulante ?? "",
            embarazo: version?.embarazo ?? "", semanas_gestacion: version?.semanas_gestacion?.toString() ?? "",
          }} />
          {version && version.enfermedades.length > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              Registrado: {version.enfermedades.map((x) => ENFERMEDADES[x as Enfermedad] ?? x).join(", ")}.
            </p>
          )}
        </section>

        {/* 3. Odontograma y especificaciones */}
        {modulos.etapa4 && (
          <section id="odontograma" aria-labelledby="t-odontograma-ficha" className="scroll-mt-4">
            {!odontograma ? (
              <div className={SECCION}>
                <h2 id="t-odontograma-ficha" className={TITULO}>Odontograma</h2>
                <p className="mb-3 text-sm text-gray-600">Aún no tiene odontograma. Elige la dentición y empieza a marcar las piezas.</p>
                <CrearOdontograma pacienteId={id}
                  denticionSugerida={e === null ? "permanente" : e < 6 ? "temporal" : e < 12 ? "mixta" : "permanente"} />
              </div>
            ) : esAutorOdontograma ? (
              <EditorOdontograma key={odontograma.id} pacienteId={id} odontogramaId={odontograma.id} catalogo={catalogoHallazgos}
                piezaInicial={null} hallazgos={hallazgos} titulo={tituloOdontograma} idTitulo="t-odontograma-ficha"
                antes={<h2 id="t-odontograma-ficha" className={TITULO}>
                  Odontograma · {formatearFecha(fechaLima(odontograma.fecha))} · dentición {DENTICIONES[odontograma.denticion].toLowerCase()}
                </h2>}
                despues={<p className="mt-3 text-sm"><span className="font-medium">Especificaciones:</span> {odontograma.especificaciones ?? "—"}</p>} />
            ) : (
              <div className={SECCION}>
                <h2 id="t-odontograma-ficha" className={TITULO}>Odontograma · {formatearFecha(fechaLima(odontograma.fecha))}</h2>
                <div className="mt-4 overflow-x-auto"><div className="min-w-[42rem]"><Odontograma hallazgos={hallazgos} titulo={tituloOdontograma} /></div></div>
                <p className="mt-3 text-sm"><span className="font-medium">Especificaciones:</span> {odontograma.especificaciones ?? "—"}</p>
                <p className="mt-2 text-sm text-gray-600">
                  Lo registró {autor.get(odontograma.odontologo_id) ?? "otro profesional"}: solo su autor lo edita.{" "}
                  <Link href={`/pacientes/${id}/odontograma?nuevo=1`} className="font-medium text-teal-700 hover:underline">Crear uno de evolución</Link>
                </p>
              </div>
            )}
          </section>
        )}

        {/* 4. Diagnósticos */}
        {modulos.etapa4 && (
          <section id="diagnosticos" aria-labelledby="t-diagnosticos-ficha" className={`${SECCION} scroll-mt-4`}>
            <h2 id="t-diagnosticos-ficha" className={TITULO}>Diagnósticos (CIE-10)</h2>
            {diagnosticos.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                {diagnosticos.map((d) => (
                  <li key={d.id} className="rounded-full bg-gray-100 px-3 py-1">
                    <span className="font-mono">{d.cie10}</span> {descripcion.get(d.cie10) ?? ""}{d.pieza ? ` · pieza ${d.pieza}` : ""}
                    <span className="text-gray-500"> ({d.tipo})</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-1 text-sm text-gray-600">Aún no tiene diagnósticos.</p>}
            <div className="mt-4 border-t border-gray-100 pt-4">
              <FormularioDiagnostico pacienteId={id} opciones={opcionesCie10} inicial={{}} />
            </div>
          </section>
        )}

        {/* 5. Plan de tratamiento */}
        {modulos.etapa5 && (
          <section id="plan" aria-labelledby="t-plan-ficha" className={`${SECCION} scroll-mt-4`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="t-plan-ficha" className={TITULO}>Plan de tratamiento</h2>
              {plan && <Link href={`/pacientes/${id}/plan?p=${plan.id}`} className="text-sm font-medium text-teal-700 hover:underline">Ver plan completo</Link>}
            </div>
            {!plan ? (
              <div className="mt-2">
                <p className="mb-3 text-sm text-gray-600">Aún no tiene un plan vigente.</p>
                <CrearPlan pacienteId={id} />
              </div>
            ) : (
              <>
                <p className="mt-1 text-sm text-gray-600">
                  {plan.titulo} · {plan.estado === "propuesto" ? "propuesto (falta la aceptación del paciente)" : plan.estado.replace("_", " ")}
                  {" "}· total {formatearSoles(t.total)}
                </p>
                {itemsPlan.length === 0 ? <p className="mt-2 text-sm text-gray-600">Aún sin procedimientos.</p> : (
                  <ol className="mt-2 divide-y divide-gray-100 text-sm">
                    {itemsPlan.map((i, n) => (
                      <li key={i.id} className={`flex flex-wrap justify-between gap-2 py-2 ${i.estado === "cancelado" ? "text-gray-500 line-through" : ""}`}>
                        <span>{n + 1}. <span className="font-medium">{i.procedimiento}</span>{i.pieza !== null || i.zona ? ` · ${ubicacionItem(i)}` : ""}</span>
                        <span className="tabular-nums">{formatearSoles(i.precio_centimos)} · {ESTADOS_ITEM[i.estado]}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {plan.estado === "propuesto" && (
                  <div className="mt-4 flex flex-col gap-4 border-t border-gray-100 pt-4">
                    <NuevoItem pacienteId={id} planId={plan.id} opciones={opcionesItem} />
                    {itemsPlan.some((i) => i.estado === "propuesto") && (
                      <DecisionPlan pacienteId={id} planId={plan.id}
                        items={itemsPlan.filter((i) => i.estado === "propuesto").map((i, n) => ({ id: i.id, texto: `${n + 1}. ${i.procedimiento} ${ubicacionItem(i)}` }))} />
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* 6. Ficha de control: fecha | labor realizada */}
        {modulos.etapa6 && (
          <section id="control" aria-labelledby="t-control" className={`${SECCION} scroll-mt-4`}>
            <h2 id="t-control" className={TITULO}>Ficha de control</h2>
            <p className="text-sm text-gray-600">Cada fila es la labor realizada en una cita, firmada por quien la hizo.</p>
            {control.length > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr><th scope="col" className="px-3 py-2 font-medium">Fecha</th><th scope="col" className="px-3 py-2 font-medium">Labor realizada</th>
                      <th scope="col" className="px-3 py-2 font-medium">Profesional</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {control.map((n) => {
                      const trabajados = n.evolucion_item.filter((x) => x.trabajado).flatMap((x) => (porId.get(x.item_id) ? [porId.get(x.item_id) as Item] : []));
                      return (
                        <tr key={n.id} className={n.anulado_at ? "text-gray-500" : ""}>
                          <td className="whitespace-nowrap px-3 py-2 align-top">{formatearFecha(fechaLima(n.fecha))}</td>
                          <td className="px-3 py-2 align-top">
                            {trabajados.length > 0 && (
                              <span className="block font-medium">
                                {trabajados.map((i) => `${i.procedimiento}${i.pieza !== null || i.zona ? ` (${ubicacionItem(i)})` : ""}`).join("; ")}
                              </span>
                            )}
                            <span className={`whitespace-pre-line ${n.anulado_at ? "line-through" : ""}`}>{n.texto}</span>
                            {n.anulado_at && <span className="block text-xs">Anulada: {n.motivo_anulacion}</span>}
                          </td>
                          <td className="px-3 py-2 align-top text-gray-600">{autor.get(n.odontologo_id) ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="mt-2 text-sm text-gray-600">Aún no hay labores registradas.</p>}
            <div className="mt-4 border-t border-gray-100 pt-4">
              {borradores.length > 0 ? borradores.map((n) => (
                <article key={n.id} aria-label="Labor de hoy" className="rounded-lg border-2 border-amber-300 p-4">
                  <p className="mb-3 font-medium">Labor de hoy · abierta a las {horaLima(n.fecha)}</p>
                  <EditorEvolucion pacienteId={id} notaId={n.id} items={pendientes}
                    guardado={Object.fromEntries(LISTA_CAMPOS_EVOLUCION.map((c) => [c, (c === "texto" ? n.texto : n[c]) ?? ""])) as Record<CampoEvolucion, string>}
                    marcados={{
                      trabajados: n.evolucion_item.filter((x) => x.trabajado).map((x) => x.item_id),
                      terminados: n.evolucion_item.filter((x) => x.terminado).map((x) => x.item_id),
                    }} />
                </article>
              )) : <AbrirLabor pacienteId={id} />}
            </div>
          </section>
        )}

        <nav aria-label="Más de la historia" className="mt-6 flex flex-wrap gap-2 text-sm">
          <span className="text-gray-600">Más de la historia:</span>
          {[["examen", "Examen clínico"], ["periodontograma", "Periodontograma"], ["consentimientos", "Consentimientos"],
            ["documentos", "Recetas y constancias"], ["archivos", "Imágenes"]].map(([ruta, texto]) => (
            <Link key={ruta} href={`/pacientes/${id}/${ruta}`} className="font-medium text-teal-700 hover:underline">{texto}</Link>
          ))}
        </nav>
      </main>
    </>
  );
}
