import { describe, expect, it } from "vitest";
import { formatearDuracion, validarProcedimiento } from "./validacion";

const base = {
  codigo: "end-01", nombre: "  Endodoncia   unirradicular ", especialidad: "endodoncia", precio: "450",
  duracion_minutos: "60", requiere_consentimiento: "1", control_dias: "",
};

describe("validarProcedimiento", () => {
  it("normaliza código, nombre y precio en céntimos", () => {
    const r = validarProcedimiento(base);
    expect(r).toEqual({
      ok: true,
      datos: {
        codigo: "END-01", nombre: "Endodoncia unirradicular", especialidad: "endodoncia",
        precio_base_centimos: 45000, duracion_minutos: 60, requiere_consentimiento: true,
        control_dias: null, activo: true,
      },
    });
  });

  it("acepta precio 0, decimales y control en días", () => {
    const r = validarProcedimiento({ ...base, precio: "0", control_dias: "30", requiere_consentimiento: undefined });
    expect(r.ok && r.datos).toMatchObject({ precio_base_centimos: 0, control_dias: 30, requiere_consentimiento: false });
    const d = validarProcedimiento({ ...base, precio: "S/ 1,250.50" });
    expect(d.ok && d.datos.precio_base_centimos).toBe(125050);
  });

  it("rechaza datos inválidos con mensajes por campo", () => {
    const r = validarProcedimiento({
      codigo: "x", nombre: "ab", especialidad: "magia", precio: "-5", duracion_minutos: "7", control_dias: "0",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errores).sort()).toEqual(
      ["codigo", "control_dias", "duracion_minutos", "especialidad", "nombre", "precio"].sort(),
    );
  });

  it("rechaza precios no numéricos y por encima del máximo", () => {
    expect(validarProcedimiento({ ...base, precio: "abc" }).ok).toBe(false);
    expect(validarProcedimiento({ ...base, precio: "100000.01" }).ok).toBe(false);
    expect(validarProcedimiento({ ...base, precio: "" }).ok).toBe(false);
  });

  it("marca inactivo solo si se pide", () => {
    const r = validarProcedimiento({ ...base, activo: "0" });
    expect(r.ok && r.datos.activo).toBe(false);
  });
});

describe("formatearDuracion", () => {
  it("muestra minutos y horas", () => {
    expect(formatearDuracion(45)).toBe("45 min");
    expect(formatearDuracion(60)).toBe("1 h");
    expect(formatearDuracion(90)).toBe("1 h 30 min");
  });
});
