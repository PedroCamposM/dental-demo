import { describe, expect, it } from "vitest";
import { listaEspanol, mensajeCuotas, mensajeNoShow } from "./mensajes";

const contacto = { pacienteId: "pac-1", nombre: "Piero Díaz Quispe", telefono: "51911122233", apoderado: null };

describe("variables del mensaje", () => {
  it("cuotas vencidas: total, cantidad, números y la más antigua", () => {
    const m = mensajeCuotas({
      ...contacto, planIds: ["plan-1"], cuotaId: "cuota-3", numeros: [3, 4], cuotas: 2, centimos: 40000,
      venceMasAntigua: "2026-08-05", diasAtraso: 64,
    }, "Clínica Demo");

    expect(m.destino).toEqual({ tipo: "cuota_vencida", pacienteId: "pac-1", planId: "plan-1", cuotaId: "cuota-3" });
    expect(m.variables).toMatchObject({
      nombre: "Piero", clinica: "Clínica Demo", monto: "S/ 400.00", cuotas: "2 cuotas vencidas", numero: "3 y 4",
    });
    expect(m.variables.fecha).toMatch(/^5 ago 2026$/);
  });

  it("a un menor se le escribe por el nombre del apoderado", () => {
    const m = mensajeNoShow({ ...contacto, apoderado: "Carlos Díaz Pérez", citaId: "c", inicio: "2026-10-02T15:00:00Z" }, "X");
    expect(m.variables).toMatchObject({ nombre: "Carlos", paciente: "Piero Díaz Quispe" });
    expect(m.destino.tipo).toBe("no_show");
  });
});

describe("listaEspanol", () => {
  it("une con comas y 'y'", () => {
    expect(listaEspanol([])).toBe("");
    expect(listaEspanol(["3"])).toBe("3");
    expect(listaEspanol(["3", "4", "5"])).toBe("3, 4 y 5");
  });
});
