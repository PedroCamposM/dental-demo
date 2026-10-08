import { describe, expect, it } from "vitest";
import { aCentimos, formatearSoles } from "./dinero";

describe("formatearSoles", () => {
  it("formatea céntimos como soles con separador de miles", () => {
    expect(formatearSoles(123450)).toBe("S/ 1,234.50");
    expect(formatearSoles(0)).toBe("S/ 0.00");
    expect(formatearSoles(5)).toBe("S/ 0.05");
    expect(formatearSoles(-8000)).toBe("-S/ 80.00");
  });

  it("rechaza montos que no son enteros", () => {
    expect(() => formatearSoles(10.5)).toThrow();
  });
});

describe("aCentimos", () => {
  it("convierte texto a céntimos enteros sin errores de float", () => {
    expect(aCentimos("1,234.50")).toBe(123450);
    expect(aCentimos("S/ 80")).toBe(8000);
    expect(aCentimos("0.1")).toBe(10);
    expect(aCentimos("19.99")).toBe(1999);
  });

  it("rechaza texto inválido o con más de 2 decimales", () => {
    expect(() => aCentimos("abc")).toThrow();
    expect(() => aCentimos("1.234")).toThrow();
  });
});
