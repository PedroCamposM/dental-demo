import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { itemsConConsentimiento, type ItemConOrigen } from "@/lib/clinico/consentimientos";
import { formatearSoles } from "@/lib/dinero";
import { diasEntre, fechaLima, formatearFecha } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { diasAtraso } from "@/lib/clinico/laboratorio";
import { NOMBRE_CONTROL, TIPOS_CONTROL, type TipoControl } from "@/lib/tablero/calculos";

export const metadata: Metadata = { title: "Tablero clínico – Dental Demo" };

type Paciente = { id: string; nombres: string; apellidos: string } | null;
type Fila = { clave: string; paciente: Paciente; texto: string; detalle?: string; href: string; urgente?: boolean };

const nombre = (p: Paciente) => (p ? `${p.apellidos}, ${p.nombres}` : "Paciente");
const haceDias = (d: number) => `hace ${d} ${d === 1 ? "día" : "días"}`;

/**
 * Tablero clínico (CLAUDE.md): tratamientos en curso, evoluciones sin firmar,
 * consentimientos pendientes, controles vencidos y tratamientos detenidos. Lo ve el
 * personal clínico; recepción usa el Tablero de gestión (RLS lo exige igual).
 */
export default async function TableroClinico() {
  if (!modulos.etapa8) notFound();
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/");
  if (!sesion.veClinico) redirect("/gestion");
  const supabase = await createClient();
  const hoy = fechaLima(new Date());

  const [borradores, pendientes, controles, enCurso, detenidos, itemsReq, consentimientos, interconsultas, equipo] = await Promise.all([
    supabase.from("nota_evolucion").select("id, fecha, odontologo_id, paciente(id, nombres, apellidos)")
      .is("firmada_at", null).is("anulado_at", null).order("fecha").limit(50)
      .returns<{ id: string; fecha: string; odontologo_id: string; paciente: Paciente }[]>(),
    supabase.from("consentimiento").select("id, titulo, creado_at, paciente(id, nombres, apellidos)")
      .eq("estado", "pendiente").is("anulado_at", null).order("creado_at").limit(50)
      .returns<{ id: string; titulo: string; creado_at: string; paciente: Paciente }[]>(),
    supabase.from("seguimiento").select("id, tipo, fecha_programada, nota, paciente(id, nombres, apellidos)")
      .in("tipo", TIPOS_CONTROL).in("resultado", ["pendiente", "mensaje_enviado", "no_contesta", "contactado"])
      .lt("fecha_programada", hoy).order("fecha_programada").limit(100)
      .returns<{ id: string; tipo: TipoControl; fecha_programada: string; nota: string | null; paciente: Paciente }[]>(),
    supabase.from("plan_tratamiento").select("id, titulo, paciente(id, nombres, apellidos), item_plan(estado)")
      .eq("estado", "en_curso").order("aceptado_at").limit(50)
      .returns<{ id: string; titulo: string; paciente: Paciente; item_plan: { estado: string }[] }[]>(),
    supabase.from("v_plan_detenido").select("plan_id, paciente_id, valor_pendiente_centimos").limit(100)
      .returns<{ plan_id: string; paciente_id: string; valor_pendiente_centimos: number }[]>(),
    // Ítems por hacer cuyo procedimiento requiere consentimiento
    supabase.from("item_plan")
      .select("id, item_origen_id, procedimiento_id, pieza, procedimiento, estado, plan_tratamiento!inner(id, estado, paciente(id, nombres, apellidos)), procedimiento_cat:procedimiento!item_plan_procedimiento_fk!inner(requiere_consentimiento)")
      .eq("procedimiento_cat.requiere_consentimiento", true).in("estado", ["aceptado", "programado"])
      .in("plan_tratamiento.estado", ["aceptado", "en_curso", "detenido"]).limit(300)
      .returns<(ItemConOrigen & { procedimiento: string; plan_tratamiento: { id: string; paciente: Paciente } })[]>(),
    supabase.from("consentimiento").select("item_plan_id, estado").in("estado", ["pendiente", "firmado"]).is("anulado_at", null)
      .not("item_plan_id", "is", null).returns<{ item_plan_id: string; estado: string }[]>(),
    supabase.from("interconsulta").select("id, motivo, creada_at, paciente(id, nombres, apellidos)")
      .eq("destinatario_id", sesion.usuarioId).eq("estado", "pendiente").order("creada_at")
      .returns<{ id: string; motivo: string; creada_at: string; paciente: Paciente }[]>(),
    supabase.from("usuario").select("id, nombre").returns<{ id: string; nombre: string }[]>(),
  ]);
  const error = borradores.error ?? pendientes.error ?? controles.error ?? enCurso.error ?? detenidos.error ?? itemsReq.error
    ?? consentimientos.error ?? interconsultas.error;
  if (error) registrarError("tablero_clinico", error);

  // Etapa 10: trabajos de laboratorio por llegar (los atrasados primero)
  const laboratorio = modulos.etapa10
    ? await supabase.from("orden_laboratorio")
        .select("id, tipo_trabajo, pieza, fecha_entrega_prevista, estado, laboratorio(nombre), paciente(id, nombres, apellidos)")
        .eq("estado", "en_laboratorio").order("fecha_entrega_prevista").limit(50)
        .returns<{ id: string; tipo_trabajo: string; pieza: number | null; fecha_entrega_prevista: string | null; estado: "en_laboratorio";
          laboratorio: { nombre: string } | null; paciente: Paciente }[]>()
    : { data: null, error: null };
  if (laboratorio.error) registrarError("tablero_clinico.laboratorio", laboratorio.error);

  // Detenidos: título y paciente del plan
  const idsDetenidos = (detenidos.data ?? []).map((d) => d.plan_id);
  const planesDetenidos = idsDetenidos.length > 0
    ? (await supabase.from("plan_tratamiento").select("id, titulo, paciente(id, nombres, apellidos)").in("id", idsDetenidos)
        .returns<{ id: string; titulo: string; paciente: Paciente }[]>()).data ?? []
    : [];
  const autor = new Map((equipo.data ?? []).map((u) => [u.id, u.nombre]));

  // Ítems que requieren consentimiento y no tienen formato (ni heredado de una versión anterior)
  const firmados = new Set((consentimientos.data ?? []).filter((c) => c.estado === "firmado").map((c) => c.item_plan_id));
  const cubiertos = itemsConConsentimiento(itemsReq.data ?? [], firmados);
  for (const c of consentimientos.data ?? []) cubiertos.add(c.item_plan_id);
  const sinFormato = (itemsReq.data ?? []).filter((i) => !cubiertos.has(i.id));

  // Controles vencidos, como en el Tablero de gestión: no cuentan si el paciente ya tiene
  // cita agendada o si fue atendido en o después de la fecha del control.
  const idsControl = [...new Set((controles.data ?? []).map((c) => c.paciente?.id).filter((x): x is string => !!x))];
  const citasControl = idsControl.length > 0
    ? await supabase.from("cita").select("paciente_id, inicio, estado").in("paciente_id", idsControl)
        .in("estado", ["programada", "confirmada", "en_sala", "atendida"])
        .gte("inicio", `${(controles.data ?? [])[0]?.fecha_programada ?? hoy}T00:00:00-05:00`)
        .returns<{ paciente_id: string; inicio: string; estado: string }[]>()
    : { data: [], error: null };
  if (citasControl.error) registrarError("tablero_clinico.citas", citasControl.error);
  const ahora = Date.now();
  const resuelto = (pacienteId: string | undefined, fecha: string) => (citasControl.data ?? []).some((c) =>
    c.paciente_id === pacienteId && (c.estado === "atendida" ? fechaLima(c.inicio) >= fecha : Date.parse(c.inicio) >= ahora));
  // Un control vencido por paciente (el más antiguo)
  const controlPorPaciente = new Map<string, NonNullable<typeof controles.data>[number]>();
  for (const c of controles.data ?? []) {
    if (resuelto(c.paciente?.id, c.fecha_programada)) continue;
    const k = c.paciente?.id ?? c.id;
    if (!controlPorPaciente.has(k)) controlPorPaciente.set(k, c);
  }

  // Las consultas tienen tope: si se alcanzó, el conteo se muestra como «N+».
  const lleno = (d: unknown[] | null, tope: number) => (d ?? []).length >= tope;
  const secciones: { titulo: string; vacio: string; filas: Fila[]; mas?: boolean }[] = [
    ...((interconsultas.data ?? []).length > 0 ? [{
      titulo: "Interconsultas por responder", vacio: "",
      filas: (interconsultas.data ?? []).map((i) => ({
        clave: i.id, paciente: i.paciente, texto: i.motivo.slice(0, 120),
        detalle: `Pedida el ${formatearFecha(fechaLima(i.creada_at))}`, href: `/pacientes/${i.paciente?.id}/interconsultas`, urgente: true,
      })),
    }] : []),
    {
      titulo: "Evoluciones sin firmar", vacio: "Todas las evoluciones están firmadas.", mas: lleno(borradores.data, 50),
      filas: (borradores.data ?? []).map((n) => {
        const dias = diasEntre(fechaLima(n.fecha), hoy);
        return {
          clave: n.id, paciente: n.paciente, texto: `Borrador de ${autor.get(n.odontologo_id) ?? "—"}`,
          detalle: dias === 0 ? "Abierta hoy" : `Abierta ${haceDias(dias)}`,
          href: `/pacientes/${n.paciente?.id}/evolucion#evolucion-${n.id}`, urgente: dias > 0,
        };
      }),
    },
    {
      titulo: "Consentimientos pendientes", vacio: "No hay consentimientos pendientes.",
      mas: lleno(pendientes.data, 50) || lleno(itemsReq.data, 300),
      filas: [
        ...(pendientes.data ?? []).map((c) => ({
          clave: c.id, paciente: c.paciente, texto: `${c.titulo}: impreso, falta el formato firmado`,
          detalle: `Generado el ${formatearFecha(fechaLima(c.creado_at))}`, href: `/pacientes/${c.paciente?.id}/consentimientos`,
        })),
        ...sinFormato.map((i) => ({
          clave: i.id, paciente: i.plan_tratamiento.paciente,
          texto: `${i.procedimiento}${i.pieza ? ` (pieza ${i.pieza})` : ""}: requiere consentimiento y no tiene formato`,
          href: `/pacientes/${i.plan_tratamiento.paciente?.id}/consentimientos?item=${i.id}`, urgente: true,
        })),
      ],
    },
    {
      titulo: "Controles vencidos", vacio: "No hay controles vencidos.", mas: lleno(controles.data, 100),
      filas: [...controlPorPaciente.values()].map((c) => ({
        clave: c.id, paciente: c.paciente,
        texto: `${NOMBRE_CONTROL[c.tipo] ?? "Control"}${c.nota ? ` · ${c.nota}` : ""}`,
        detalle: `Debía ser el ${formatearFecha(c.fecha_programada)} (${haceDias(diasEntre(c.fecha_programada, hoy))})`,
        href: `/pacientes/${c.paciente?.id}`, urgente: true,
      })),
    },
    {
      titulo: "Tratamientos en curso", vacio: "No hay tratamientos en curso.", mas: lleno(enCurso.data, 50),
      filas: (enCurso.data ?? []).map((p) => {
        const vigentes = p.item_plan.filter((i) => i.estado !== "cancelado" && i.estado !== "reemplazado");
        const hechos = vigentes.filter((i) => i.estado === "realizado").length;
        return {
          clave: p.id, paciente: p.paciente, texto: p.titulo, detalle: `${hechos} de ${vigentes.length} realizados`,
          href: `/pacientes/${p.paciente?.id}/plan?p=${p.id}`,
        };
      }),
    },
    {
      titulo: "Tratamientos detenidos", vacio: "No hay tratamientos detenidos.", mas: lleno(detenidos.data, 100),
      filas: planesDetenidos.map((p) => ({
        clave: p.id, paciente: p.paciente, texto: p.titulo,
        detalle: `Sin cita en los próximos 30 días · pendiente ${formatearSoles(
          (detenidos.data ?? []).find((d) => d.plan_id === p.id)?.valor_pendiente_centimos ?? 0)}`,
        href: `/pacientes/${p.paciente?.id}/plan?p=${p.id}`,
      })),
    },
    ...(modulos.etapa10 ? [{
      titulo: "Trabajos de laboratorio por llegar", vacio: "No hay trabajos en el laboratorio.",
      mas: lleno(laboratorio.data, 50),
      filas: (laboratorio.data ?? []).map((o) => {
        const atraso = diasAtraso(o, hoy);
        return {
          clave: o.id, paciente: o.paciente, texto: `${o.tipo_trabajo}${o.pieza ? ` (pieza ${o.pieza})` : ""} · ${o.laboratorio?.nombre ?? "Laboratorio"}`,
          detalle: atraso > 0 ? `Atrasado: debía llegar el ${formatearFecha(o.fecha_entrega_prevista ?? hoy)} (${haceDias(atraso)})`
            : `Llega el ${formatearFecha(o.fecha_entrega_prevista ?? hoy)}`,
          href: `/pacientes/${o.paciente?.id}/laboratorio`, urgente: atraso > 0,
        };
      }),
    }] : []),
  ];

  return (
    <>
      <Encabezado sesion={sesion} seccion="clinico" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Tablero clínico</h1>
        <p className="mt-1 text-sm text-gray-600">Lo clínico pendiente de la clínica, para que cada tratamiento llegue al final.</p>
        {error && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo cargar todo. Recarga la página.</p>}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {secciones.map((s, n) => (
            // El id no lleva espacios: aria-labelledby es una lista de ids separados por espacios.
            <section key={s.titulo} aria-labelledby={`t-clinico-${n}`} className="rounded-xl border border-gray-200 bg-white">
              <header className="flex items-baseline justify-between border-b border-gray-100 px-4 py-3">
                <h2 id={`t-clinico-${n}`} className="font-semibold">{s.titulo}</h2>
                <span className={`rounded-full px-2 py-0.5 text-sm font-medium ${s.filas.length > 0 ? "bg-amber-50 text-amber-800" : "bg-gray-100 text-gray-600"}`}>
                  {s.filas.length}{s.mas ? "+" : ""}
                </span>
              </header>
              {s.filas.length === 0 ? <p className="px-4 py-4 text-sm text-gray-500">{s.vacio}</p> : (
                <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto">
                  {s.filas.map((f) => (
                    <li key={f.clave} className="px-4 py-2 text-sm">
                      <Link href={f.href} className="font-medium text-teal-800 hover:underline">{nombre(f.paciente)}</Link>
                      <p className={f.urgente ? "text-amber-900" : "text-gray-700"}>{f.texto}</p>
                      {f.detalle && <p className="text-xs text-gray-500">{f.detalle}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
