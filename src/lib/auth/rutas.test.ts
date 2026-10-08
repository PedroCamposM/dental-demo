import { describe, expect, it } from "vitest";
import { destinoSeguro, esRutaPublica } from "./rutas";

describe("esRutaPublica", () => {
  it("solo /login es pública", () => {
    expect(esRutaPublica("/login")).toBe(true);
    expect(esRutaPublica("/")).toBe(false);
    expect(esRutaPublica("/pacientes")).toBe(false);
    expect(esRutaPublica("/loginx")).toBe(false);
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
  });
});
