import { describe, expect, it } from "vitest";
import {
  calcularTablero,
  type CitaFila,
  type CuotaFila,
  type DatosTablero,
  type ItemFila,
  type PacienteFila,
  type PlanFila,
  type SeguimientoFila,
} from "./calculos";

// Jueves 8 de octubre de 2026, 10:00 en Lima
const AHORA = new Date("2026-10-08T15:00:00Z");

let secuencia = 0;
const id = (prefijo: string) => `${prefijo}-${++secuencia}`;

function paciente(extra: Partial<PacienteFila> = {}): PacienteFila {
  return {
    id: id("pac"), nombres: "Ana", apellidos: "Rojas Silva", telefono: "51987654321",
    apoderado_nombre: null, apoderado_telefono: null, ...extra,
  };
}
function plan(pacienteId: string, extra: Partial<PlanFila> = {}): PlanFila {
  return {
    id: id("plan"), paciente_id: pacienteId, titulo: "Plan", estado: "propuesto",
    presentado_at: "2026-10-02T15:00:00Z", aceptado_at: null, fecha_vencimiento: "2026-11-01", ...extra,
  };
}
function item(planId: string, precio: number, estado: ItemFila["estado"] = "propuesto"): ItemFila {
  return { id: id("item"), plan_id: planId, estado, precio_centimos: precio };
}
function cita(pacienteId: string, inicio: string, estado: CitaFila["estado"], itemIds: string[] = []): CitaFila {
  return { id: id("cita"), paciente_id: pacienteId, inicio, estado, item_ids: itemIds };
}
function cuota(planId: string, venceEl: string, monto: number, pagado = 0, numero = 1): CuotaFila {
  return { cuota_id: id("cuota"), plan_id: planId, numero, vence_el: venceEl, monto_centimos: monto, pagado_centimos: pagado };
}
function control(pacienteId: string, fecha: string, resultado: SeguimientoFila["resultado"] = "pendiente"): SeguimientoFila {
  return { id: id("seg"), paciente_id: pacienteId, plan_id: null, tipo: "control", fecha_programada: fecha, resultado };
}
function datos(parcial: Partial<DatosTablero>): DatosTablero {
  return { pacientes: [], planes: [], items: [], cuotas: [], citas: [], seguimientos: [], ...parcial };
}

describe("presentado vs. aceptado del mes", () => {
  it("suma lo presentado y aceptado desde el 1 del mes en Lima", () => {
    const p = paciente();
    const nuevo = plan(p.id, { presentado_at: "2026-10-01T05:00:00Z" });            // 1 oct 00:00 Lima
    const aceptado = plan(p.id, {
      presentado_at: "2026-09-25T15:00:00Z", aceptado_at: "2026-10-03T15:00:00Z", estado: "aceptado",
    });
    const mesPasado = plan(p.id, { presentado_at: "2026-10-01T04:59:00Z" });         // 30 sep 23:59 Lima
    const t = calcularTablero(datos({
      pacientes: [p], planes: [nuevo, aceptado, mesPasado],
      items: [item(nuevo.id, 100000), item(aceptado.id, 50000), item(mesPasado.id, 70000)],
    }), AHORA);

    expect(t.mes.presentado).toEqual({ planes: 1, centimos: 100000 });
    expect(t.mes.aceptado).toEqual({ planes: 1, centimos: 50000 });
    expect(t.mes.conversion).toBe(0.5);
    expect(t.mes.lista.map((x) => x.planIds)).toEqual([[nuevo.id]]);
  });

  it("en la lista del mes, una alternativa aceptada representa al presupuesto", () => {
    const p = paciente();
    const a = plan(p.id, { titulo: "Implante" });
    const b = plan(p.id, { titulo: "Prótesis fija", estado: "aceptado", aceptado_at: "2026-10-04T15:00:00Z" });
    const t = calcularTablero(datos({
      pacientes: [p], planes: [a, b], items: [item(a.id, 530000), item(b.id, 330000)],
    }), AHORA);
    expect(t.mes.lista).toHaveLength(1);
    expect(t.mes.lista[0]).toMatchObject({ titulo: "Prótesis fija", estado: "aceptado" });
  });

  it("las alternativas A y B cuentan una sola vez, por la de mayor valor", () => {
    const p = paciente();
    const a = plan(p.id, { titulo: "Implante" });
    const b = plan(p.id, { titulo: "Prótesis fija", presentado_at: "2026-10-02T20:00:00Z" });
    const t = calcularTablero(datos({
      pacientes: [p], planes: [a, b], items: [item(a.id, 530000), item(b.id, 330000)],
    }), AHORA);

    expect(t.mes.presentado).toEqual({ planes: 1, centimos: 530000 });
    expect(t.presupuestosAbiertos.cantidad).toBe(1);
    expect(t.presupuestosAbiertos.lista[0]).toMatchObject({ titulo: "Implante", alternativas: 2, centimos: 530000 });
  });

  it("sin presupuestos en el mes la conversión es null", () => {
    expect(calcularTablero(datos({}), AHORA).mes.conversion).toBeNull();
  });

  it("los ítems cancelados no suman al valor del plan", () => {
    const p = paciente();
    const pl = plan(p.id);
    const t = calcularTablero(datos({
      pacientes: [p], planes: [pl], items: [item(pl.id, 10000), item(pl.id, 5000, "cancelado")],
    }), AHORA);
    expect(t.mes.presentado.centimos).toBe(10000);
  });
});

describe("presupuestos abiertos", () => {
  it("lista los propuestos del más antiguo al más nuevo y marca los vencidos", () => {
    const p1 = paciente();
    const p2 = paciente();
    const reciente = plan(p1.id, { presentado_at: "2026-10-06T15:00:00Z", fecha_vencimiento: "2026-11-05" });
    const antiguo = plan(p2.id, { presentado_at: "2026-07-01T15:00:00Z", fecha_vencimiento: "2026-07-31" });
    const rechazado = plan(p2.id, { estado: "rechazado", presentado_at: "2026-08-01T15:00:00Z" });
    const t = calcularTablero(datos({
      pacientes: [p1, p2], planes: [reciente, antiguo, rechazado],
      items: [item(reciente.id, 20000), item(antiguo.id, 350000), item(rechazado.id, 99999)],
    }), AHORA);

    expect(t.presupuestosAbiertos.cantidad).toBe(2);
    expect(t.presupuestosAbiertos.centimos).toBe(370000);
    expect(t.presupuestosAbiertos.lista.map((x) => [x.dias, x.vencido])).toEqual([[99, true], [2, false]]);
  });
});

describe("tratamientos detenidos (regla 4)", () => {
  function caso(citas: (itemId: string, pacienteId: string) => CitaFila[], estadoPlan: PlanFila["estado"] = "en_curso") {
    const p = paciente();
    const pl = plan(p.id, { estado: estadoPlan, aceptado_at: "2026-06-01T15:00:00Z" });
    const hecho = item(pl.id, 75000, "realizado");
    const pendiente = item(pl.id, 180000, "aceptado");
    return calcularTablero(datos({
      pacientes: [p], planes: [pl], items: [hecho, pendiente, item(pl.id, 1000, "cancelado")],
      citas: citas(pendiente.id, p.id),
    }), AHORA);
  }

  it("cuenta el plan con ítems aceptados y sin cita en 30 días, por lo que falta hacer", () => {
    const t = caso((_, pac) => [cita(pac, "2026-08-20T15:00:00Z", "atendida")]);
    expect(t.detenidos.cantidad).toBe(1);
    expect(t.detenidos.lista[0]).toMatchObject({ centimos: 180000, ultimaVisita: "2026-08-20", diasSinVisita: 49 });
  });

  it("no lo cuenta si tiene una cita agendada dentro de 30 días para sus ítems", () => {
    expect(caso((it, pac) => [cita(pac, "2026-11-06T15:00:00Z", "confirmada", [it])]).detenidos.cantidad).toBe(0);
  });

  it("sí lo cuenta si la cita es a más de 30 días, está cancelada o es de otro plan", () => {
    expect(caso((it, pac) => [cita(pac, "2026-11-08T16:00:00Z", "programada", [it])]).detenidos.cantidad).toBe(1);
    expect(caso((it, pac) => [cita(pac, "2026-10-20T15:00:00Z", "cancelada", [it])]).detenidos.cantidad).toBe(1);
    expect(caso((_, pac) => [cita(pac, "2026-10-20T15:00:00Z", "programada", ["otro-item"])]).detenidos.cantidad).toBe(1);
  });

  it("ignora planes propuestos, terminados o rechazados", () => {
    expect(caso(() => [], "propuesto").detenidos.cantidad).toBe(0);
    expect(caso(() => [], "terminado").detenidos.cantidad).toBe(0);
  });
});

describe("cuotas vencidas", () => {
  it("suma por paciente el saldo de las cuotas vencidas", () => {
    const p = paciente();
    const pl = plan(p.id, { estado: "en_curso" });
    const t = calcularTablero(datos({
      pacientes: [p], planes: [pl],
      cuotas: [
        cuota(pl.id, "2026-09-05", 20000, 5000, 4), // vencida, pago parcial
        cuota(pl.id, "2026-08-05", 20000, 0, 3),    // vencida, sin pagar
        cuota(pl.id, "2026-07-05", 20000, 20000, 2), // pagada
        cuota(pl.id, "2026-10-08", 20000, 0, 5),    // vence hoy: aún no está vencida
        cuota(pl.id, "2026-11-05", 20000, 0, 6),    // futura
      ],
    }), AHORA);

    expect(t.cuotasVencidas.cantidad).toBe(1);
    expect(t.cuotasVencidas.centimos).toBe(35000);
    expect(t.cuotasVencidas.lista[0]).toMatchObject({
      cuotas: 2, numeros: [3, 4], venceMasAntigua: "2026-08-05", diasAtraso: 64,
    });
  });

  it("para un menor, el teléfono de contacto es el del apoderado", () => {
    const p = paciente({ telefono: null, apoderado_nombre: "Carlos Rojas", apoderado_telefono: "51911122233" });
    const pl = plan(p.id, { estado: "en_curso" });
    const t = calcularTablero(datos({ pacientes: [p], planes: [pl], cuotas: [cuota(pl.id, "2026-09-01", 20000)] }), AHORA);
    expect(t.cuotasVencidas.lista[0]).toMatchObject({ telefono: "51911122233", apoderado: "Carlos Rojas" });
  });
});

describe("controles vencidos", () => {
  it("cuenta controles pasados sin cita agendada, uno por paciente", () => {
    const a = paciente();
    const b = paciente();
    const c = paciente();
    const d = paciente();
    const t = calcularTablero(datos({
      pacientes: [a, b, c, d],
      seguimientos: [
        control(a.id, "2026-09-01"),
        control(a.id, "2026-04-01", "mensaje_enviado"),   // mismo paciente: queda el más antiguo
        control(b.id, "2026-09-01", "agendo_cita"),       // ya agendó
        control(c.id, "2026-09-01"),                      // tiene cita futura
        control(d.id, "2026-10-08"),                      // vence hoy: todavía no
      ],
      citas: [cita(c.id, "2026-10-15T15:00:00Z", "programada")],
    }), AHORA);

    expect(t.controlesVencidos.cantidad).toBe(1);
    expect(t.controlesVencidos.lista[0]).toMatchObject({
      pacienteId: a.id, fecha: "2026-04-01", diasVencido: 190, resultado: "mensaje_enviado",
    });
  });
});

describe("no-show del mes", () => {
  it("cuenta las inasistencias del mes sobre las citas ya ocurridas", () => {
    const p = paciente();
    const t = calcularTablero(datos({
      pacientes: [p],
      citas: [
        cita(p.id, "2026-10-02T15:00:00Z", "no_asistio"),
        cita(p.id, "2026-10-05T15:00:00Z", "atendida"),
        cita(p.id, "2026-10-06T15:00:00Z", "atendida"),
        cita(p.id, "2026-10-07T15:00:00Z", "atendida"),
        cita(p.id, "2026-09-30T15:00:00Z", "no_asistio"),  // mes pasado
        cita(p.id, "2026-10-07T16:00:00Z", "cancelada"),   // cancelada no cuenta
        cita(p.id, "2026-10-20T15:00:00Z", "programada"),  // futura
      ],
    }), AHORA);

    expect(t.noShow).toMatchObject({ cantidad: 1, citasDelMes: 4, porcentaje: 0.25 });
  });

  it("sin citas en el mes el porcentaje es null", () => {
    expect(calcularTablero(datos({}), AHORA).noShow.porcentaje).toBeNull();
  });
});

describe("total en riesgo", () => {
  it("suma abiertos, detenidos y cuotas vencidas sin contar dos veces un plan detenido", () => {
    const a = paciente();
    const b = paciente();
    const abierto = plan(a.id);
    const ortoDetenida = plan(b.id, { estado: "en_curso", aceptado_at: "2026-04-01T15:00:00Z" });
    const ortoAlDia = plan(b.id, { estado: "en_curso", aceptado_at: "2026-04-01T15:00:00Z" });
    const brackets = item(ortoAlDia.id, 480000, "aceptado");
    const t = calcularTablero(datos({
      pacientes: [a, b], planes: [abierto, ortoDetenida, ortoAlDia],
      items: [item(abierto.id, 100000), item(ortoDetenida.id, 480000, "aceptado"), brackets],
      cuotas: [cuota(ortoDetenida.id, "2026-09-01", 20000), cuota(ortoAlDia.id, "2026-09-01", 20000, 5000)],
      citas: [cita(b.id, "2026-10-20T15:00:00Z", "programada", [brackets.id])],
    }), AHORA);

    expect(t.detenidos.centimos).toBe(480000);
    expect(t.cuotasVencidas.centimos).toBe(35000);
    // 100000 abierto + 480000 detenido + 15000 de la cuota del plan al día
    expect(t.enRiesgo).toBe(595000);
  });
});
