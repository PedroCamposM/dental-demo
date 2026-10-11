import { describe, expect, it } from "vitest";
import { validarAtencionRapida } from "./atencion-rapida";

const RESINA = "11111111-1111-4111-8111-111111111111";
const EXO = "22222222-2222-4222-8222-222222222222";
const contexto = {
  codigosCie10: new Set(["K02.1", "K04.0"]),
  procedimientos: [
    { id: RESINA, nombre: "Restauración con resina", requiere_consentimiento: false },
    { id: EXO, nombre: "Exodoncia simple", requiere_consentimiento: true },
  ],
};
const base = {
  motivo_consulta: "Dolor al frío", alergias_ninguna: "1", anticoagulado: "no", examen: "Caries oclusal en 36",
  cie10: "k021", procedimiento_0: RESINA, piezas_0: "36", descripcion: "Restauración oclusal con resina en 36",
};
const t = (v: Record<string, string>) => (c: string) => v[c] ?? "";

describe("validarAtencionRapida (mínimo de la NTS 139)", () => {
  it("arma los datos de la atención", () => {
    const r = validarAtencionRapida(t(base), contexto);
    expect(r).toMatchObject({
      ok: true,
      datos: {
        historia: { motivo_consulta: "Dolor al frío", alergias: [], alergias_preguntadas: true, anticoagulado: false, embarazo: "no_aplica" },
        diagnostico: { cie10: "K02.1", tipo: "definitivo", pieza: null },
        items: [{ procedimiento_id: RESINA, pieza: "36" }],
      },
    });
  });

  it("exige motivo, alergias preguntadas, anticoagulantes, examen, diagnóstico, procedimiento y descripción", () => {
    const r = validarAtencionRapida(t({}), contexto);
    expect(r.ok === false && Object.keys(r.errores).sort()).toEqual(
      ["alergias", "anticoagulado", "cie10", "descripcion", "examen", "motivo_consulta", "procedimientos"]);
  });

  it("alergias: escritas o «ninguna», no las dos", () => {
    const ambas = validarAtencionRapida(t({ ...base, alergias: "Penicilina" }), contexto);
    expect(ambas.ok === false && ambas.errores.alergias).toMatch(/deja una de las dos/);
    const escritas = validarAtencionRapida(t({ ...base, alergias_ninguna: "", alergias: "Penicilina, látex, Penicilina" }), contexto);
    expect(escritas.ok && escritas.datos.historia.alergias).toEqual(["Penicilina", "látex"]);
  });

  it("si toma anticoagulantes, pide cuál", () => {
    const r = validarAtencionRapida(t({ ...base, anticoagulado: "si" }), contexto);
    expect(r.ok === false && r.errores.anticoagulante).toBeDefined();
  });

  it("un procedimiento por pieza; los que requieren consentimiento van por el flujo completo", () => {
    const varias = validarAtencionRapida(t({ ...base, piezas_0: "16, 26" }), contexto);
    expect(varias.ok && varias.datos.items.map((i) => i.pieza)).toEqual(["16", "26"]);
    const exo = validarAtencionRapida(t({ ...base, procedimiento_1: EXO, piezas_1: "48" }), contexto);
    expect(exo.ok === false && exo.errores.procedimientos).toMatch(/requiere consentimiento/);
    const mala = validarAtencionRapida(t({ ...base, piezas_0: "36 99" }), contexto);
    expect(mala.ok === false && mala.errores.procedimientos).toMatch(/99/);
  });

  it("rechaza un CIE-10 que no está en el catálogo", () => {
    const r = validarAtencionRapida(t({ ...base, cie10: "Z99.9" }), contexto);
    expect(r.ok === false && r.errores.cie10).toBeDefined();
  });
});
