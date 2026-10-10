import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { TIPOS_PLANTILLA } from "@/lib/plantillas";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import type { TipoSeguimiento } from "@/lib/tablero/mensajes";
import { EditorPlantilla } from "./editor";

export const metadata: Metadata = { title: "Plantillas de mensajes – Dental Demo" };

export default async function Plantillas() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/");
  // Las plantillas las editan administración y recepción (RLS, migración 0902).
  if (sesion.rol !== "admin" && sesion.rol !== "recepcion") redirect("/");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plantilla_mensaje")
    .select("id, tipo, cuerpo")
    .eq("activa", true)
    .order("created_at")
    .returns<{ id: string; tipo: TipoSeguimiento; cuerpo: string }[]>();
  if (error) throw new Error(`No se pudieron cargar las plantillas: ${error.message}`);

  const porTipo = new Map<TipoSeguimiento, { id: string; cuerpo: string }>();
  for (const p of data ?? []) if (!porTipo.has(p.tipo)) porTipo.set(p.tipo, p);

  return (
    <>
      <Encabezado sesion={sesion} seccion="plantillas" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Plantillas de mensajes</h1>
        <p className="mt-1 max-w-3xl text-gray-600">
          Son los textos que se pre-llenan al pulsar «Enviar mensaje» en el tablero. Las variables entre
          llaves se reemplazan con los datos de cada paciente; antes de enviar todavía puedes ajustar el texto.
        </p>
        <div className="mt-6 flex flex-col gap-6">
          {(Object.entries(TIPOS_PLANTILLA) as [TipoSeguimiento, (typeof TIPOS_PLANTILLA)[TipoSeguimiento]][]).map(
            ([tipo, def]) => {
              const actual = porTipo.get(tipo);
              return (
                <EditorPlantilla
                  key={tipo}
                  tipo={tipo}
                  titulo={def.titulo}
                  variables={def.variables}
                  id={actual?.id ?? null}
                  cuerpoGuardado={actual?.cuerpo ?? ""}
                />
              );
            },
          )}
        </div>
      </main>
    </>
  );
}
