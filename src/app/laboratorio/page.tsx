import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { diasAtraso } from "@/lib/clinico/laboratorio";
import { fechaLima, sumarDias } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { COLUMNAS_ORDEN, ListaOrdenes, type Orden } from "./lista";

export const metadata: Metadata = { title: "Laboratorio – Dental Demo" };

/** Trabajos de laboratorio de la clínica: atrasados, por llegar, por enviar y recibidos recientes. */
export default async function Laboratorio() {
  if (!modulos.etapa10) notFound();
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/");
  if (!sesion.veClinico) redirect("/");
  const hoy = fechaLima(new Date());
  const supabase = await createClient();
  const [abiertas, recibidas] = await Promise.all([
    supabase.from("orden_laboratorio").select(COLUMNAS_ORDEN).in("estado", ["por_enviar", "en_laboratorio"])
      .order("fecha_entrega_prevista", { nullsFirst: false }).order("created_at").limit(200).returns<Orden[]>(),
    supabase.from("orden_laboratorio").select(COLUMNAS_ORDEN).eq("estado", "recibida")
      .gte("fecha_recepcion", sumarDias(hoy, -30)).order("fecha_recepcion", { ascending: false }).limit(50).returns<Orden[]>(),
  ]);
  const error = abiertas.error ?? recibidas.error;
  if (error) registrarError("laboratorio.ver", error);
  const lista = abiertas.data ?? [];
  const atrasadas = lista.filter((o) => diasAtraso(o, hoy) > 0);
  const porLlegar = lista.filter((o) => o.estado === "en_laboratorio" && diasAtraso(o, hoy) === 0);
  const porEnviar = lista.filter((o) => o.estado === "por_enviar");
  const secciones = [
    { id: "t-atrasadas", titulo: "Atrasadas", vacio: "No hay trabajos atrasados.", filas: atrasadas },
    { id: "t-llegar", titulo: "Por llegar", vacio: "No hay trabajos en el laboratorio.", filas: porLlegar },
    { id: "t-enviar", titulo: "Por enviar", vacio: "No hay órdenes por enviar.", filas: porEnviar },
    { id: "t-recibidas", titulo: "Recibidas (últimos 30 días)", vacio: "No se recibieron trabajos en los últimos 30 días.", filas: recibidas.data ?? [] },
  ];
  return (
    <>
      <Encabezado sesion={sesion} seccion="laboratorio" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Laboratorio</h1>
        <p className="mt-1 text-sm text-gray-600">Las órdenes nuevas se hacen desde la ficha del paciente (pestaña Laboratorio).</p>
        {error && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo cargar todo. Recarga la página.</p>}
        {secciones.map((s) => (
          <section key={s.id} aria-labelledby={s.id} className="mt-6">
            <h2 id={s.id} className="text-lg font-semibold">{s.titulo} <span className="text-sm font-normal text-gray-500">({s.filas.length})</span></h2>
            {s.filas.length === 0 ? <p className="mt-1 text-sm text-gray-500">{s.vacio}</p> : (
              <div className="mt-2"><ListaOrdenes ordenes={s.filas} hoy={hoy} conPaciente /></div>
            )}
          </section>
        ))}
      </main>
    </>
  );
}
