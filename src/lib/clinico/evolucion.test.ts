import { describe, expect, it } from "vitest";
import { leerItemsSesion, validarEvolucion, type CampoEvolucion } from "./evolucion";

const con = (v: Partial<Record<CampoEvolucion, string>>) => (c: CampoEvolucion) => v[c] ?? "";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("validarEvolucion", () => {
  it("un borrador puede guardarse vacío", () => {
    const r = validarEvolucion(con({}), false);
    expect(r).toEqual({ ok: true, datos: expect.objectContaining({ texto: "", materiales: null }) });
  });

  it("para firmar exige la descripción", () => {
    const r = validarEvolucion(con({ texto: "  " }), true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.texto).toMatch(/antes de firmar/);
    expect(validarEvolucion(con({ texto: "Resina en 16" }), true).ok).toBe(true);
  });

  it("recorta espacios y respeta los máximos", () => {
    const r = validarEvolucion(con({ texto: "x".repeat(4001), proxima_cita: "  en 7 días  " }), false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.texto).toBe("Máximo 4000 caracteres.");
    const ok = validarEvolucion(con({ proxima_cita: "  en 7 días  " }), false);
    expect(ok.ok && ok.datos.proxima_cita).toBe("en 7 días");
  });

  it("la cantidad de anestesia exige el tipo", () => {
    const r = validarEvolucion(con({ texto: "Exodoncia", anestesia_cantidad: "1 cartucho" }), true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.anestesia_tipo).toBeDefined();
  });
});

describe("leerItemsSesion", () => {
  const permitidos = new Set([A, B]);

  it("marca trabajados y terminados de los ítems permitidos", () => {
    expect(leerItemsSesion([A, B], [A], permitidos)).toEqual({
      ok: true,
      items: [{ item_id: A, trabajado: true, terminado: true }, { item_id: B, trabajado: true, terminado: false }],
    });
  });

  it("un ítem no marcado queda como no trabajado", () => {
    const r = leerItemsSesion([], [], permitidos);
    expect(r.ok && r.items.every((i) => !i.trabajado && !i.terminado)).toBe(true);
  });

  it("terminado sin trabajado es un error", () => {
    expect(leerItemsSesion([], [A], permitidos).ok).toBe(false);
  });

  it("rechaza ítems ajenos o ids inválidos", () => {
    expect(leerItemsSesion(["33333333-3333-4333-8333-333333333333"], [], permitidos).ok).toBe(false);
    expect(leerItemsSesion(["x"], [], permitidos).ok).toBe(false);
  });
});
