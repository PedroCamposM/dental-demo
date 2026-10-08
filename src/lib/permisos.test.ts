import { describe, expect, it } from "vitest";
import { pantallaInicial, veGestion } from "./permisos";

describe("tablero de gestión", () => {
  it("lo ven admin, odontólogo y recepción; no el asistente", () => {
    expect(veGestion("admin")).toBe(true);
    expect(veGestion("odontologo")).toBe(true);
    expect(veGestion("recepcion")).toBe(true);
    expect(veGestion("asistente")).toBe(false);
  });
});

describe("pantalla inicial", () => {
  it("con el módulo de pacientes, todos empiezan en Pacientes", () => {
    for (const rol of ["admin", "odontologo", "asistente", "recepcion"] as const) {
      expect(pantallaInicial(rol, true)).toBe("/pacientes");
    }
  });
  it("sin el módulo de pacientes, gestión para quien la ve y nada para el asistente", () => {
    expect(pantallaInicial("odontologo", false)).toBe("/gestion");
    expect(pantallaInicial("asistente", false)).toBeNull();
  });
});
