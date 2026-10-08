// Validación de la filiación del paciente. Corre en el servidor (acciones) y en
// el formulario; la base vuelve a validar formato, unicidad y apoderado.
import { diasEntre } from "@/lib/fechas";

export type TipoDocumento = "dni" | "ce" | "pasaporte";
export type Sexo = "femenino" | "masculino";

export const TIPOS_DOCUMENTO: Record<TipoDocumento, string> = {
  dni: "DNI",
  ce: "Carné de extranjería",
  pasaporte: "Pasaporte",
};
export const SEXOS: Record<Sexo, string> = { femenino: "Femenino", masculino: "Masculino" };

/** Lo que llega del formulario: todo texto, todo opcional. */
export type EntradaPaciente = Partial<Record<CampoPaciente, string>>;

export type CampoPaciente =
  | "tipo_documento" | "numero_documento" | "nombres" | "apellidos" | "fecha_nacimiento" | "sexo"
  | "telefono" | "ocupacion" | "direccion"
  | "contacto_emergencia_nombre" | "contacto_emergencia_telefono" | "contacto_emergencia_parentesco"
  | "apoderado_nombre" | "apoderado_dni" | "apoderado_telefono" | "apoderado_parentesco";

/** Fila lista para insertar o actualizar en `paciente`. */
export type PacienteValidado = {
  tipo_documento: TipoDocumento;
  numero_documento: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string;
  sexo: Sexo;
  telefono: string | null;
  ocupacion: string | null;
  direccion: string | null;
  contacto_emergencia_nombre: string | null;
  contacto_emergencia_telefono: string | null;
  contacto_emergencia_parentesco: string | null;
  apoderado_nombre: string | null;
  apoderado_dni: string | null;
  apoderado_telefono: string | null;
  apoderado_parentesco: string | null;
};

export type Errores = Partial<Record<CampoPaciente, string>>;
export type ResultadoValidacion = { ok: true; datos: PacienteValidado } | { ok: false; errores: Errores };

const FORMATO_DOCUMENTO: Record<TipoDocumento, { patron: RegExp; mensaje: string }> = {
  dni: { patron: /^\d{8}$/, mensaje: "El DNI debe tener 8 dígitos." },
  ce: { patron: /^[A-Z0-9]{9,12}$/, mensaje: "El carné de extranjería debe tener de 9 a 12 letras o números." },
  pasaporte: { patron: /^[A-Z0-9]{6,12}$/, mensaje: "El pasaporte debe tener de 6 a 12 letras o números." },
};

/** Quita espacios y guiones y pasa a mayúsculas: " 00123-456a " -> "00123456A". */
export function normalizarDocumento(numero: string): string {
  return numero.replace(/[\s-]/g, "").toUpperCase();
}

export function errorDocumento(tipo: TipoDocumento, numero: string): string | null {
  const regla = FORMATO_DOCUMENTO[tipo];
  return regla.patron.test(numero) ? null : regla.mensaje;
}

/**
 * Celular peruano en formato para WhatsApp (51 + 9 dígitos que empiezan con 9).
 * Acepta "987654321", "987 654 321", "+51 987-654-321" o "51987654321".
 * Devuelve null si no es un celular válido.
 */
export function normalizarCelular(texto: string): string | null {
  const digitos = texto.replace(/\D/g, "");
  const nacional = digitos.length === 11 && digitos.startsWith("51") ? digitos.slice(2) : digitos;
  return /^9\d{8}$/.test(nacional) ? `51${nacional}` : null;
}

/** Menor de edad a la fecha `hoy` (ambas YYYY-MM-DD). */
export function esMenorDeEdad(fechaNacimiento: string, hoy: string): boolean {
  const [a, m, d] = hoy.split("-").map(Number) as [number, number, number];
  const mayoria = `${String(a - 18).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return fechaNacimiento > mayoria;
}

function texto(valor: string | undefined, max = 120): string | null {
  const limpio = (valor ?? "").replace(/\s+/g, " ").trim();
  return limpio ? limpio.slice(0, max) : null;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function fechaValida(fecha: string): boolean {
  if (!FECHA.test(fecha)) return false;
  const d = new Date(`${fecha}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
}

/** Valida y normaliza la filiación. `hoy` es la fecha de Lima (YYYY-MM-DD). */
export function validarPaciente(entrada: EntradaPaciente, hoy: string): ResultadoValidacion {
  const errores: Errores = {};

  const tipo = entrada.tipo_documento as TipoDocumento;
  if (!Object.hasOwn(TIPOS_DOCUMENTO, tipo ?? "")) errores.tipo_documento = "Elige el tipo de documento.";
  const numero = normalizarDocumento(entrada.numero_documento ?? "");
  if (!numero) errores.numero_documento = "Ingresa el número de documento.";
  else if (!errores.tipo_documento) {
    const e = errorDocumento(tipo, numero);
    if (e) errores.numero_documento = e;
  }

  const nombres = texto(entrada.nombres, 80);
  const apellidos = texto(entrada.apellidos, 80);
  if (!nombres) errores.nombres = "Ingresa los nombres.";
  if (!apellidos) errores.apellidos = "Ingresa los apellidos.";

  const fecha = (entrada.fecha_nacimiento ?? "").trim();
  if (!fecha) errores.fecha_nacimiento = "Ingresa la fecha de nacimiento.";
  else if (!fechaValida(fecha)) errores.fecha_nacimiento = "La fecha de nacimiento no es válida.";
  else if (fecha > hoy) errores.fecha_nacimiento = "La fecha de nacimiento no puede ser futura.";
  else if (diasEntre(fecha, hoy) > 120 * 366) errores.fecha_nacimiento = "Revisa la fecha de nacimiento (más de 120 años).";

  const sexo = entrada.sexo as Sexo;
  if (!Object.hasOwn(SEXOS, sexo ?? "")) errores.sexo = "Elige el sexo.";

  const menor = !errores.fecha_nacimiento && esMenorDeEdad(fecha, hoy);

  let telefono: string | null = null;
  if (texto(entrada.telefono)) {
    telefono = normalizarCelular(entrada.telefono ?? "");
    if (!telefono) errores.telefono = "Ingresa un celular de 9 dígitos que empiece con 9.";
  } else if (!menor) {
    errores.telefono = "Ingresa un celular para poder contactar al paciente.";
  }

  const emergenciaNombre = texto(entrada.contacto_emergencia_nombre, 80);
  let emergenciaTelefono: string | null = null;
  if (texto(entrada.contacto_emergencia_telefono)) {
    emergenciaTelefono = normalizarCelular(entrada.contacto_emergencia_telefono ?? "");
    if (!emergenciaTelefono) errores.contacto_emergencia_telefono = "Ingresa un celular de 9 dígitos que empiece con 9.";
  }
  if (emergenciaNombre && !texto(entrada.contacto_emergencia_telefono)) {
    errores.contacto_emergencia_telefono = "Ingresa el celular del contacto de emergencia.";
  }
  if (!emergenciaNombre && emergenciaTelefono) {
    errores.contacto_emergencia_nombre = "Ingresa el nombre del contacto de emergencia.";
  }

  let apoderadoNombre: string | null = null;
  let apoderadoDni: string | null = null;
  let apoderadoTelefono: string | null = null;
  let apoderadoParentesco: string | null = null;
  if (menor) {
    apoderadoNombre = texto(entrada.apoderado_nombre, 120);
    if (!apoderadoNombre) errores.apoderado_nombre = "Es menor de edad: ingresa el nombre del apoderado.";
    apoderadoDni = normalizarDocumento(entrada.apoderado_dni ?? "") || null;
    if (!apoderadoDni) errores.apoderado_dni = "Ingresa el DNI del apoderado.";
    else if (errorDocumento("dni", apoderadoDni)) errores.apoderado_dni = "El DNI del apoderado debe tener 8 dígitos.";
    apoderadoTelefono = normalizarCelular(entrada.apoderado_telefono ?? "");
    if (!apoderadoTelefono) errores.apoderado_telefono = "Ingresa el celular del apoderado (9 dígitos, empieza con 9).";
    apoderadoParentesco = texto(entrada.apoderado_parentesco, 40);
    if (!apoderadoParentesco) errores.apoderado_parentesco = "Indica el parentesco del apoderado.";
  }

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return {
    ok: true,
    datos: {
      tipo_documento: tipo,
      numero_documento: numero,
      nombres: nombres ?? "",
      apellidos: apellidos ?? "",
      fecha_nacimiento: fecha,
      sexo,
      telefono,
      ocupacion: texto(entrada.ocupacion, 80),
      direccion: texto(entrada.direccion, 200),
      contacto_emergencia_nombre: emergenciaNombre,
      contacto_emergencia_telefono: emergenciaTelefono,
      contacto_emergencia_parentesco: emergenciaNombre ? texto(entrada.contacto_emergencia_parentesco, 40) : null,
      apoderado_nombre: apoderadoNombre,
      apoderado_dni: apoderadoDni,
      apoderado_telefono: apoderadoTelefono,
      apoderado_parentesco: apoderadoParentesco,
    },
  };
}
