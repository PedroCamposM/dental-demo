import { describe, expect, it } from "vitest";
import { procesarPendientes, type Pendiente } from "./envio-diario";

const p = (n: number): Pendiente => ({ clinica_id: `c${n}`, tipo: "vence_pronto", referencia: "2026-10-18", para: `a${n}@x.pe` });

describe("procesarPendientes", () => {
  it("reserva antes de enviar, libera si falla y respeta el tope", async () => {
    const reservados = new Set<string>(["c2"]); // c2 ya lo reservó otra ejecución
    const liberados: string[] = [];
    const enviados: string[] = [];
    const r = await procesarPendientes([p(1), p(2), p(3), p(4)], {
      reservar: async (x) => (reservados.has(x.clinica_id) ? false : (reservados.add(x.clinica_id), true)),
      enviar: async (x) => { if (x.clinica_id === "c3") return false; enviados.push(x.clinica_id); return true; },
      liberar: async (x) => { liberados.push(x.clinica_id); reservados.delete(x.clinica_id); },
    }, 3);
    expect(r).toEqual({ enviados: 1, fallidos: 1, omitidos: 1, pendientes: 1 });
    expect(enviados).toEqual(["c1"]);
    expect(liberados).toEqual(["c3"]);
  });
});
