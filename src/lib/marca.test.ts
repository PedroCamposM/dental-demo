import { describe, expect, it } from "vitest";
import { contraste, cssMarca, esImagenPermitida, validarColor, validarMembrete } from "./marca";

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

describe("logo", () => {
  it("reconoce PNG, JPEG y WebP por su contenido, no por el nombre", () => {
    expect(esImagenPermitida(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe(true);
    expect(esImagenPermitida(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(esImagenPermitida(new TextEncoder().encode("RIFF\x00\x00\x00\x00WEBPVP8"))).toBe(true);
    expect(esImagenPermitida(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'>"))).toBe(false);
  });
});
