"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { validarInvitacion, superaPlan, type CampoInvitacion } from "@/lib/equipo";
import { fechaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { estadoPlan, esSoloLectura } from "@/lib/prueba";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { tarifaSugerida, type Tarifa } from "@/lib/suscripcion";
import { clienteServicio } from "@/lib/supabase/servicio";
import { createClient } from "@/lib/supabase/server";

export type EstadoInvitacion = {
  errores: Partial<Record<CampoInvitacion | "general", string>>;
  valores: Record<string, string>;
  mensaje: string | null;
  exitos: number;
};

const MENSAJES_BASE = /^(El nombre va|El número de colegiatura|El odontólogo necesita|Esa persona ya pertenece)/;

async function origenApp(): Promise<string> {
  const h = await headers();
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")
    ?? h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

/** El administrador invita a alguien por correo: recibe un enlace para crear su contraseña. */
export async function invitar(previo: EstadoInvitacion, form: FormData): Promise<EstadoInvitacion> {
  const t = (c: string) => String(form.get(c) ?? "");
  const valores = { correo: t("correo"), nombre: t("nombre"), rol: t("rol"), cop: t("cop") };
  const fallo = (errores: EstadoInvitacion["errores"]): EstadoInvitacion => ({ ...previo, errores, valores, mensaje: null });
  if (!modulos.etapa19) return fallo({ general: "Módulo apagado." });
  const sesion = await obtenerSesion();
  if (sesion?.rol !== "admin") return fallo({ general: "Solo el administrador invita al equipo." });
  if (sesion.plan && estadoPlan(sesion.plan, fechaLima(new Date())).soloLectura) {
    return fallo({ general: "La clínica está en solo lectura: activa el plan para invitar a tu equipo." });
  }
  const r = validarInvitacion(t);
  if (!r.ok) return fallo(r.errores);
  const servicio = clienteServicio();
  if (!servicio) return fallo({ general: "Las invitaciones aún no están disponibles en este entorno." });

  // Antes de enviar nada: ¿ese correo ya tiene cuenta? (no se invita ni se toca una cuenta existente)
  const { data: estadoCorreo, error: errorEstado } = await servicio.rpc("estado_correo", {
    correo: r.datos.correo, id_clinica: sesion.clinicaId,
  });
  if (errorEstado) {
    registrarError("equipo.estado_correo", errorEstado);
    return fallo({ general: "No se pudo enviar la invitación. Vuelve a intentarlo." });
  }
  if (estadoCorreo === "en_tu_equipo") return fallo({ correo: "Esa persona ya está en tu equipo. Si no entró, usa «Reenviar invitación»." });
  if (estadoCorreo !== "libre") return fallo({ correo: "Ese correo ya tiene una cuenta en Dental Demo. Usa otro correo de la persona." });

  const { data, error } = await servicio.auth.admin.inviteUserByEmail(r.datos.correo, {
    redirectTo: `${await origenApp()}/auth/confirmar`,
    data: { nombre: r.datos.nombre },
  });
  if (error || !data.user) {
    if (error?.code === "email_exists" || error?.code === "user_already_exists") {
      return fallo({ correo: "Ese correo ya tiene una cuenta en Dental Demo. Usa otro correo de la persona." });
    }
    if (error?.status === 429) return fallo({ general: "Demasiadas invitaciones seguidas. Espera unos minutos." });
    registrarError("equipo.invitar", error ?? "sin usuario");
    return fallo({ general: "No se pudo enviar la invitación. Vuelve a intentarlo." });
  }
  const invitado = data.user;
  // Solo se deshace una cuenta creada por esta invitación (nunca una que ya existía).
  const recienCreada = Date.now() - Date.parse(invitado.created_at) < 5 * 60_000 && !invitado.email_confirmed_at;
  const deshacer = async () => {
    if (!recienCreada) return;
    const { error: errorBorrar } = await servicio.auth.admin.deleteUser(invitado.id);
    if (errorBorrar) registrarError("equipo.deshacer_invitacion", errorBorrar);
  };
  // La marca de la invitación va en app_metadata: solo la service role la escribe.
  const { error: errorMarca } = await servicio.auth.admin.updateUserById(invitado.id, {
    app_metadata: { invitado_clinica: sesion.clinicaId },
  });
  if (errorMarca) {
    registrarError("equipo.marcar_invitacion", errorMarca);
    await deshacer();
    return fallo({ general: "No se pudo enviar la invitación. Vuelve a intentarlo." });
  }
  const supabase = await createClient();
  const { error: errorAlta } = await supabase.rpc("incorporar_usuario", {
    id_usuario: invitado.id, nombre_usuario: r.datos.nombre, rol_usuario: r.datos.rol, cop_usuario: r.datos.cop,
  });
  if (errorAlta) {
    // Sin clínica la cuenta invitada no sirve: se quita (no es un dato clínico).
    await deshacer();
    if (esSoloLectura(errorAlta)) return fallo({ general: `${errorAlta.message}.` });
    if (errorAlta.code === "P0001" && MENSAJES_BASE.test(errorAlta.message)) return fallo({ general: `${errorAlta.message}.` });
    registrarError("equipo.incorporar", errorAlta);
    return fallo({ general: "No se pudo agregar a la persona. Vuelve a intentarlo." });
  }

  // Aviso (no bloquea) si con esta persona la clínica supera su plan.
  let aviso = "";
  if (modulos.etapa17) {
    const [{ data: tarifas }, { data: odontologos }] = await Promise.all([supabase.rpc("tarifas"), supabase.rpc("odontologos_activos")]);
    const lista = (tarifas ?? []) as Tarifa[];
    const n = typeof odontologos === "number" ? odontologos - 1 : 0; // ya incluye a la persona invitada
    const plan = tarifaSugerida(Math.max(n, 1), lista);
    if (superaPlan(n, r.datos, plan?.max_odontologos)) {
      aviso = ` Con ${n + 1} odontólogos te corresponde el plan ${tarifaSugerida(n + 1, lista)?.nombre ?? "superior"}.`;
    }
  }
  revalidatePath("/configuracion/equipo");
  return { errores: {}, valores: {}, exitos: previo.exitos + 1,
    mensaje: `Invitación enviada a ${r.datos.correo}. Recibirá un enlace para crear su contraseña.${aviso}` };
}

export type EstadoAccion = { error: string | null; mensaje: string | null };

/** Desactivar (deja de entrar; no se borra nada) o reactivar a alguien del equipo. */
export async function cambiarEstado(_previo: EstadoAccion, form: FormData): Promise<EstadoAccion> {
  if (!modulos.etapa19) return { error: "Módulo apagado.", mensaje: null };
  const id = String(form.get("usuario_id") ?? "");
  const activar = form.get("activar") === "1";
  if (!/^[0-9a-f-]{36}$/.test(id)) return { error: "Usuario inválido.", mensaje: null };
  const { error } = await (await createClient()).rpc("cambiar_estado_usuario", { id_usuario: id, activar });
  if (error) {
    if (esSoloLectura(error)
        || (error.code === "P0001" && /^(No puedes|Usuario no encontrado|La clínica debe conservar)/.test(error.message))) {
      return { error: `${error.message}.`, mensaje: null };
    }
    registrarError("equipo.estado", error);
    return { error: "No se pudo guardar. Vuelve a intentarlo.", mensaje: null };
  }
  revalidatePath("/configuracion/equipo");
  return { error: null, mensaje: activar ? "Reactivado." : "Desactivado: ya no puede entrar." };
}

/** Reenvía el acceso (enlace para crear contraseña) a quien no ha entrado aún o lo perdió. */
export async function reenviarAcceso(_previo: EstadoAccion, form: FormData): Promise<EstadoAccion> {
  if (!modulos.etapa19) return { error: "Módulo apagado.", mensaje: null };
  const sesion = await obtenerSesion();
  if (sesion?.rol !== "admin") return { error: "Solo el administrador.", mensaje: null };
  const correo = String(form.get("correo") ?? "");
  const supabase = await createClient();
  // Solo a correos de su propio equipo.
  const { data } = await supabase.rpc("equipo_clinica");
  if (!((data ?? []) as { correo: string | null }[]).some((u) => u.correo === correo)) return { error: "Usuario no encontrado.", mensaje: null };
  const { error } = await supabase.auth.resetPasswordForEmail(correo, { redirectTo: `${await origenApp()}/auth/confirmar` });
  if (error) {
    if (error.status === 429) return { error: "Demasiados envíos seguidos. Espera unos minutos.", mensaje: null };
    registrarError("equipo.reenviar", error);
    return { error: "No se pudo reenviar. Vuelve a intentarlo.", mensaje: null };
  }
  return { error: null, mensaje: `Enviamos a ${correo} un enlace para crear su contraseña.` };
}
