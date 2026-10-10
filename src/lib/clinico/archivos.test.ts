import { describe, expect, it } from "vitest";
import { revisarArchivo, rutaArchivo, validarArchivo } from "./archivos";

const C = "aaaaaaaa-0000-4000-8000-000000000001";
const P = "bbbbbbbb-0000-4000-8000-000000000002";
const ID = "cccccccc-0000-4000-8000-000000000003";
const ctx = { clinicaId: C, pacienteId: P, hoy: "2026-10-09" };
const base: Record<string, string> = {
  tipo: "radiografia", mime: "image/jpeg", bytes: "120000", ruta: rutaArchivo(C, P, ID, "image/jpeg"),
  tomada_el: "2026-10-09", pieza: "", nota_id: "", descripcion: "", nombre: "rx.jpg",
};
const con = (cambios: Record<string, string>) => (c: string) => ({ ...base, ...cambios })[c] ?? "";

describe("revisarArchivo", () => {
  it("acepta imágenes y PDF de hasta 10 MB", () => {
    expect(revisarArchivo({ type: "image/png", size: 1000 })).toBeNull();
    expect(revisarArchivo({ type: "application/pdf", size: 10 * 1024 * 1024 })).toBeNull();
  });
  it("rechaza otros formatos, vacíos y pesados", () => {
    expect(revisarArchivo({ type: "image/gif", size: 1000 })).toMatch(/Formato/);
    expect(revisarArchivo({ type: "image/png", size: 0 })).toMatch(/vacío/);
    expect(revisarArchivo({ type: "image/png", size: 10 * 1024 * 1024 + 1 })).toMatch(/10 MB/);
  });
});

describe("validarArchivo", () => {
  it("valida un archivo completo", () => {
    const r = validarArchivo(con({ pieza: "36", descripcion: "  Periapical  de control " }), ctx);
    expect(r).toEqual({ ok: true, datos: expect.objectContaining({ pieza: 36, descripcion: "Periapical de control", nombre: "rx.jpg" }) });
  });
  it("la ruta debe ser de esta clínica y paciente, con la extensión del formato", () => {
    expect(validarArchivo(con({ ruta: rutaArchivo(C, "dddddddd-0000-4000-8000-000000000004", ID, "image/jpeg") }), ctx).ok).toBe(false);
    expect(validarArchivo(con({ mime: "image/png" }), ctx).ok).toBe(false);
    expect(validarArchivo(con({ bytes: "0" }), ctx).ok).toBe(false);
  });
  it("fecha no futura, pieza FDI y tipo de la lista", () => {
    const r = validarArchivo(con({ tomada_el: "2026-10-10", pieza: "19", tipo: "consentimiento" }), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errores.tomada_el).toMatch(/futura/);
      expect(r.errores.pieza).toBeDefined();
      expect(r.errores.tipo).toBeDefined();
    }
    expect(validarArchivo(con({ pieza: "75" }), ctx).ok).toBe(true);
  });
});
