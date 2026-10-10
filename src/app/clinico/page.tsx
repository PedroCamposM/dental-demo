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
import { NOMBRE_CONTROL, TIPOS_CONTROL, type TipoControl } from "@/lib/tablero/calculos";

export const metadata: Metadata = { title: "Tablero clínico – Dental Demo" };

type Paciente = { id: string; nombres: string; apellidos: string } | null;
type Fila = { clave: string; paciente: Paciente; texto: string; detalle?: string; href: string; urgente?: boolean };

const nombre = (p: Paciente) => (p ? `${p.apellidos}, ${p.nombres}` : "Paciente");

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

  // Un control vencido por paciente (el más antiguo)
  const controlPorPaciente = new Map<string, NonNullable<typeof controles.data>[number]>();
  for (const c of controles.data ?? []) {
    const k = c.paciente?.id ?? c.id;
    if (!controlPorPaciente.has(k)) controlPorPaciente.set(k, c);
  }

  const secciones: { titulo: string; vacio: string; filas: Fila[] }[] = [
    ...((interconsultas.data ?? []).length > 0 ? [{
      titulo: "Interconsultas por responder", vacio: "",
      filas: (interconsultas.data ?? []).map((i) => ({
        clave: i.id, paciente: i.paciente, texto: i.motivo.slice(0, 120),
        detalle: `Pedida el ${formatearFecha(fechaLima(i.creada_at))}`, href: `/pacientes/${i.paciente?.id}/interconsultas`, urgente: true,
      })),
    }] : []),
    {
      titulo: "Evoluciones sin firmar", vacio: "Todas las evoluciones están firmadas.",
      filas: (borradores.data ?? []).map((n) => {
        const dias = diasEntre(fechaLima(n.fecha), hoy);
        return {
          clave: n.id, paciente: n.paciente, texto: `Borrador de ${autor.get(n.odontologo_id) ?? "—"}`,
          detalle: dias === 0 ? "Abierta hoy" : `Abierta hace ${dias} ${dias === 1 ? "día" : "días"}`,
          href: `/pacientes/${n.paciente?.id}/evolucion#evolucion-${n.id}`, urgente: dias > 0,
        };
      }),
    },
    {
      titulo: "Consentimientos pendientes", vacio: "No hay consentimientos pendientes.",
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
      titulo: "Controles vencidos", vacio: "No hay controles vencidos.",
      filas: [...controlPorPaciente.values()].map((c) => ({
        clave: c.id, paciente: c.paciente,
        texto: `${NOMBRE_CONTROL[c.tipo] ?? "Control"}${c.nota ? ` · ${c.nota}` : ""}`,
        detalle: `Debía ser el ${formatearFecha(c.fecha_programada)} (hace ${diasEntre(c.fecha_programada, hoy)} días)`,
        href: `/pacientes/${c.paciente?.id}`, urgente: true,
      })),
    },
    {
      titulo: "Tratamientos en curso", vacio: "No hay tratamientos en curso.",
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
      titulo: "Tratamientos detenidos", vacio: "No hay tratamientos detenidos.",
      filas: planesDetenidos.map((p) => ({
        clave: p.id, paciente: p.paciente, texto: p.titulo,
        detalle: `Sin cita en los próximos 30 días · pendiente ${formatearSoles(
          (detenidos.data ?? []).find((d) => d.plan_id === p.id)?.valor_pendiente_centimos ?? 0)}`,
        href: `/pacientes/${p.paciente?.id}/plan?p=${p.id}`,
      })),
    },
  ];

  return (
    <>
      <Encabezado sesion={sesion} seccion="clinico" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Tablero clínico</h1>
        <p className="mt-1 text-sm text-gray-600">Lo clínico pendiente de la clínica, para que cada tratamiento llegue al final.</p>
        {error && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo cargar todo. Recarga la página.</p>}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {secciones.map((s) => (
            <section key={s.titulo} aria-labelledby={`t-${s.titulo}`} className="rounded-xl border border-gray-200 bg-white">
              <header className="flex items-baseline justify-between border-b border-gray-100 px-4 py-3">
                <h2 id={`t-${s.titulo}`} className="font-semibold">{s.titulo}</h2>
                <span className={`rounded-full px-2 py-0.5 text-sm font-medium ${s.filas.length > 0 ? "bg-amber-50 text-amber-800" : "bg-gray-100 text-gray-600"}`}>
                  {s.filas.length}
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
