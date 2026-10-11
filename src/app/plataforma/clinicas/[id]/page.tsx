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
import { EditarDescuento, NuevoAviso, RenombrarClinica, SuspenderClinica } from "../../herramientas";
import { detalleBitacora, NOMBRE_ACCION, PASOS_ACTIVACION, type Activacion } from "@/lib/plataforma";

export const metadata: Metadata = { title: "Ficha de clínica – Dental Demo" };

type Ficha = {
  usuarios: { nombre: string; rol: string; activo: boolean; correo: string | null; ultimo_ingreso: string | null; cirujano_dentista: boolean }[];
  pagos: { tarifa: string; periodo: Periodo; monto_centimos: number; metodo: MetodoSuscripcion; operacion: string; pagado_el: string;
    estado: EstadoPago; motivo_rechazo: string | null; plan_hasta: string | null; descuento_pct?: number | null }[];
  semanas: { desde: string; pacientes: number; citas: number; evoluciones: number }[];
  notas: { texto: string; creada_at: string; autor: string | null }[];
  correos: { tipo: string; enviado_at: string }[];
  // Etapa 20
  activacion?: Activacion;
  descuento?: { porcentaje: number; hasta: string | null; motivo: string; vigente: boolean } | null;
  bitacora?: { accion: string; detalle: Record<string, unknown>; creada_at: string; autor: string | null }[];
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
        {fila.suspendida_at && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900">Suspendida</span>}
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

      {fila.plan === "demo" && (
        <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
          Es la clínica de demostración compartida: no tiene plan, pagos ni correos automáticos, y no se suspende.
        </p>
      )}
      {fila.suspendida_at && (
        <p role="status" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          Suspendida desde el {fecha(fila.suspendida_at ?? null)}: la clínica está en solo lectura (ve y exporta sus historias, no registra nada nuevo).
        </p>
      )}

      {modulos.etapa20 && f.activacion && fila.plan !== "demo" && (
        <section aria-labelledby="t-activacion" className={seccion}>
          <h2 id="t-activacion" className="mb-2 text-lg font-semibold">
            Activación ({PASOS_ACTIVACION.filter((p) => f.activacion?.[p.clave]).length} de {PASOS_ACTIVACION.length})
          </h2>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {PASOS_ACTIVACION.map((p) => (
              <li key={p.clave} className={f.activacion?.[p.clave] ? "text-emerald-800" : "text-gray-500"}>
                {f.activacion?.[p.clave] ? "✓" : "○"} {p.texto}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-gray-500">Si se queda en los primeros pasos, conviene llamar y ofrecer ayuda.</p>
        </section>
      )}

      {modulos.etapa20 && (
        <section aria-labelledby="t-cuenta" className={seccion}>
          <h2 id="t-cuenta" className="mb-3 text-lg font-semibold">Cuenta</h2>
          <div className="flex flex-col gap-4">
            {fila.plan === "demo" ? <p className="text-sm text-gray-600">La clínica de demostración conserva su nombre.</p> : (
              <>
                <RenombrarClinica clinicaId={fila.id} nombre={fila.nombre} />
                <div className="border-t border-gray-100 pt-3">
                  <p className="mb-1 text-sm font-medium">Descuento</p>
                  <p className="mb-2 text-xs text-gray-600">
                    {f.descuento
                      ? `Tiene ${f.descuento.porcentaje} %${f.descuento.hasta ? ` hasta el ${f.descuento.hasta}` : " sin fecha de fin"}`
                        + `${f.descuento.vigente ? "" : " (ya terminó)"} · ${f.descuento.motivo}. `
                      : "Sin descuento. "}
                    Se aplica cuando la clínica reporta su próximo pago (lo ve en «Plan y pagos»). 0 lo quita.
                  </p>
                  <EditarDescuento clinicaId={fila.id} porcentaje={f.descuento?.vigente ? f.descuento.porcentaje : null}
                    hasta={f.descuento?.vigente ? f.descuento.hasta : null} />
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <p className="mb-1 text-sm font-medium">Aviso solo para esta clínica</p>
                  <NuevoAviso clinicaFija={fila.id} hastaSugerido={fechaLima(new Date(Date.now() + 7 * 86_400_000))} />
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <p className="mb-1 text-sm font-medium">{fila.suspendida_at ? "Reactivar" : "Suspender"}</p>
                  <p className="mb-2 text-xs text-gray-600">
                    Suspendida, la clínica queda en solo lectura: sigue viendo y exportando sus historias (son de sus pacientes),
                    pero no registra nada nuevo. No recibe correos automáticos.
                  </p>
                  <SuspenderClinica clinicaId={fila.id} nombre={fila.nombre} suspendida={Boolean(fila.suspendida_at)} />
                </div>
              </>
            )}
          </div>
        </section>
      )}

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
                <span>{p.pagado_el} · {p.tarifa} {NOMBRE_PERIODO[p.periodo].toLowerCase()} · {formatearSoles(p.monto_centimos)}
                  {p.descuento_pct ? ` (−${p.descuento_pct} %)` : ""} · {NOMBRE_METODO[p.metodo]} {p.operacion}</span>
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

      {modulos.etapa20 && f.bitacora && (
        <section aria-labelledby="t-bitacora" className={seccion}>
          <h2 id="t-bitacora" className="mb-2 text-lg font-semibold">Bitácora del superadministrador</h2>
          {f.bitacora.length === 0 ? <p className="text-sm text-gray-600">Sin cambios registrados todavía.</p> : (
            <ul className="flex flex-col divide-y divide-gray-100 text-sm">
              {f.bitacora.map((b, i) => (
                <li key={`${b.creada_at}-${i}`} className="py-1.5">
                  <span className="font-medium">{NOMBRE_ACCION[b.accion] ?? b.accion}</span>
                  {detalleBitacora(b.accion, b.detalle) && <span className="text-gray-700"> · {detalleBitacora(b.accion, b.detalle)}</span>}
                  <span className="block text-xs text-gray-500">{fecha(b.creada_at)}{b.autor ? ` · ${b.autor}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
