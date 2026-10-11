import { describe, expect, it } from "vitest";
import { destinoSeguro, esRutaDeIngreso, esRutaPublica } from "./rutas";

describe("esRutaPublica", () => {
  it("login, registro, confirmar el correo y términos son públicas", () => {
    expect(esRutaPublica("/login")).toBe(true);
    expect(esRutaPublica("/registro")).toBe(true);
    expect(esRutaPublica("/auth/confirmar")).toBe(true);
    expect(esRutaPublica("/terminos")).toBe(true);
    expect(esRutaPublica("/bienvenida")).toBe(false);
    expect(esRutaPublica("/plataforma")).toBe(false);
    expect(esRutaPublica("/")).toBe(false);
    expect(esRutaPublica("/pacientes")).toBe(false);
    expect(esRutaPublica("/loginx")).toBe(false);
  });
});

describe("esRutaDeIngreso", () => {
  it("con sesión, login y registro vuelven al inicio; confirmar y términos no", () => {
    expect(esRutaDeIngreso("/login")).toBe(true);
    expect(esRutaDeIngreso("/registro")).toBe(true);
    expect(esRutaDeIngreso("/auth/confirmar")).toBe(false);
    expect(esRutaDeIngreso("/terminos")).toBe(false);
  });
});

describe("destinoSeguro", () => {
  it("acepta rutas internas", () => {
    expect(destinoSeguro("/pacientes?orden=antiguedad")).toBe("/pacientes?orden=antiguedad");
  });

  it("vuelve al inicio si no hay destino o es externo", () => {
    expect(destinoSeguro(null)).toBe("/");
    expect(destinoSeguro("")).toBe("/");
    expect(destinoSeguro("https://malicioso.example")).toBe("/");
    expect(destinoSeguro("//malicioso.example")).toBe("/");
    expect(destinoSeguro("/\\malicioso.example")).toBe("/");
  });

  it("no vuelve al login", () => {
    expect(destinoSeguro("/login?next=/")).toBe("/");
    expect(destinoSeguro("/registro")).toBe("/");
  });
});
