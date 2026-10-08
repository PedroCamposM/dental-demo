import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertasPaciente } from "@/components/alertas-paciente";
import { Encabezado } from "@/components/encabezado";
import { fechaLima, formatearFecha } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { cargarHorarios, cargarProfesionales } from "../datos";
import { FormularioCita, type ProcedimientoCliente } from "./formulario";

export const metadata: Metadata = { title: "Nueva cita – Dental Demo" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Resultado = { id: string; nombres: string; apellidos: string; numero_documento: string | null; fecha_nacimiento: string | null };

export default async function NuevaCita({ searchParams }: {
  searchParams: Promise<{ paciente?: string; q?: string; fecha?: string; profesional?: string }>;
}) {
  if (!modulos.etapa2) notFound();
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/");
  const params = await searchParams;
  const hoy = fechaLima(new Date());
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(params.fecha ?? "") && (params.fecha ?? "") >= hoy ? (params.fecha as string) : hoy;
  const profesional = UUID.test(params.profesional ?? "") ? (params.profesional as string) : "";
  const conservar = `fecha=${fecha}${profesional ? `&profesional=${profesional}` : ""}`;
  const supabase = await createClient();

  // Paso 1: elegir al paciente
  const pacienteId = UUID.test(params.paciente ?? "") ? (params.paciente as string) : null;
  const { data: paciente } = pacienteId
    ? await supabase.from("paciente").select("id, nombres, apellidos").eq("id", pacienteId).is("anulado_at", null)
        .maybeSingle<{ id: string; nombres: string; apellidos: string }>()
    : { data: null };

  if (!paciente) {
    const q = (params.q ?? "").trim().slice(0, 80);
    let resultados: Resultado[] = [];
    if (q.length >= 2) {
      const { data, error } = await supabase.rpc("buscar_pacientes", { texto: q, limite: 20 });
      if (error) registrarError("agenda.buscar_paciente", error);
      resultados = (data ?? []) as Resultado[];
    }
    return (
      <>
        <Encabezado sesion={sesion} seccion="agenda" />
        <main className="mx-auto max-w-3xl px-4 py-8">
          <Link href={`/agenda?fecha=${fecha}`} className="text-sm font-medium text-teal-700 hover:underline">← Agenda</Link>
          <h1 className="mb-1 mt-3 text-2xl font-semibold">Nueva cita</h1>
          <p className="mb-6 text-gray-600">Primero, busca al paciente.</p>
          <form action="/agenda/nueva" className="flex gap-2">
            <input type="hidden" name="fecha" value={fecha} />
            {profesional && <input type="hidden" name="profesional" value={profesional} />}
            <label htmlFor="buscar-paciente" className="sr-only">Buscar paciente</label>
            <input id="buscar-paciente" name="q" defaultValue={q} autoFocus placeholder="DNI, nombre o celular"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-base" />
            <button type="submit" className="rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-50">Buscar</button>
          </form>
          {q.length >= 2 && (
            resultados.length === 0 ? (
              <p className="mt-6 text-gray-600">
                No encontramos pacientes con «{q}».{" "}
                <Link href="/pacientes/nuevo" className="font-medium text-teal-700 hover:underline">Registrar paciente nuevo</Link>
              </p>
            ) : (
              <ul className="mt-6 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
                {resultados.map((r) => (
                  <li key={r.id}>
                    <Link href={`/agenda/nueva?paciente=${r.id}&${conservar}`} className="flex justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                      <span className="font-medium">{r.apellidos}, {r.nombres}</span>
                      <span className="text-sm text-gray-500">
                        {r.numero_documento ?? "Sin documento"}
                        {r.fecha_nacimiento && ` · ${formatearFecha(r.fecha_nacimiento)}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          )}
        </main>
      </>
    );
  }

  // Paso 2: profesional, fecha, hora y duración
  const [profesionales, horarios, sillones, procedimientos] = await Promise.all([
    cargarProfesionales(),
    cargarHorarios(),
    supabase.from("sillon").select("id, nombre").returns<{ id: string; nombre: string }[]>(),
    supabase.from("procedimiento").select("id, nombre, duracion_minutos").eq("activo", true).order("nombre")
      .returns<ProcedimientoCliente[]>(),
  ]);
  const nombreSillon = new Map((sillones.data ?? []).map((s) => [s.id, s.nombre]));

  return (
    <>
      <Encabezado sesion={sesion} seccion="agenda" />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <AlertasPaciente pacienteId={paciente.id} />
        <Link href={`/agenda?fecha=${fecha}`} className="text-sm font-medium text-teal-700 hover:underline">← Agenda</Link>
        <h1 className="mb-6 mt-3 text-2xl font-semibold">Nueva cita</h1>
        <FormularioCita
          paciente={{ id: paciente.id, nombre: `${paciente.nombres} ${paciente.apellidos}` }}
          profesionales={profesionales}
          horarios={horarios.map((h) => ({ ...h, sillon: nombreSillon.get(h.sillon_id) ?? "Sillón" }))}
          procedimientos={procedimientos.data ?? []}
          inicial={{ fecha, profesional_id: profesional }}
          hoy={hoy}
          esAdmin={sesion.rol === "admin"}
        />
      </main>
    </>
  );
}
