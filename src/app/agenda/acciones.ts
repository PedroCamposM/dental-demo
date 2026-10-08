"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validarCita, type CampoCita, type EntradaCita } from "@/lib/agenda/citas";
import { fechaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAMPOS: (CampoCita | "procedimiento_id")[] =
  ["paciente_id", "profesional_id", "fecha", "hora", "duracion", "nota", "forzada_motivo", "procedimiento_id"];

export type EstadoNuevaCita = {
  errores: Partial<Record<CampoCita, string>>;
  general: string | null;
  valores: EntradaCita & { procedimiento_id?: string };
};

/** Agenda una cita. La base valida horario, bloqueos, choques y quién puede forzar. */
export async function crearCita(_previo: EstadoNuevaCita, form: FormData): Promise<EstadoNuevaCita> {
  const valores = Object.fromEntries(CAMPOS.map((c) => [c, String(form.get(c) ?? "")])) as EstadoNuevaCita["valores"];
  const fallo = (general: string | null, errores: EstadoNuevaCita["errores"] = {}): EstadoNuevaCita =>
    ({ errores, general, valores });
  if (!modulos.etapa2) return fallo("Este módulo aún no está habilitado.");
  const sesion = await obtenerSesion();
  if (!sesion) return fallo("Tu usuario no tiene acceso a una clínica.");
  if (valores.forzada_motivo && sesion.rol !== "admin") {
    return fallo("Solo el administrador puede agendar fuera del horario o sobre un bloqueo.");
  }

  const r = validarCita(valores, new Date());
  if (!r.ok) return fallo(null, r.errores);

  const supabase = await createClient();
  let nota = r.datos.nota;
  const procedimiento = valores.procedimiento_id ?? "";
  if (UUID.test(procedimiento)) {
    const { data } = await supabase.from("procedimiento").select("nombre").eq("id", procedimiento)
      .maybeSingle<{ nombre: string }>();
    if (data) nota = [data.nombre, nota].filter(Boolean).join(" · ");
  }

  const { error } = await supabase.from("cita").insert({
    clinica_id: sesion.clinicaId, paciente_id: r.datos.paciente_id, odontologo_id: r.datos.odontologo_id,
    inicio: r.datos.inicio, fin: r.datos.fin, nota, forzada_motivo: r.datos.forzada_motivo,
  });
  if (error) {
    // Reglas de la agenda y del paciente (anulado): mensajes propios de la base, en español.
    if (error.code === "P0001") return fallo(`${error.message}.`.replace(/\.\.$/, "."));
    registrarError("agenda.crear", error);
    return fallo("No se pudo agendar la cita. Inténtalo de nuevo.");
  }
  const fecha = fechaLima(r.datos.inicio);
  revalidatePath("/agenda");
  redirect(`/agenda?fecha=${fecha}&creada=1`);
}

export type EstadoCambioCita = { error: string | null };

/** Confirmar o cancelar una cita activa. */
export async function cambiarEstadoCita(_previo: EstadoCambioCita, form: FormData): Promise<EstadoCambioCita> {
  if (!modulos.etapa2) return { error: "Este módulo aún no está habilitado." };
  const sesion = await obtenerSesion();
  if (!sesion) return { error: "Tu usuario no tiene acceso a una clínica." };
  const id = String(form.get("id") ?? "");
  const estado = String(form.get("estado") ?? "");
  if (!UUID.test(id) || (estado !== "confirmada" && estado !== "cancelada")) return { error: "Cambio inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("cita").update({ estado }).eq("id", id)
    .in("estado", estado === "confirmada" ? ["programada"] : ["programada", "confirmada"])
    .select("id").maybeSingle();
  if (error || !data) {
    if (error) registrarError("agenda.estado", error, { id, estado });
    return { error: "No se pudo actualizar la cita. Recarga la página." };
  }
  revalidatePath("/agenda");
  return { error: null };
}
