// Indicadores del tablero "dinero en riesgo". Funciones puras: reciben las
// filas que RLS deja ver a la clínica y el instante actual. Montos en céntimos.
import { diasEntre, fechaLima, inicioMesLima } from "@/lib/fechas";

// ---------------------------------------------------------------------------
// Filas de entrada (mismos nombres que las columnas de la base)
// ---------------------------------------------------------------------------
export type EstadoPlan = "propuesto" | "aceptado" | "en_curso" | "detenido" | "terminado" | "rechazado";
export type EstadoItem = "propuesto" | "aceptado" | "programado" | "realizado" | "cancelado";
export type EstadoCita = "programada" | "confirmada" | "atendida" | "no_asistio" | "cancelada";
export type ResultadoSeguimiento =
  | "pendiente" | "mensaje_enviado" | "contactado" | "no_contesta" | "agendo_cita" | "rechazo" | "pago";

export type PacienteFila = {
  id: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  apoderado_nombre: string | null;
  apoderado_telefono: string | null;
};
export type PlanFila = {
  id: string;
  paciente_id: string;
  titulo: string;
  estado: EstadoPlan;
  presentado_at: string;
  aceptado_at: string | null;
  fecha_vencimiento: string | null;
};
export type ItemFila = { id: string; plan_id: string; estado: EstadoItem; precio_centimos: number };
export type CuotaFila = {
  cuota_id: string;
  plan_id: string;
  numero: number;
  vence_el: string;
  monto_centimos: number;
  pagado_centimos: number;
};
export type CitaFila = {
  id: string;
  paciente_id: string;
  inicio: string;
  estado: EstadoCita;
  item_ids: string[];
};
export type SeguimientoFila = {
  id: string;
  paciente_id: string;
  plan_id: string | null;
  tipo: "presupuesto" | "tratamiento_detenido" | "cuota_vencida" | "control";
  fecha_programada: string;
  resultado: ResultadoSeguimiento;
};

export type DatosTablero = {
  pacientes: PacienteFila[];
  planes: PlanFila[];
  items: ItemFila[];
  cuotas: CuotaFila[];
  citas: CitaFila[];
  seguimientos: SeguimientoFila[];
};

// ---------------------------------------------------------------------------
// Salida
// ---------------------------------------------------------------------------
export type Contacto = {
  pacienteId: string;
  nombre: string;
  /** Teléfono para WhatsApp: el del paciente o, si es menor, el del apoderado. */
  telefono: string | null;
  apoderado: string | null;
};

export type Presupuesto = Contacto & {
  planIds: string[];
  titulo: string;
  alternativas: number;
  centimos: number;
  presentado: string;
  dias: number;
  vencido: boolean;
};
export type Detenido = Contacto & {
  planId: string;
  titulo: string;
  centimos: number;
  ultimaVisita: string | null;
  diasSinVisita: number | null;
};
export type DeudaCuotas = Contacto & {
  planIds: string[];
  /** Cuota vencida más antigua: a la que se asocia el seguimiento. */
  cuotaId: string;
  numeros: number[];
  cuotas: number;
  centimos: number;
  venceMasAntigua: string;
  diasAtraso: number;
};
export type ControlVencido = Contacto & {
  seguimientoId: string;
  planId: string | null;
  fecha: string;
  diasVencido: number;
  resultado: ResultadoSeguimiento;
};
export type NoShow = Contacto & { citaId: string; inicio: string };
export type PresupuestoDelMes = Contacto & {
  planIds: string[];
  titulo: string;
  centimos: number;
  presentado: string;
  estado: EstadoPlan;
};

export type Indicador<T> = { cantidad: number; centimos: number; lista: T[] };

export type Tablero = {
  hoy: string;
  /**
   * Total en riesgo: presupuestos abiertos + detenidos + cuotas vencidas. Las cuotas
   * de un plan detenido no se suman otra vez (ya están en lo que falta hacer).
   */
  enRiesgo: number;
  mes: {
    presentado: { planes: number; centimos: number };
    aceptado: { planes: number; centimos: number };
    /** Aceptado / presentado del mes en valor, 0–1; null si no se presentó nada. */
    conversion: number | null;
    /** Presupuestos presentados en el mes, con el estado en que están hoy. */
    lista: PresupuestoDelMes[];
  };
  presupuestosAbiertos: Indicador<Presupuesto>;
  detenidos: Indicador<Detenido>;
  cuotasVencidas: Indicador<DeudaCuotas>;
  controlesVencidos: Indicador<ControlVencido>;
  noShow: Indicador<NoShow> & { citasDelMes: number; porcentaje: number | null };
};

const ESTADOS_ACTIVOS: EstadoPlan[] = ["aceptado", "en_curso", "detenido"];
const ITEMS_PENDIENTES: EstadoItem[] = ["aceptado", "programado"];
const CITA_AGENDADA: EstadoCita[] = ["programada", "confirmada"];
const DIA_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Cálculo
// ---------------------------------------------------------------------------
export function calcularTablero(datos: DatosTablero, ahora: Date): Tablero {
  const hoy = fechaLima(ahora);
  const inicioMes = inicioMesLima(ahora).getTime();
  const contacto = indexarContactos(datos.pacientes);
  const valorPlan = sumarPorPlan(datos.items, (i) => i.estado !== "cancelado");

  // Presentado vs. aceptado: las alternativas de un mismo presupuesto cuentan una vez (la de mayor valor).
  const delMes = datos.planes.filter((p) => Date.parse(p.presentado_at) >= inicioMes);
  const listaMes = agruparAlternativas(delMes).map((grupo) => {
    // Si alguna alternativa se aceptó, esa representa al presupuesto; si no, la de mayor valor.
    const principal = grupo.find((p) => p.aceptado_at) ?? mayorValor(grupo, valorPlan);
    return {
      ...contacto(principal.paciente_id),
      planIds: grupo.map((p) => p.id),
      titulo: principal.titulo,
      centimos: Math.max(...grupo.map((p) => valorPlan.get(p.id) ?? 0)),
      presentado: fechaLima(principal.presentado_at),
      estado: principal.estado,
    };
  });
  listaMes.sort((a, b) => b.presentado.localeCompare(a.presentado) || b.centimos - a.centimos);
  const presentado = listaMes.map((x) => x.centimos);
  const aceptados = datos.planes.filter((p) => p.aceptado_at && Date.parse(p.aceptado_at) >= inicioMes);
  const centimosPresentado = suma(presentado);
  const centimosAceptado = suma(aceptados.map((p) => valorPlan.get(p.id) ?? 0));

  const abiertos = presupuestosAbiertos(datos, hoy, contacto, valorPlan);
  const planesDetenidos = detenidos(datos, ahora, hoy, contacto);
  const cuotas = cuotasVencidas(datos, hoy, contacto);
  const idsDetenidos = new Set(planesDetenidos.lista.map((d) => d.planId));
  const cuotasFueraDeDetenidos = suma(datos.cuotas
    .filter((c) => c.vence_el < hoy && !idsDetenidos.has(c.plan_id))
    .map((c) => Math.max(c.monto_centimos - c.pagado_centimos, 0)));

  return {
    hoy,
    enRiesgo: abiertos.centimos + planesDetenidos.centimos + cuotasFueraDeDetenidos,
    mes: {
      presentado: { planes: presentado.length, centimos: centimosPresentado },
      aceptado: { planes: aceptados.length, centimos: centimosAceptado },
      conversion: centimosPresentado > 0 ? centimosAceptado / centimosPresentado : null,
      lista: listaMes,
    },
    presupuestosAbiertos: abiertos,
    detenidos: planesDetenidos,
    cuotasVencidas: cuotas,
    controlesVencidos: controlesVencidos(datos, ahora, hoy, contacto),
    noShow: noShow(datos, ahora, inicioMes, contacto),
  };
}

function presupuestosAbiertos(
  datos: DatosTablero, hoy: string, contacto: (id: string) => Contacto, valorPlan: Map<string, number>,
): Indicador<Presupuesto> {
  const lista = agruparAlternativas(datos.planes.filter((p) => p.estado === "propuesto")).map((grupo) => {
    const principal = mayorValor(grupo, valorPlan);
    const presentado = fechaLima(principal.presentado_at);
    return {
      ...contacto(principal.paciente_id),
      planIds: grupo.map((p) => p.id),
      titulo: principal.titulo,
      alternativas: grupo.length,
      centimos: valorPlan.get(principal.id) ?? 0,
      presentado,
      dias: diasEntre(presentado, hoy),
      vencido: grupo.every((p) => p.fecha_vencimiento !== null && p.fecha_vencimiento < hoy),
    };
  });
  lista.sort((a, b) => b.dias - a.dias || b.centimos - a.centimos);
  return indicador(lista);
}

// Regla 4: ítems aceptados sin realizar y sin cita en los próximos 30 días.
function detenidos(datos: DatosTablero, ahora: Date, hoy: string, contacto: (id: string) => Contacto): Indicador<Detenido> {
  const desde = ahora.getTime();
  const hasta = desde + 30 * DIA_MS;
  const planDeItem = new Map(datos.items.map((i) => [i.id, i.plan_id]));
  const planesConCita = new Set<string>();
  const ultimaVisita = new Map<string, string>();
  for (const c of datos.citas) {
    const t = Date.parse(c.inicio);
    if (CITA_AGENDADA.includes(c.estado) && t >= desde && t <= hasta) {
      for (const id of c.item_ids) {
        const plan = planDeItem.get(id);
        if (plan) planesConCita.add(plan);
      }
    }
    if (c.estado === "atendida" && t <= desde && (ultimaVisita.get(c.paciente_id) ?? "") < c.inicio) {
      ultimaVisita.set(c.paciente_id, c.inicio);
    }
  }

  const pendiente = sumarPorPlan(datos.items, (i) => ITEMS_PENDIENTES.includes(i.estado));
  const lista = datos.planes
    .filter((p) => ESTADOS_ACTIVOS.includes(p.estado) && (pendiente.get(p.id) ?? 0) > 0 && !planesConCita.has(p.id))
    .map((p) => {
      const visita = ultimaVisita.get(p.paciente_id);
      const fecha = visita ? fechaLima(visita) : null;
      return {
        ...contacto(p.paciente_id),
        planId: p.id,
        titulo: p.titulo,
        centimos: pendiente.get(p.id) ?? 0,
        ultimaVisita: fecha,
        diasSinVisita: fecha ? diasEntre(fecha, hoy) : null,
      };
    });
  lista.sort((a, b) => b.centimos - a.centimos);
  return indicador(lista);
}

function cuotasVencidas(datos: DatosTablero, hoy: string, contacto: (id: string) => Contacto): Indicador<DeudaCuotas> {
  const pacienteDePlan = new Map(datos.planes.map((p) => [p.id, p.paciente_id]));
  const porPaciente = new Map<string, DeudaCuotas>();
  for (const c of datos.cuotas) {
    const saldo = c.monto_centimos - c.pagado_centimos;
    const pacienteId = pacienteDePlan.get(c.plan_id);
    if (saldo <= 0 || c.vence_el >= hoy || !pacienteId) continue;
    const deuda = porPaciente.get(pacienteId) ?? {
      ...contacto(pacienteId), planIds: [], cuotaId: c.cuota_id, numeros: [], cuotas: 0, centimos: 0,
      venceMasAntigua: c.vence_el, diasAtraso: 0,
    };
    if (!deuda.planIds.includes(c.plan_id)) deuda.planIds.push(c.plan_id);
    deuda.numeros.push(c.numero);
    deuda.numeros.sort((a, b) => a - b);
    deuda.cuotas += 1;
    deuda.centimos += saldo;
    if (c.vence_el < deuda.venceMasAntigua) {
      deuda.venceMasAntigua = c.vence_el;
      deuda.cuotaId = c.cuota_id;
    }
    deuda.diasAtraso = diasEntre(deuda.venceMasAntigua, hoy);
    porPaciente.set(pacienteId, deuda);
  }
  const lista = [...porPaciente.values()].sort((a, b) => b.diasAtraso - a.diasAtraso || b.centimos - a.centimos);
  return indicador(lista);
}

// Controles con fecha pasada, salvo que el paciente ya agendó (resultado o cita futura).
function controlesVencidos(
  datos: DatosTablero, ahora: Date, hoy: string, contacto: (id: string) => Contacto,
): Indicador<ControlVencido> {
  const conCitaFutura = new Set(
    datos.citas.filter((c) => CITA_AGENDADA.includes(c.estado) && Date.parse(c.inicio) >= ahora.getTime())
      .map((c) => c.paciente_id),
  );
  const porPaciente = new Map<string, ControlVencido>();
  for (const s of datos.seguimientos) {
    if (s.tipo !== "control" || s.fecha_programada >= hoy || s.resultado === "agendo_cita") continue;
    if (conCitaFutura.has(s.paciente_id)) continue;
    const previo = porPaciente.get(s.paciente_id);
    if (previo && previo.fecha <= s.fecha_programada) continue;   // un paciente, una fila: el control más antiguo
    porPaciente.set(s.paciente_id, {
      ...contacto(s.paciente_id),
      seguimientoId: s.id,
      planId: s.plan_id,
      fecha: s.fecha_programada,
      diasVencido: diasEntre(s.fecha_programada, hoy),
      resultado: s.resultado,
    });
  }
  const lista = [...porPaciente.values()].sort((a, b) => b.diasVencido - a.diasVencido);
  return { cantidad: lista.length, centimos: 0, lista };
}

function noShow(
  datos: DatosTablero, ahora: Date, inicioMes: number, contacto: (id: string) => Contacto,
): Tablero["noShow"] {
  const delMes = datos.citas.filter((c) => {
    const t = Date.parse(c.inicio);
    return t >= inicioMes && t <= ahora.getTime() && (c.estado === "atendida" || c.estado === "no_asistio");
  });
  const lista = delMes
    .filter((c) => c.estado === "no_asistio")
    .map((c) => ({ ...contacto(c.paciente_id), citaId: c.id, inicio: c.inicio }))
    .sort((a, b) => b.inicio.localeCompare(a.inicio));
  return {
    cantidad: lista.length,
    centimos: 0,
    lista,
    citasDelMes: delMes.length,
    porcentaje: delMes.length > 0 ? lista.length / delMes.length : null,
  };
}

// ---------------------------------------------------------------------------
// Ayudantes
// ---------------------------------------------------------------------------

/** Alternativas (A, B…) de un mismo presupuesto: mismo paciente, presentadas el mismo día. */
export function agruparAlternativas<P extends Pick<PlanFila, "paciente_id" | "presentado_at">>(planes: P[]): P[][] {
  const grupos = new Map<string, P[]>();
  for (const p of planes) {
    const clave = `${p.paciente_id}|${fechaLima(p.presentado_at)}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), p]);
  }
  return [...grupos.values()];
}

function mayorValor<P extends { id: string }>(planes: P[], valorPlan: Map<string, number>): P {
  return planes.reduce((a, b) => ((valorPlan.get(b.id) ?? 0) > (valorPlan.get(a.id) ?? 0) ? b : a));
}

function sumarPorPlan(items: ItemFila[], incluir: (i: ItemFila) => boolean): Map<string, number> {
  const total = new Map<string, number>();
  for (const i of items) {
    if (incluir(i)) total.set(i.plan_id, (total.get(i.plan_id) ?? 0) + i.precio_centimos);
  }
  return total;
}

function indexarContactos(pacientes: PacienteFila[]): (id: string) => Contacto {
  const porId = new Map(pacientes.map((p) => [p.id, p]));
  return (id) => {
    const p = porId.get(id);
    return {
      pacienteId: id,
      nombre: p ? `${p.nombres} ${p.apellidos}` : "Paciente",
      telefono: p?.telefono ?? p?.apoderado_telefono ?? null,
      apoderado: p && !p.telefono && p.apoderado_telefono ? p.apoderado_nombre : null,
    };
  };
}

function indicador<T extends { centimos: number }>(lista: T[]): Indicador<T> {
  return { cantidad: lista.length, centimos: suma(lista.map((x) => x.centimos)), lista };
}

function suma(valores: number[]): number {
  return valores.reduce((a, b) => a + b, 0);
}
