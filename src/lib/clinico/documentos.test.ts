import { describe, expect, it } from "vitest";
import { finDescanso, validarConstancia, validarReceta } from "./documentos";

const listas = (v: Record<string, string[]>) => (c: string) => v[c] ?? [];
const textos = (v: Record<string, string>) => (c: string) => v[c] ?? "";
const fila = { medicamento: ["Ibuprofeno"], presentacion: ["400 mg tabletas"], dosis: ["1 tableta"],
  frecuencia: ["cada 8 horas"], duracion: ["3 días"], indicaciones: [""] };

describe("validarReceta", () => {
  it("acepta medicamentos completos e ignora filas vacías", () => {
    const r = validarReceta(listas({
      medicamento: ["Ibuprofeno", ""], presentacion: ["400 mg", ""], dosis: ["1 tableta", ""],
      frecuencia: ["cada 8 horas", ""], duracion: ["3 días", ""], indicaciones: ["", ""],
    }), textos({}));
    expect(r).toEqual({ ok: true, datos: expect.objectContaining({ items: [expect.objectContaining({ medicamento: "Ibuprofeno", indicaciones: null })] }) });
  });
  it("una fila empezada debe completarse (no se sugiere nada)", () => {
    const r = validarReceta(listas({ ...fila, dosis: [""] }), textos({}));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.filas[0]).toBe("Completa: dosis.");
  });
  it("exige al menos un medicamento", () => {
    const r = validarReceta(listas({}), textos({}));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.general).toMatch(/al menos un medicamento/);
  });
  it("valida la plantilla y la sesión", () => {
    expect(validarReceta(listas(fila), textos({ guardar_como: "ab" })).ok).toBe(false);
    expect(validarReceta(listas(fila), textos({ nota_id: "x" })).ok).toBe(false);
    const r = validarReceta(listas(fila), textos({ guardar_como: "  Post   exodoncia " }));
    expect(r.ok && r.datos.plantilla).toBe("Post exodoncia");
  });
});

describe("validarConstancia", () => {
  const codigos = new Set(["K08.1", "K04.0"]);
  it("constancia de atención con horas", () => {
    const r = validarConstancia(textos({ tipo: "atencion", fecha_atencion: "2026-10-09", hora_inicio: "09:00", hora_fin: "10:30" }),
      "2026-10-09", codigos);
    expect(r).toEqual({ ok: true, datos: expect.objectContaining({ descanso_desde: null, descanso_dias: null }) });
  });
  it("certificado de descanso: desde la atención hasta 3 días después y de 1 a 30 días", () => {
    const base = { tipo: "descanso", fecha_atencion: "2026-10-09", descanso_desde: "2026-10-09", descanso_dias: "2" };
    expect(validarConstancia(textos(base), "2026-10-09", codigos).ok).toBe(true);
    expect(validarConstancia(textos({ ...base, descanso_desde: "2026-10-15" }), "2026-10-09", codigos).ok).toBe(false);
    expect(validarConstancia(textos({ ...base, descanso_dias: "31" }), "2026-10-09", codigos).ok).toBe(false);
  });
  it("fecha futura, horas al revés y CIE-10 inexistente", () => {
    const r = validarConstancia(textos({ tipo: "atencion", fecha_atencion: "2026-10-10", hora_inicio: "10:00", hora_fin: "09:00",
      cie10: "k99.9" }), "2026-10-09", codigos);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errores.fecha_atencion).toMatch(/futura/);
      expect(r.errores.hora_fin).toBeDefined();
      expect(r.errores.cie10).toBeDefined();
    }
  });
  it("calcula el último día de descanso", () => {
    expect(finDescanso("2026-10-30", 3)).toBe("2026-11-01");
    expect(finDescanso("2026-10-09", 1)).toBe("2026-10-09");
  });
});
