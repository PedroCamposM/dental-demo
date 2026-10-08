import { describe, expect, it } from "vitest";
import { TIPOS_PLANTILLA } from "@/lib/plantillas";
import {
  listaEspanol, mensajeControl, mensajeCuotas, mensajeDetenido, mensajeNoShow, mensajePresupuesto, type Mensaje,
} from "./mensajes";

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

describe("variables de cada mensaje y las que ofrece el editor de plantillas", () => {
  it("coinciden, para que ninguna plantilla válida deje variables sin llenar", () => {
    const mensajes: Mensaje[] = [
      mensajePresupuesto({ ...contacto, planIds: ["p"], titulo: "t", alternativas: 1, centimos: 1, presentado: "2026-10-01", dias: 1, vencido: false }, "c"),
      mensajeDetenido({ ...contacto, planId: "p", titulo: "t", centimos: 1, ultimaVisita: null, diasSinVisita: null }, "c"),
      mensajeCuotas({ ...contacto, planIds: ["p"], cuotaId: "q", numeros: [1], cuotas: 1, centimos: 1, venceMasAntigua: "2026-10-01", diasAtraso: 1 }, "c"),
      mensajeControl({ ...contacto, seguimientoId: "s", planId: null, fecha: "2026-10-01", diasVencido: 1, resultado: "pendiente" }, "c"),
      mensajeNoShow({ ...contacto, citaId: "x", inicio: "2026-10-02T15:00:00Z" }, "c"),
    ];
    for (const m of mensajes) {
      const ofrecidas = TIPOS_PLANTILLA[m.destino.tipo].variables.map((v) => v.nombre).sort();
      expect(Object.keys(m.variables).sort(), m.destino.tipo).toEqual(ofrecidas);
    }
  });
});
