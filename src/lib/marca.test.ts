import { describe, expect, it } from "vitest";
import { contraste, cssMarca, validarColor, validarMembrete } from "./marca";

describe("color de la clínica", () => {
  it("calcula el contraste WCAG", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contraste("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });
  it("acepta colores oscuros y rechaza los que no dejan leer el texto blanco", () => {
    expect(validarColor("#1D4ED8")).toEqual({ ok: true, color: "#1d4ed8" });
    expect(validarColor("")).toEqual({ ok: true, color: null });
    expect(validarColor("#fde047").ok).toBe(false);
    expect(validarColor("azul").ok).toBe(false);
  });
  it("deriva los tonos teal desde el color", () => {
    expect(cssMarca("#1d4ed8")).toContain("--color-teal-700:#1d4ed8");
    expect(cssMarca(null)).toBeNull();
    expect(cssMarca("red;}body{display:none")).toBeNull();
  });
});

describe("membrete", () => {
  it("datos opcionales, con correo válido", () => {
    expect(validarMembrete(() => "")).toEqual({ ok: true, datos: { direccion: null, telefono: null, correo: null, pie_documentos: null } });
    const r = validarMembrete((c) => (c === "correo" ? "no-es-correo" : ""));
    expect(r.ok === false && r.errores.correo).toBeDefined();
  });
});
