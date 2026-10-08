import { describe, expect, it } from "vitest";
import { diasEntre, fechaLima, formatearFecha, inicioMesLima } from "./fechas";

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
