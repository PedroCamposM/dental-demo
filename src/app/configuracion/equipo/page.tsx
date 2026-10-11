import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { fechaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { NOMBRE_ROL, obtenerSesion, type Rol } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { NavegacionConfiguracion } from "../navegacion";
import { AccionesUsuario, FormularioInvitar } from "./formulario";

export const metadata: Metadata = { title: "Equipo – Dental Demo" };

type Miembro = { id: string; nombre: string; rol: Rol; cop: string | null; activo: boolean; correo: string | null;
  ultimo_ingreso: string | null; invitacion_pendiente: boolean; desde: string };

/** Equipo de la clínica: invitar, ver último ingreso, desactivar o reactivar (solo administrador). */
export default async function Equipo() {
  if (!modulos.etapa19) notFound();
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/");
  if (sesion.rol !== "admin") redirect("/");
  const { data, error } = await (await createClient()).rpc("equipo_clinica");
  if (error) registrarError("equipo.listar", error);
  const equipo = (data ?? []) as Miembro[];
  return (
    <>
      <Encabezado sesion={sesion} seccion="configuracion" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Configuración de la clínica</h1>
        <NavegacionConfiguracion actual="equipo" />
        <section aria-labelledby="t-invitar" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 id="t-invitar" className="mb-1 text-lg font-semibold">Invitar a alguien</h2>
          <p className="mb-4 text-sm text-gray-600">Le llega un correo para crear su contraseña y entrar a tu clínica.</p>
          <FormularioInvitar />
        </section>
        <section aria-labelledby="t-equipo" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 id="t-equipo" className="mb-3 text-lg font-semibold">Tu equipo ({equipo.filter((u) => u.activo).length} activos)</h2>
          {error && <p role="alert" className="text-sm text-red-700">No se pudo cargar el equipo.</p>}
          <ul className="flex flex-col divide-y divide-gray-100">
            {equipo.map((u) => (
              <li key={u.id} className={`flex flex-wrap items-center justify-between gap-3 py-3 ${u.activo ? "" : "opacity-60"}`}>
                <div className="text-sm">
                  <p className="font-medium">{u.nombre}{u.id === sesion.usuarioId && " (tú)"}</p>
                  <p className="text-gray-600">
                    {NOMBRE_ROL[u.rol]}{u.cop ? ` · COP ${u.cop}` : ""} · {u.correo ?? "—"}
                    {" · "}{!u.activo ? "Desactivado" : u.invitacion_pendiente ? "Invitación pendiente" : `Último ingreso: ${fechaLima(u.ultimo_ingreso!)}`}
                  </p>
                </div>
                {u.id !== sesion.usuarioId && (
                  <AccionesUsuario id={u.id} nombre={u.nombre} correo={u.correo} activo={u.activo} pendiente={u.invitacion_pendiente} />
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
