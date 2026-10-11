import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cerrarSesion } from "@/app/login/actions";
import { fechaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { estadoPlan, type PlanClinica } from "@/lib/prueba";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { formatearSoles } from "@/lib/dinero";
import { NOMBRE_METODO, NOMBRE_PERIODO, type MetodoSuscripcion, type Periodo, type Tarifa } from "@/lib/suscripcion";
import { FormularioPlan } from "./formulario";
import { EditarCobro, EditarTarifa, RevisarPago } from "./suscripcion";

export const metadata: Metadata = { title: "Plataforma – Dental Demo" };

type Fila = {
  id: string; nombre: string; plan: PlanClinica; prueba_hasta: string | null; activo_hasta: string | null; creada: string;
  usuarios: number; pacientes: number; administrador: string | null; tarifa?: string | null; odontologos?: number;
};
type PagoPendiente = {
  id: string; clinica_id: string; clinica: string; tarifa: string; periodo: Periodo; monto_centimos: number; metodo: MetodoSuscripcion;
  operacion: string; pagado_el: string; constancia_ruta: string | null; odontologos: number;
};

/** Soles para un campo editable (sin el «S/»). */
const soles = (c: number) => (c / 100).toFixed(2);

const NOMBRE_PLAN: Record<PlanClinica, string> = { demo: "Demostración", prueba: "Prueba", activo: "Activo" };

/** Panel del superadministrador: clínicas registradas y activación manual del plan. */
export default async function Plataforma() {
  if (!modulos.etapa16) notFound();
  const supabase = await createClient();
  const { data: esSuper } = await supabase.rpc("es_superadmin");
  if (esSuper !== true) notFound();
  const { data, error } = await supabase.rpc("clinicas_plataforma");
  const filas = (data ?? []) as Fila[];
  if (error) registrarError("plataforma.clinicas", error);
  const [pendientesR, tarifasR, cobroR] = modulos.etapa17
    ? await Promise.all([supabase.rpc("pagos_por_confirmar"), supabase.rpc("tarifas"), supabase.rpc("datos_cobro")])
    : [null, null, null];
  for (const r of [pendientesR, tarifasR, cobroR]) if (r?.error) registrarError("plataforma.suscripcion", r.error);
  const pendientes = (pendientesR?.data ?? []) as PagoPendiente[];
  const tarifas = (tarifasR?.data ?? []) as Tarifa[];
  const cobro = ((cobroR?.data ?? []) as Record<string, string | null>[])[0] ?? {};
  const nombreTarifa = (c: string | null | undefined) => tarifas.find((t) => t.codigo === c)?.nombre ?? c ?? "—";
  const excede = (t: string | null | undefined, n: number) => {
    const max = tarifas.find((x) => x.codigo === t)?.max_odontologos;
    return typeof max === "number" && n > max;
  };
  // Constancias: URL firmada de corta duración (bucket privado).
  const enlaces = new Map<string, string>();
  await Promise.all(pendientes.filter((p) => p.constancia_ruta).map(async (p) => {
    const { data: url } = await supabase.storage.from("suscripcion").createSignedUrl(p.constancia_ruta!, 600);
    if (url?.signedUrl) enlaces.set(p.id, url.signedUrl);
  }));
  const hoy = fechaLima(new Date());
  const enUnMes = fechaLima(new Date(Date.now() + 31 * 86_400_000));
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Clínicas de la plataforma</h1>
        <form action={cerrarSesion}>
          <button type="submit" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">Cerrar sesión</button>
        </form>
      </div>
      <p className="mt-1 text-sm text-gray-600">Activa el plan al confirmar el pago. Cada cambio queda en la auditoría de la clínica con su motivo.</p>
      {modulos.etapa17 && (
        <section aria-labelledby="t-pendientes" className="mt-6">
          <h2 id="t-pendientes" className="text-lg font-semibold">Pagos por confirmar ({pendientes.length})</h2>
          <p className="text-sm text-gray-600">Revisa que el pago esté en tu cuenta antes de confirmarlo.</p>
          {pendientes.length === 0 ? <p className="mt-2 text-sm text-gray-600">No hay pagos por confirmar.</p> : (
            <ul className="mt-3 flex flex-col gap-3">
              {pendientes.map((p) => {
                const ficha = filas.find((c) => c.id === p.clinica_id);
                const sinFin = ficha?.plan === "activo" && !ficha.activo_hasta;
                const desc = `el pago de ${p.clinica} (${formatearSoles(p.monto_centimos)}, ${NOMBRE_METODO[p.metodo]} ${p.operacion})`
                  + (sinFin ? ". Hoy no tiene fecha de fin: al confirmar, pasa a tener una" : "");
                return (
                  <li key={p.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="font-medium">{p.clinica}</p>
                    <p className="text-sm text-gray-700">
                      {nombreTarifa(p.tarifa)} {NOMBRE_PERIODO[p.periodo].toLowerCase()} · {formatearSoles(p.monto_centimos)} ·{" "}
                      {NOMBRE_METODO[p.metodo]} n.º {p.operacion} · pagado el {p.pagado_el} · {p.odontologos} odontólogo(s)
                      {excede(p.tarifa, p.odontologos) && <strong className="text-red-700"> · tiene más odontólogos que su plan</strong>}
                      {sinFin && <strong> · hoy activa sin fecha de fin</strong>}
                      {enlaces.has(p.id) && <> · <a href={enlaces.get(p.id)} target="_blank" rel="noopener noreferrer"
                        className="font-medium text-teal-700 hover:underline">Ver constancia</a></>}
                    </p>
                    <div className="mt-3"><RevisarPago pagoId={p.id} descripcion={desc} /></div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">No se pudo cargar la lista de clínicas.</p>}
      <h2 className="mt-8 text-lg font-semibold">Clínicas</h2>
      <ul className="mt-3 flex flex-col gap-3">
        {filas.map((c) => {
          const est = estadoPlan(c, hoy);
          const hasta = c.plan === "prueba" ? c.prueba_hasta : c.plan === "activo" ? c.activo_hasta : null;
          return (
            <li key={c.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">{c.nombre}</h2>
                <p className={`text-sm ${est.soloLectura ? "font-medium text-red-700" : "text-gray-600"}`}>
                  {NOMBRE_PLAN[c.plan]}{hasta ? ` hasta ${hasta}` : ""}{est.soloLectura ? " · solo lectura" : ""}
                </p>
              </div>
              <p className="text-sm text-gray-600">
                Desde {c.creada} · {c.usuarios} usuario(s) · {c.pacientes} paciente(s) · Administrador: {c.administrador ?? "—"}
                {modulos.etapa17 && <> · {c.odontologos ?? 0} odontólogo(s) · Tarifa: {nombreTarifa(c.tarifa)}
                  {excede(c.tarifa, c.odontologos ?? 0) && <strong className="text-red-700"> (supera su plan)</strong>}</>}
              </p>
              {c.plan !== "demo" && (
                <div className="mt-3"><FormularioPlan clinicaId={c.id} nombre={c.nombre} hastaSugerido={enUnMes} /></div>
              )}
            </li>
          );
        })}
      </ul>
      {modulos.etapa17 && (
        <>
          <section aria-labelledby="t-tarifas" className="mt-8 rounded-xl border border-gray-200 bg-white p-4">
            <h2 id="t-tarifas" className="mb-3 text-lg font-semibold">Precios</h2>
            <div className="flex flex-col gap-3">
              {tarifas.map((t) => (
                <EditarTarifa key={t.codigo} codigo={t.codigo} nombre={t.nombre}
                  mensual={soles(t.mensual_centimos)} anual={soles(t.anual_centimos)} />
              ))}
            </div>
          </section>
          <section aria-labelledby="t-cobro" className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
            <h2 id="t-cobro" className="mb-1 text-lg font-semibold">Datos de cobro</h2>
            <p className="mb-3 text-sm text-gray-600">Los ve el administrador de cada clínica en «Plan y pagos».</p>
            <EditarCobro valores={Object.fromEntries(Object.entries(cobro).map(([k, v]) => [k, v ?? ""]))} />
          </section>
        </>
      )}
    </main>
  );
}
