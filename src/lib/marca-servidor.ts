import "server-only";
import { cache } from "react";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";

/** URL firmada (1 hora) del logo de la clínica; null si no tiene o falla (se muestra sin logo). */
export const urlLogo = cache(async (ruta: string | null): Promise<string | null> => {
  if (!modulos.etapa15 || !ruta) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("marca").createSignedUrl(ruta, 3600);
  if (error) registrarError("marca.logo", error, { ruta });
  return data?.signedUrl ?? null;
});

export type Membrete = {
  nombre: string; ruc: string | null; direccion: string | null; telefono: string | null; correo: string | null;
  pie_documentos: string | null; logo: string | null;
};

/** Datos del membrete de los documentos impresos de la clínica de la sesión. */
export const membreteClinica = cache(async (clinicaId: string): Promise<Membrete> => {
  const supabase = await createClient();
  const columnas = modulos.etapa15 ? "nombre, ruc, direccion, telefono, correo, pie_documentos, logo_ruta" : "nombre, ruc";
  const { data, error } = await supabase.from("clinica").select(columnas).eq("id", clinicaId)
    .maybeSingle<{ nombre: string; ruc: string | null; direccion?: string | null; telefono?: string | null; correo?: string | null;
      pie_documentos?: string | null; logo_ruta?: string | null }>();
  if (error) registrarError("marca.membrete", error);
  return {
    nombre: data?.nombre ?? "Clínica", ruc: data?.ruc ?? null, direccion: data?.direccion ?? null, telefono: data?.telefono ?? null,
    correo: data?.correo ?? null, pie_documentos: data?.pie_documentos ?? null, logo: await urlLogo(data?.logo_ruta ?? null),
  };
});
