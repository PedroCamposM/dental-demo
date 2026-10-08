"use server";

import { revalidatePath } from "next/cache";
import { esTipoPlantilla, TIPOS_PLANTILLA, validarPlantilla } from "@/lib/plantillas";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export type ResultadoGuardar = { ok: true; id: string } | { ok: false; errores: string[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guarda el texto de una plantilla; si la clínica aún no tiene una de ese tipo, la crea. */
export async function guardarPlantilla(id: string | null, tipo: string, cuerpo: string): Promise<ResultadoGuardar> {
  const sesion = await obtenerSesion();
  if (!sesion) return { ok: false, errores: ["Tu usuario no tiene acceso a una clínica."] };
  if (!esTipoPlantilla(tipo) || (id !== null && !UUID.test(id))) {
    return { ok: false, errores: ["Plantilla inválida."] };
  }
  const errores = validarPlantilla(tipo, cuerpo);
  if (errores.length > 0) return { ok: false, errores };

  const supabase = await createClient();
  const texto = cuerpo.trim();
  const { data, error } = id
    ? await supabase.from("plantilla_mensaje").update({ cuerpo: texto }).eq("id", id).eq("tipo", tipo)
        .select("id").maybeSingle<{ id: string }>()
    : await supabase.from("plantilla_mensaje").insert({
        clinica_id: sesion.clinicaId, tipo, nombre: TIPOS_PLANTILLA[tipo].titulo, cuerpo: texto,
      }).select("id").maybeSingle<{ id: string }>();
  if (error || !data) return { ok: false, errores: ["No se pudo guardar. Inténtalo de nuevo."] };

  revalidatePath("/", "layout");
  return { ok: true, id: data.id };
}
