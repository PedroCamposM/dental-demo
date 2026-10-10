import { describe, expect, it } from "vitest";
import {
  diaSemana, diasEntre, fechaLima, formatearFecha, formatearFechaLarga, hace, horaLima, inicioMesLima, instanteLima,
  sumarDias,
} from "./fechas";

describe("fechas en Lima", () => {
  it("usa la fecha de Lima, no la de UTC", () => {
    // 1 de noviembre 03:00 UTC = 31 de octubre 22:00 en Lima
    expect(fechaLima("2026-11-01T03:00:00Z")).toBe("2026-10-31");
    expect(fechaLima("2026-11-01T05:00:00Z")).toBe("2026-11-01");
  });

  it("el mes empieza a la medianoche de Lima", () => {
    expect(inicioMesLima(new Date("2026-11-01T03:00:00Z")).toISOString()).toBe("2026-10-01T05:00:00.000Z");
    expect(inicioMesLima(new Date("2026-10-08T15:00:00Z")).toISOString()).toBe("2026-10-01T05:00:00.000Z");
  });

  it("cuenta días calendario", () => {
    expect(diasEntre("2026-09-30", "2026-10-08")).toBe(8);
    expect(diasEntre("2026-10-08", "2026-10-08")).toBe(0);
  });

  it("formatea fechas cortas en español", () => {
    expect(formatearFecha("2026-10-08")).toMatch(/^8 oct 2026$/);
  });
});

describe("hace", () => {
  it("dice hoy, singular y plural", () => {
    expect(hace(0)).toBe("hoy");
    expect(hace(1)).toBe("hace 1 día");
    expect(hace(121)).toBe("hace 121 días");
  });
});

describe("agenda en hora de Lima", () => {
  it("convierte fecha y hora de Lima a instante y de vuelta", () => {
    const i = instanteLima("2026-10-12", "09:30");
    expect(i.toISOString()).toBe("2026-10-12T14:30:00.000Z");
    expect(horaLima(i)).toBe("09:30");
    expect(fechaLima(instanteLima("2026-10-12", "23:30"))).toBe("2026-10-12");
  });
  it("día de la semana ISO, sumas de días y fecha larga", () => {
    expect(diaSemana("2026-10-12")).toBe(1);   // lunes
    expect(diaSemana("2026-10-18")).toBe(7);   // domingo
    expect(sumarDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(sumarDias("2026-10-01", -1)).toBe("2026-09-30");
    expect(formatearFechaLarga("2026-10-12")).toBe("lunes, 12 de octubre");
  });
});
