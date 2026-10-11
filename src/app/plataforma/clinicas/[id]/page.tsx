import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatearSoles } from "@/lib/dinero";
import { fechaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { diasHasta, estadoCliente, finPlan, NOMBRE_ESTADO, NOMBRE_SALUD, salud, type FilaCliente } from "@/lib/gestion";
import { registrarError } from "@/lib/registro";
import { NOMBRE_ESTADO_PAGO, NOMBRE_METODO, NOMBRE_PERIODO, type EstadoPago, type MetodoSuscripcion, type Periodo } from "@/lib/suscripcion";
import { createClient } from "@/lib/supabase/server";
import { COLOR_SALUD, Contacto } from "../../contacto";
import { FormularioPlan } from "../../formulario";
import { NuevaNota } from "../../suscripcion";

export const metadata: Metadata = { title: "Ficha de clínica – Dental Demo" };

type Ficha = {
  usuarios: { nombre: string; rol: string; activo: boolean; correo: string | null; ultimo_ingreso: string | null; cirujano_dentista: boolean }[];
  pagos: { tarifa: string; periodo: Periodo; monto_centimos: number; metodo: MetodoSuscripcion; operacion: string; pagado_el: string;
    estado: EstadoPago; motivo_rechazo: string | null; plan_hasta: string | null }[];
  semanas: { desde: string; pacientes: number; citas: number; evoluciones: number }[];
  notas: { texto: string; creada_at: string; autor: string | null }[];
  correos: { tipo: string; enviado_at: string }[];
};
type Fila = FilaCliente & { creada: string; usuarios: number; pacientes: number; odontologos?: number; tarifa?: string | null };

const NOMBRE_ROL: Record<string, string> = { admin: "Administrador", odontologo: "Odontólogo", asistente: "Asistente", recepcion: "Recepción" };
const NOMBRE_CORREO: Record<string, string> = { vence_pronto: "Aviso: vence pronto", vencido: "Aviso: venció", sin_uso: "Aviso: sin uso" };

/** Ficha de una clínica para el superadministrador: cuenta, uso (solo conteos), pagos y notas. */
export default async function FichaClinica({ params }: { params: Promise<{ id: string }> }) {
  if (!modulos.etapa18) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: esSuper } = await supabase.rpc("es_superadmin");
  if (esSuper !== true) notFound();
  const [filasR, fichaR] = await Promise.all([supabase.rpc("clinicas_plataforma", { solo: id }), supabase.rpc("ficha_clinica", { id_clinica: id })]);
  const fila = ((filasR.data ?? []) as Fila[]).find((c) => c.id === id);
  if (fichaR.error || !fila) {
    if (fichaR.error && !fichaR.error.message.startsWith("Clínica no encontrada")) registrarError("plataforma.ficha", fichaR.error);
    notFound();
  }
  const f = fichaR.data as Ficha;
  const hoy = fechaLima(new Date());
  const ahora = new Date();
  const fin = finPlan(fila);
  const estado = estadoCliente(fila, hoy);
  const s = salud(fila.ultima_actividad ?? null, fila.actividad_30 ?? 0, fila.actividad_previa_30 ?? 0, ahora);
  const seccion = "mt-6 rounded-xl border border-gray-200 bg-white p-4";
  const fecha = (iso: string | null) => (iso ? fechaLima(iso) : "—");

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/plataforma" className="text-sm text-teal-700 hover:underline">← Clínicas de la plataforma</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{fila.nombre}</h1>
        {fila.plan !== "demo" && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLOR_SALUD[s]}`}>{NOMBRE_SALUD[s]}</span>}
      </div>
      <p className="mt-1 text-gray-700">
        {NOMBRE_ESTADO[estado]}
        {fin && (estado === "vencido" ? ` desde el ${fin}` : ` hasta el ${fin} (${diasHasta(fin, hoy)} días)`)}
        {" · "}Desde {fila.creada} · {fila.pacientes} paciente(s) · {fila.odontologos ?? 0} odontólogo(s)
        {" · "}Última actividad: {fecha(fila.ultima_actividad ?? null)}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-600">Contacto: {fila.administrador ?? "—"} {fila.correo_admin ? `(${fila.correo_admin})` : ""}</span>
        <Contacto fila={fila} />
      </div>

      <section aria-labelledby="t-uso" className={seccion}>
        <h2 id="t-uso" className="mb-1 text-lg font-semibold">Uso por semana</h2>
        <p className="mb-2 text-xs text-gray-500">Solo cantidades: no se muestran datos de pacientes.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-gray-600"><tr>
              <th className="py-1 pr-3 font-medium">Semana del</th><th className="py-1 pr-3 font-medium">Pacientes nuevos</th>
              <th className="py-1 pr-3 font-medium">Citas creadas</th><th className="py-1 font-medium">Evoluciones firmadas</th>
            </tr></thead>
            <tbody>
              {f.semanas.map((w) => (
                <tr key={w.desde} className="border-t border-gray-100">
                  <td className="py-1 pr-3">{w.desde}</td><td className="py-1 pr-3">{w.pacientes}</td>
                  <td className="py-1 pr-3">{w.citas}</td><td className="py-1">{w.evoluciones}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="t-usuarios" className={seccion}>
        <h2 id="t-usuarios" className="mb-2 text-lg font-semibold">Usuarios</h2>
        <ul className="flex flex-col divide-y divide-gray-100 text-sm">
          {f.usuarios.map((u) => (
            <li key={`${u.correo}-${u.nombre}`} className="flex flex-wrap justify-between gap-2 py-1.5">
              <span>{u.nombre} · {NOMBRE_ROL[u.rol] ?? u.rol}{u.cirujano_dentista ? " (COP)" : ""}{!u.activo && " · inactivo"}</span>
              <span className="text-gray-600">{u.correo ?? "—"} · último ingreso: {fecha(u.ultimo_ingreso)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="t-pagos" className={seccion}>
        <h2 id="t-pagos" className="mb-2 text-lg font-semibold">Pagos</h2>
        {f.pagos.length === 0 ? <p className="text-sm text-gray-600">Sin pagos reportados.</p> : (
          <ul className="flex flex-col divide-y divide-gray-100 text-sm">
            {f.pagos.map((p) => (
              <li key={`${p.metodo}-${p.operacion}-${p.pagado_el}`} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span>{p.pagado_el} · {p.tarifa} {NOMBRE_PERIODO[p.periodo].toLowerCase()} · {formatearSoles(p.monto_centimos)} · {NOMBRE_METODO[p.metodo]} {p.operacion}</span>
                <span>{NOMBRE_ESTADO_PAGO[p.estado]}{p.plan_hasta ? ` (hasta ${p.plan_hasta})` : ""}{p.motivo_rechazo ? `: ${p.motivo_rechazo}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
        {fila.plan !== "demo" && (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="mb-2 text-sm font-medium">Ajustar el plan a mano</p>
            <FormularioPlan clinicaId={fila.id} nombre={fila.nombre} hastaSugerido={fechaLima(new Date(Date.now() + 31 * 86_400_000))} />
          </div>
        )}
      </section>

      <section aria-labelledby="t-notas" className={seccion}>
        <h2 id="t-notas" className="mb-2 text-lg font-semibold">Notas internas</h2>
        <NuevaNota clinicaId={fila.id} />
        {f.notas.length > 0 && (
          <ul className="mt-3 flex flex-col divide-y divide-gray-100 text-sm">
            {f.notas.map((n) => (
              <li key={n.creada_at} className="py-2">
                <p className="whitespace-pre-line">{n.texto}</p>
                <p className="text-xs text-gray-500">{fecha(n.creada_at)}{n.autor ? ` · ${n.autor}` : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="t-correos" className={seccion}>
        <h2 id="t-correos" className="mb-2 text-lg font-semibold">Correos automáticos enviados</h2>
        {f.correos.length === 0 ? <p className="text-sm text-gray-600">Ninguno todavía.</p> : (
          <ul className="text-sm">
            {f.correos.map((c) => <li key={`${c.tipo}-${c.enviado_at}`}>{fecha(c.enviado_at)} · {NOMBRE_CORREO[c.tipo] ?? c.tipo}</li>)}
          </ul>
        )}
      </section>
    </main>
  );
}
