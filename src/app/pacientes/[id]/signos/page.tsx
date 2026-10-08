import type { Metadata } from "next";
import Link from "next/link";
import { AlertasPaciente } from "@/components/alertas-paciente";
import { Encabezado } from "@/components/encabezado";
import { fechaLima, formatearFecha, horaLima } from "@/lib/fechas";
import { imc } from "@/lib/historia/cuestionario";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { abrirHistoria } from "../datos-clinicos";
import { PestanasPaciente } from "../pestanas";
import { AnularSignos, FormularioSignos } from "./formularios";

export const metadata: Metadata = { title: "Signos vitales – Dental Demo" };

type Registro = {
  id: string; registrado_at: string; registrado_por: string | null; presion_sistolica: number | null;
  presion_diastolica: number | null; frecuencia_cardiaca: number | null; frecuencia_respiratoria: number | null;
  temperatura_c: number | null; peso_kg: number | null; talla_cm: number | null; anulado_at: string | null;
  motivo_anulacion: string | null;
};

const num = (v: number | null, sufijo = "") => (v === null ? "—" : `${Number(v).toLocaleString("es-PE")}${sufijo}`);

export default async function Signos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sesion, paciente } = await abrirHistoria(id);
  const supabase = await createClient();
  const [{ data, error }, { data: equipo }] = await Promise.all([
    supabase.from("signos_vitales")
      .select("id, registrado_at, registrado_por, presion_sistolica, presion_diastolica, frecuencia_cardiaca, "
        + "frecuencia_respiratoria, temperatura_c, peso_kg, talla_cm, anulado_at, motivo_anulacion")
      .eq("paciente_id", id).order("registrado_at", { ascending: false }).limit(30).returns<Registro[]>(),
    supabase.from("usuario").select("id, nombre").returns<{ id: string; nombre: string }[]>(),
  ]);
  if (error) registrarError("signos.listar", error, { paciente: id });
  const autor = new Map((equipo ?? []).map((u) => [u.id, u.nombre]));

  return (
    <>
      <Encabezado sesion={sesion} seccion="pacientes" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <AlertasPaciente pacienteId={id} />
        <Link href="/pacientes" className="text-sm font-medium text-teal-700 hover:underline">← Pacientes</Link>
        <h1 className="mt-3 text-2xl font-semibold">{paciente.nombres} {paciente.apellidos}</h1>
        <PestanasPaciente id={id} actual="signos" veClinico={sesion.veClinico} />

        {!paciente.anulado_at && (
          <section aria-labelledby="t-nuevos" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
            <h2 id="t-nuevos" className="mb-3 text-lg font-semibold">Registrar en esta consulta</h2>
            <FormularioSignos pacienteId={id} />
          </section>
        )}

        <section aria-labelledby="t-historial" className="mt-6">
          <h2 id="t-historial" className="text-lg font-semibold">Registros anteriores</h2>
          {error && <p role="alert" className="mt-2 text-sm text-red-700">No se pudieron cargar los registros. Recarga la página.</p>}
          {(data ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">Aún no hay signos vitales registrados.</p>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full min-w-[46rem] text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Fecha</th>
                    <th scope="col" className="px-3 py-2 font-medium">PA</th>
                    <th scope="col" className="px-3 py-2 font-medium">FC</th>
                    <th scope="col" className="px-3 py-2 font-medium">FR</th>
                    <th scope="col" className="px-3 py-2 font-medium">T°</th>
                    <th scope="col" className="px-3 py-2 font-medium">Peso</th>
                    <th scope="col" className="px-3 py-2 font-medium">Talla</th>
                    <th scope="col" className="px-3 py-2 font-medium">IMC</th>
                    <th scope="col" className="px-3 py-2 font-medium">Registró</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data ?? []).map((r) => {
                    const fecha = `${formatearFecha(fechaLima(r.registrado_at))} ${horaLima(r.registrado_at)}`;
                    return (
                      <tr key={r.id} className={r.anulado_at ? "text-gray-400" : ""}>
                        <td className="whitespace-nowrap px-3 py-2">
                          <span className={r.anulado_at ? "line-through" : ""}>{fecha}</span>
                          {r.anulado_at && <span className="block text-xs">Anulado: {r.motivo_anulacion}</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                          {r.presion_sistolica === null ? "—" : `${r.presion_sistolica}/${r.presion_diastolica} mmHg`}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">{num(r.frecuencia_cardiaca, " lpm")}</td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">{num(r.frecuencia_respiratoria, " rpm")}</td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">{num(r.temperatura_c, " °C")}</td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">{num(r.peso_kg, " kg")}</td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">{num(r.talla_cm, " cm")}</td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">{num(imc(r.peso_kg, r.talla_cm))}</td>
                        <td className="px-3 py-2">
                          {r.registrado_por ? autor.get(r.registrado_por) ?? "—" : "—"}
                          {!r.anulado_at && <AnularSignos id={r.id} pacienteId={id} fecha={fecha} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
