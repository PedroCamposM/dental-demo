import { describe, expect, it } from "vitest";
import { errorClave, superaPlan, validarInvitacion } from "./equipo";

const t = (v: Record<string, string>) => (c: string) => v[c] ?? "";

describe("validarInvitacion", () => {
  it("exige correo, nombre, rol y COP para el odontólogo", () => {
    const r = validarInvitacion(t({ rol: "odontologo" }));
    expect(r.ok === false && Object.keys(r.errores).sort()).toEqual(["cop", "correo", "nombre"]);
  });
  it("asistente y recepción no llevan COP", () => {
    const r = validarInvitacion(t({ correo: " Ana@Clinica.PE ", nombre: "Ana Ruiz", rol: "asistente", cop: "123" }));
    expect(r).toEqual({ ok: true, datos: { correo: "ana@clinica.pe", nombre: "Ana Ruiz", rol: "asistente", cop: null } });
  });
  it("avisa si supera el plan (solo cuentan los cirujanos dentistas)", () => {
    const odonto = { correo: "a@b.pe", nombre: "Dr. A", rol: "odontologo" as const, cop: "123" };
    expect(superaPlan(2, odonto, 2)).toBe(true);
    expect(superaPlan(1, odonto, 2)).toBe(false);
    expect(superaPlan(9, odonto, null)).toBe(false);
    expect(superaPlan(2, { ...odonto, rol: "recepcion", cop: null }, 2)).toBe(false);
  });
});

describe("errorClave", () => {
  it("de 8 a 72 caracteres con letras y números", () => {
    expect(errorClave("corta1")).toMatch(/8 a 72/);
    expect(errorClave("solotexto")).toMatch(/letras y números/);
    expect(errorClave("Segura2026")).toBeNull();
  });
});
