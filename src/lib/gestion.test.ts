import { describe, expect, it } from "vitest";
import { cobranza, conversion, estadoCliente, filtrarClientes, salud, telefonoWhatsApp, type FilaCliente } from "./gestion";

const ahora = new Date("2026-10-11T15:00:00Z");
const hace = (dias: number) => new Date(ahora.getTime() - dias * 86_400_000).toISOString();
const hoy = "2026-10-11";
const fila = (p: Partial<FilaCliente>): FilaCliente => ({
  id: "x", nombre: "Clínica", plan: "prueba", prueba_hasta: "2026-11-01", activo_hasta: null, administrador: "Dra. A", ...p,
});

describe("salud", () => {
  it("verde, ámbar y rojo según la última actividad", () => {
    expect(salud(hace(2), 10, 10, ahora)).toBe("verde");
    expect(salud(hace(9), 10, 10, ahora)).toBe("ambar");
    expect(salud(hace(20), 0, 10, ahora)).toBe("rojo");
    expect(salud(null, 0, 0, ahora)).toBe("sin_datos");
  });
  it("ámbar si el uso cayó a menos de la mitad", () => {
    expect(salud(hace(1), 4, 20, ahora)).toBe("ambar");
    expect(salud(hace(1), 2, 5, ahora)).toBe("verde"); // muy poco para comparar
  });
});

describe("estado y cobranza", () => {
  it("vencida al pasar el día de fin", () => {
    expect(estadoCliente(fila({ prueba_hasta: "2026-10-11" }), hoy)).toBe("prueba");
    expect(estadoCliente(fila({ prueba_hasta: "2026-10-10" }), hoy)).toBe("vencido");
    expect(estadoCliente(fila({ plan: "activo", activo_hasta: null }), hoy)).toBe("activo");
    expect(estadoCliente(fila({ plan: "demo" }), hoy)).toBe("demo");
  });
  it("lista a quién contactar, primero lo que vence; las vencidas hace más de 30 días ya no", () => {
    const lista = cobranza([
      fila({ id: "a", prueba_hasta: "2026-10-01" }),
      fila({ id: "b", prueba_hasta: "2026-10-14", ultimo_pago_estado: "rechazado" }),
      fila({ id: "c", plan: "activo", activo_hasta: "2027-01-01", ultimo_pago_estado: "rechazado" }),
      fila({ id: "d", prueba_hasta: "2026-12-01" }),
      fila({ id: "e", plan: "demo" }),
      fila({ id: "f", prueba_hasta: "2026-08-01" }),
    ], hoy);
    expect(lista.map((c) => [c.fila.id, c.motivo, c.dias, c.pagoRechazado])).toEqual([
      ["b", "vence_pronto", 3, true], ["a", "vencido", 10, false],
    ]);
  });
});

describe("filtros y utilidades", () => {
  it("busca por nombre, administrador o correo y filtra por estado y salud", () => {
    const filas = [
      fila({ id: "a", nombre: "Sonrisa Feliz", ultima_actividad: hace(1) }),
      fila({ id: "b", nombre: "Dental Norte", correo_admin: "norte@x.pe", prueba_hasta: "2026-10-01", ultima_actividad: hace(30) }),
    ];
    expect(filtrarClientes(filas, { q: "norte" }, hoy, ahora).map((f) => f.id)).toEqual(["b"]);
    expect(filtrarClientes(filas, { estado: "vencido" }, hoy, ahora).map((f) => f.id)).toEqual(["b"]);
    expect(filtrarClientes(filas, { salud: "verde" }, hoy, ahora).map((f) => f.id)).toEqual(["a"]);
  });
  it("conversión y teléfono para WhatsApp", () => {
    expect(conversion(1, 4)).toBe(25);
    expect(conversion(0, 0)).toBeNull();
    expect(telefonoWhatsApp("987 654 321")).toBe("51987654321");
    expect(telefonoWhatsApp("+51 987654321")).toBe("51987654321");
    expect(telefonoWhatsApp("044 123456")).toBeNull();
  });
});
