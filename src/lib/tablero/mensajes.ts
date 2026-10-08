// Qué mensaje corresponde a cada fila del tablero y con qué variables.
import { formatearSoles } from "@/lib/dinero";
import { fechaLima, formatearFecha } from "@/lib/fechas";
import type { Contacto, ControlVencido, DeudaCuotas, Detenido, NoShow, Presupuesto, PresupuestoDelMes } from "./calculos";

export type TipoSeguimiento = "presupuesto" | "tratamiento_detenido" | "cuota_vencida" | "control" | "no_show";

/** Lo que se guarda en `seguimiento` al enviar el mensaje. */
export type Destino = {
  tipo: TipoSeguimiento;
  pacienteId: string;
  planId: string | null;
  cuotaId: string | null;
};

export type Mensaje = { destino: Destino; variables: Record<string, string> };

function base(c: Contacto, clinica: string): Record<string, string> {
  // Para un menor se escribe al apoderado: "Hola Carlos" y {{paciente}} = el menor.
  const nombre = (c.apoderado ?? c.nombre).split(" ")[0] ?? "";
  return { nombre, paciente: c.nombre, clinica };
}

export function mensajePresupuesto(p: Presupuesto | PresupuestoDelMes, clinica: string): Mensaje {
  return {
    destino: { tipo: "presupuesto", pacienteId: p.pacienteId, planId: p.planIds[0] ?? null, cuotaId: null },
    variables: { ...base(p, clinica), tratamiento: p.titulo, monto: formatearSoles(p.centimos), fecha: formatearFecha(p.presentado) },
  };
}

export function mensajeDetenido(d: Detenido, clinica: string): Mensaje {
  return {
    destino: { tipo: "tratamiento_detenido", pacienteId: d.pacienteId, planId: d.planId, cuotaId: null },
    variables: {
      ...base(d, clinica), tratamiento: d.titulo, monto: formatearSoles(d.centimos),
      fecha: d.ultimaVisita ? formatearFecha(d.ultimaVisita) : "",
    },
  };
}

export function mensajeCuotas(d: DeudaCuotas, clinica: string): Mensaje {
  return {
    destino: { tipo: "cuota_vencida", pacienteId: d.pacienteId, planId: d.planIds[0] ?? null, cuotaId: d.cuotaId },
    variables: {
      ...base(d, clinica),
      monto: formatearSoles(d.centimos),
      fecha: formatearFecha(d.venceMasAntigua),
      cuotas: d.cuotas === 1 ? "1 cuota vencida" : `${d.cuotas} cuotas vencidas`,
      numero: listaEspanol(d.numeros.map(String)),
    },
  };
}

export function mensajeControl(c: ControlVencido, clinica: string): Mensaje {
  return {
    destino: { tipo: "control", pacienteId: c.pacienteId, planId: c.planId, cuotaId: null },
    variables: { ...base(c, clinica), fecha: formatearFecha(c.fecha) },
  };
}

export function mensajeNoShow(n: NoShow, clinica: string): Mensaje {
  return {
    destino: { tipo: "no_show", pacienteId: n.pacienteId, planId: null, cuotaId: null },
    variables: { ...base(n, clinica), fecha: formatearFecha(fechaLima(n.inicio)) },
  };
}

/** ["3", "4", "5"] -> "3, 4 y 5" */
export function listaEspanol(partes: string[]): string {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}
