import { describe, expect, it } from "vitest";
import { estadoPlan, validarRegistro } from "./prueba";

describe("estadoPlan", () => {
  const hoy = "2026-10-11";
  it("la demo y el plan sin fecha no vencen", () => {
    expect(estadoPlan({ plan: "demo", prueba_hasta: null, activo_hasta: null }, hoy)).toEqual({ soloLectura: false, diasRestantes: null, aviso: null });
    expect(estadoPlan({ plan: "activo", prueba_hasta: null, activo_hasta: null }, hoy).soloLectura).toBe(false);
  });
  it("cuenta los días de la prueba (incluido hoy) y avisa", () => {
    expect(estadoPlan({ plan: "prueba", prueba_hasta: "2026-11-09", activo_hasta: null }, hoy))
      .toMatchObject({ soloLectura: false, diasRestantes: 30, aviso: "Prueba gratuita: quedan 30 días." });
    expect(estadoPlan({ plan: "prueba", prueba_hasta: hoy, activo_hasta: null }, hoy).aviso).toBe("Prueba gratuita: queda 1 día.");
  });
  it("al vencer queda en solo lectura", () => {
    const r = estadoPlan({ plan: "prueba", prueba_hasta: "2026-10-10", activo_hasta: null }, hoy);
    expect(r.soloLectura).toBe(true);
    expect(r.aviso).toMatch(/solo lectura/);
    expect(estadoPlan({ plan: "activo", prueba_hasta: null, activo_hasta: "2026-10-01" }, hoy).soloLectura).toBe(true);
  });
  it("el plan pagado solo avisa en la última semana", () => {
    expect(estadoPlan({ plan: "activo", prueba_hasta: null, activo_hasta: "2027-10-11" }, hoy).aviso).toBeNull();
    expect(estadoPlan({ plan: "activo", prueba_hasta: null, activo_hasta: "2026-10-15" }, hoy).aviso).toBe("El plan vence en 5 días.");
  });
});

describe("validarRegistro", () => {
  const base = { email: "Dra.Perez@Correo.pe ", password: "clave1234", clinica: "Consultorio Pérez", nombre: "Dra. Ana Pérez", cop: "12345", acepta: "1" };
  const t = (v: Record<string, string>) => (c: string) => v[c] ?? "";
  it("acepta un registro completo y normaliza el correo", () => {
    expect(validarRegistro(t(base))).toMatchObject({ ok: true, datos: { email: "dra.perez@correo.pe", cop: "12345" } });
  });
  it("exige términos, contraseña con letras y números y COP numérico", () => {
    const r = validarRegistro(t({ ...base, password: "solotexto", cop: "A1", acepta: "" }));
    expect(r.ok === false && Object.keys(r.errores).sort()).toEqual(["acepta", "cop", "password"]);
  });
});
