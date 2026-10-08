import { describe, expect, it } from "vitest";
import {
  errorDocumento,
  esMenorDeEdad,
  normalizarCelular,
  normalizarDocumento,
  validarPaciente,
  type EntradaPaciente,
} from "./validacion";

const HOY = "2026-10-08";

const ADULTO: EntradaPaciente = {
  tipo_documento: "dni",
  numero_documento: "45612378",
  nombres: "  José   Luis ",
  apellidos: "Vásquez Rodríguez",
  fecha_nacimiento: "1990-05-10",
  sexo: "masculino",
  telefono: "987 654 321",
};

const MENOR: EntradaPaciente = {
  ...ADULTO,
  fecha_nacimiento: "2015-01-01",
  telefono: "",
  apoderado_nombre: "Rosa Vásquez",
  apoderado_dni: "10000001",
  apoderado_telefono: "+51 911 222 333",
  apoderado_parentesco: "madre",
};

describe("documento", () => {
  it("normaliza espacios, guiones y mayúsculas", () => {
    expect(normalizarDocumento(" 00123-456a ")).toBe("00123456A");
  });

  it("valida el formato según el tipo", () => {
    expect(errorDocumento("dni", "45612378")).toBeNull();
    expect(errorDocumento("dni", "4561237")).toMatch(/8 dígitos/);
    expect(errorDocumento("dni", "4561237A")).toMatch(/8 dígitos/);
    expect(errorDocumento("ce", "001234567")).toBeNull();
    expect(errorDocumento("ce", "12345678")).toMatch(/9 a 12/);
    expect(errorDocumento("pasaporte", "AB1234")).toBeNull();
    expect(errorDocumento("pasaporte", "AB123")).toMatch(/6 a 12/);
    expect(errorDocumento("pasaporte", "A".repeat(13))).toMatch(/6 a 12/);
  });
});

describe("celular", () => {
  it("acepta formatos comunes y devuelve 51 + 9 dígitos", () => {
    expect(normalizarCelular("987654321")).toBe("51987654321");
    expect(normalizarCelular("987 654 321")).toBe("51987654321");
    expect(normalizarCelular("+51 987-654-321")).toBe("51987654321");
    expect(normalizarCelular("51987654321")).toBe("51987654321");
  });

  it("rechaza fijos, números cortos y texto", () => {
    expect(normalizarCelular("044 123456")).toBeNull();
    expect(normalizarCelular("98765432")).toBeNull();
    expect(normalizarCelular("abc")).toBeNull();
    expect(normalizarCelular("51 887654321")).toBeNull();
  });
});

describe("mayoría de edad (fecha de Lima)", () => {
  it("cumple 18 el mismo día", () => {
    expect(esMenorDeEdad("2008-10-08", HOY)).toBe(false);
    expect(esMenorDeEdad("2008-10-09", HOY)).toBe(true);
  });
});

describe("validarPaciente", () => {
  it("normaliza un adulto válido", () => {
    const r = validarPaciente(ADULTO, HOY);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.datos).toMatchObject({
        numero_documento: "45612378", nombres: "José Luis", telefono: "51987654321",
        apoderado_nombre: null, ocupacion: null,
      });
    }
  });

  it("exige los campos obligatorios con mensajes en español", () => {
    const r = validarPaciente({}, HOY);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errores).sort()).toEqual(
        ["apellidos", "fecha_nacimiento", "nombres", "numero_documento", "sexo", "telefono", "tipo_documento"].sort(),
      );
    }
  });

  it("rechaza fechas futuras, imposibles o de más de 120 años", () => {
    for (const fecha of ["2026-10-09", "2026-02-30", "1900-01-01", "10/05/1990"]) {
      const r = validarPaciente({ ...ADULTO, fecha_nacimiento: fecha }, HOY);
      expect(r.ok, fecha).toBe(false);
      if (!r.ok) expect(r.errores.fecha_nacimiento, fecha).toBeDefined();
    }
  });

  it("menor de edad: exige apoderado completo y no exige celular propio", () => {
    expect(validarPaciente(MENOR, HOY).ok).toBe(true);
    const sinApoderado = validarPaciente({ ...MENOR, apoderado_dni: "123", apoderado_parentesco: "" }, HOY);
    expect(sinApoderado.ok).toBe(false);
    if (!sinApoderado.ok) {
      expect(Object.keys(sinApoderado.errores).sort()).toEqual(["apoderado_dni", "apoderado_parentesco"]);
    }
  });

  it("adulto: descarta datos de apoderado que hayan quedado en el formulario", () => {
    const r = validarPaciente({ ...ADULTO, apoderado_nombre: "Alguien" }, HOY);
    expect(r.ok && r.datos.apoderado_nombre).toBe(null);
  });

  it("contacto de emergencia: nombre y celular van juntos", () => {
    const soloNombre = validarPaciente({ ...ADULTO, contacto_emergencia_nombre: "Ana" }, HOY);
    expect(!soloNombre.ok && soloNombre.errores.contacto_emergencia_telefono).toBeTruthy();
    const soloCelular = validarPaciente({ ...ADULTO, contacto_emergencia_telefono: "911222333" }, HOY);
    expect(!soloCelular.ok && soloCelular.errores.contacto_emergencia_nombre).toBeTruthy();
  });

  it("rechaza tipo de documento o sexo fuera de la lista", () => {
    const r = validarPaciente({ ...ADULTO, tipo_documento: "ruc", sexo: "x" }, HOY);
    expect(!r.ok && Object.keys(r.errores).sort()).toEqual(["sexo", "tipo_documento"]);
  });
});
