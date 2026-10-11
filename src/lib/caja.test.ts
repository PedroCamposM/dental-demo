import { describe, expect, it } from "vitest";
import { validarAjuste, validarCierre, validarFondo, validarPago } from "./caja";

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

describe("validarFondo (Etapa 20)", () => {
  const t = (fondo: string) => (c: string) => (c === "fondo" ? fondo : "");
  it("acepta soles con decimales y cero", () => {
    expect(validarFondo(t("100.50"))).toEqual({ ok: true, fondo: 10050 });
    expect(validarFondo(t("0"))).toEqual({ ok: true, fondo: 0 });
  });
  it("rechaza vacío, negativo y texto", () => {
    expect(validarFondo(t("")).ok).toBe(false);
    expect(validarFondo(t("-5")).ok).toBe(false);
    expect(validarFondo(t("cien")).ok).toBe(false);
  });
});
