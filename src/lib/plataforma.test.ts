import { describe, expect, it } from "vitest";
import { celdaCsv, conDescuento, csvIngresos, detalleBitacora, esFecha, rangoIngresos, totalesPorMes, type Ingreso } from "./plataforma";

const ingreso = (p: Partial<Ingreso>): Ingreso => ({
  confirmado_el: "2026-10-05", clinica: "Clínica Sol", tarifa: "consultorio", periodo: "mensual", monto_centimos: 9900,
  descuento_pct: null, metodo: "yape", operacion: "123456", pagado_el: "2026-10-04", plan_hasta: "2026-11-04", ...p,
});

describe("totalesPorMes", () => {
  it("suma por mes de confirmación, del más reciente al más antiguo", () => {
    const t = totalesPorMes([
      ingreso({ confirmado_el: "2026-09-30", monto_centimos: 99000 }),
      ingreso({ confirmado_el: "2026-10-01" }),
      ingreso({ confirmado_el: "2026-10-31", monto_centimos: 7920 }),
    ]);
    expect(t).toEqual([{ mes: "2026-10", pagos: 2, centimos: 17820 }, { mes: "2026-09", pagos: 1, centimos: 99000 }]);
  });
  it("sin pagos, vacío", () => expect(totalesPorMes([])).toEqual([]));
});

describe("CSV de ingresos", () => {
  it("escapa comas y comillas y neutraliza fórmulas", () => {
    expect(celdaCsv('Clínica "Sol", Trujillo')).toBe('"Clínica ""Sol"", Trujillo"');
    expect(celdaCsv("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(celdaCsv("-5")).toBe("'-5");
    expect(celdaCsv("simple")).toBe("simple");
  });
  it("lleva BOM, cabecera y montos en soles", () => {
    const csv = csvIngresos([ingreso({ descuento_pct: 20, monto_centimos: 7920 })]);
    expect(csv.startsWith("﻿Confirmado el,Clínica,")).toBe(true);
    expect(csv).toContain("2026-10-05,Clínica Sol,consultorio,mensual,79.20,20,yape,123456,2026-10-04,2026-11-04\r\n");
  });
});

describe("conDescuento", () => {
  it("redondea al céntimo como la base", () => {
    expect(conDescuento(9900, 20)).toBe(7920);
    expect(conDescuento(17900, 15)).toBe(15215);
    expect(conDescuento(9900, null)).toBe(9900);
  });
});

describe("detalleBitacora", () => {
  it("resume cada acción", () => {
    expect(detalleBitacora("cambiar_nombre", { antes: "A", despues: "B", motivo: "pidió" })).toBe("«A» → «B» · pidió");
    expect(detalleBitacora("descuento", { porcentaje: 20, hasta: null, motivo: "fundadora" })).toBe("20 % sin fecha de fin · fundadora");
    expect(detalleBitacora("confirmar_pago", { operacion: "OP1", monto_centimos: 9900, hasta: "2026-11-30" }))
      .toBe("Operación OP1 · S/ 99.00 · plan hasta 2026-11-30");
    expect(detalleBitacora("suspender", { motivo: "fraude" })).toBe("fraude");
    expect(detalleBitacora("datos_cobro", {})).toBe("");
  });
});

describe("esFecha", () => {
  it("rechaza fechas imposibles", () => {
    expect(esFecha("2026-02-28")).toBe(true);
    expect(esFecha("2026-02-31")).toBe(false);
    expect(esFecha("26-02-01")).toBe(false);
  });
});

describe("rangoIngresos", () => {
  it("por defecto el año en curso; ordena un rango al revés; ignora fechas inválidas", () => {
    expect(rangoIngresos({}, "2026-10-11")).toEqual({ desde: "2026-01-01", hasta: "2026-10-11" });
    expect(rangoIngresos({ desde: "2026-10-01", hasta: "2026-09-01" }, "2026-10-11")).toEqual({ desde: "2026-09-01", hasta: "2026-10-01" });
    expect(rangoIngresos({ desde: "2026-02-31" }, "2026-10-11").desde).toBe("2026-01-01");
  });
});
