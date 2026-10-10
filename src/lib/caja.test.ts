import { describe, expect, it } from "vitest";
import { validarAjuste, validarCierre, validarPago } from "./caja";

const de = (v: Record<string, string>) => (c: string) => v[c] ?? "";

describe("validarPago", () => {
  it("convierte a céntimos y exige método", () => {
    expect(validarPago(de({ monto: "150.50", metodo: "yape", referencia: " OP-1 " })))
      .toEqual({ ok: true, datos: { monto: 15050, metodo: "yape", referencia: "OP-1" } });
    expect(validarPago(de({ monto: "150", metodo: "bitcoin" })).ok).toBe(false);
  });
  it("rechaza montos no positivos o inválidos", () => {
    expect(validarPago(de({ monto: "0", metodo: "efectivo" })).ok).toBe(false);
    expect(validarPago(de({ monto: "-10", metodo: "efectivo" })).ok).toBe(false);
    expect(validarPago(de({ monto: "1.234", metodo: "efectivo" })).ok).toBe(false);
  });
});

describe("validarCierre", () => {
  it("acepta 0 y exige el dato", () => {
    expect(validarCierre(de({ efectivo_contado: "0" }))).toEqual({ ok: true, datos: { efectivo: 0, observaciones: null } });
    expect(validarCierre(de({ efectivo_contado: "" })).ok).toBe(false);
    expect(validarCierre(de({ efectivo_contado: "240" }))).toEqual({ ok: true, datos: { efectivo: 24000, observaciones: null } });
  });
});

describe("validarAjuste", () => {
  it("admite montos negativos, no cero, y exige motivo", () => {
    expect(validarAjuste(de({ monto: "-10", metodo: "efectivo", motivo: "Vuelto mal entregado" })))
      .toEqual({ ok: true, datos: { monto: -1000, metodo: "efectivo", motivo: "Vuelto mal entregado" } });
    expect(validarAjuste(de({ monto: "0", metodo: "efectivo", motivo: "Nada" })).ok).toBe(false);
    expect(validarAjuste(de({ monto: "10", metodo: "efectivo", motivo: "x" })).ok).toBe(false);
  });
});
