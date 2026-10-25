import { describe, expect, it } from "vitest";
import { ubicacionItem, unidadesZona, validarItems, type ProcedimientoCatalogo } from "./plan";

const catalogo: ProcedimientoCatalogo[] = [
  { id: "a0000000-0000-4000-8000-000000000001", codigo: "PRV-02", nombre: "Destartraje", precio_base_centimos: 6000,
    duracion_minutos: 30, cobro_por: "arcada" },
  { id: "a0000000-0000-4000-8000-000000000002", codigo: "OPE-01", nombre: "Resina", precio_base_centimos: 15000,
    duracion_minutos: 45, cobro_por: "pieza" },
];
const contexto = { catalogo, fases: [1], diagnosticos: [], items: [] };
const entrada = (v: Record<string, string>) => ({ texto: (c: string) => v[c] ?? "", lista: () => [] });

describe("plan por zona (pedido del odontólogo piloto)", () => {
  it("cuenta las unidades de cobro de cada zona", () => {
    expect(unidadesZona("boca", "arcada")).toBe(2);
    expect(unidadesZona("arcada_superior", "arcada")).toBe(1);
    expect(unidadesZona("boca", "cuadrante")).toBe(4);
    expect(unidadesZona("cuadrante_2", "arcada")).toBe(1);
    expect(unidadesZona("boca", "boca")).toBe(1);
    expect(unidadesZona(null, "arcada")).toBe(1);
  });
  it("un destartraje de ambas arcadas es un solo ítem al doble del precio por arcada", () => {
    const r = validarItems(entrada({ procedimiento_id: catalogo[0]!.id, zona: "boca", fase: "1" }), contexto);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.datos).toHaveLength(1);
    expect(r.datos[0]).toMatchObject({ zona: "boca", pieza: null, precio_centimos: 12000 });
  });
  it("el precio escrito manda sobre el calculado", () => {
    const r = validarItems(entrada({ procedimiento_id: catalogo[0]!.id, zona: "boca", precio: "100", fase: "1" }), contexto);
    expect(r.ok && r.datos[0]?.precio_centimos).toBe(10000);
  });
  it("no mezcla piezas y zona, ni acepta zonas inventadas", () => {
    const ambos = validarItems(entrada({ procedimiento_id: catalogo[1]!.id, zona: "boca", pieza: "16", fase: "1" }), contexto);
    expect(!ambos.ok && ambos.errores.pieza).toBe("Elige piezas o una zona, no ambas.");
    const mala = validarItems(entrada({ procedimiento_id: catalogo[1]!.id, zona: "media_boca", fase: "1" }), contexto);
    expect(!mala.ok && mala.errores.zona).toBe("Elige una zona de la lista.");
  });
  it("describe la ubicación en palabras", () => {
    expect(ubicacionItem({ pieza: null, zona: "arcada_superior" })).toBe("Arcada superior");
    expect(ubicacionItem({ pieza: 16, superficies: ["oclusal"], zona: null })).toBe("pieza 16 (oclusal)");
    expect(ubicacionItem({ pieza: null, zona: null })).toBe("—");
  });
});
