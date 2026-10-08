// Validación de un procedimiento del catálogo. Corre en el servidor; la base vuelve
// a validar formato, rangos y unicidad de código y nombre.
import { aCentimos } from "@/lib/dinero";

export type Especialidad =
  | "general" | "preventiva" | "operatoria" | "endodoncia" | "periodoncia" | "cirugia"
  | "ortodoncia" | "implantes" | "rehabilitacion" | "odontopediatria" | "estetica";

export const ESPECIALIDADES: Record<Especialidad, string> = {
  general: "General y diagnóstico",
  preventiva: "Preventiva",
  operatoria: "Operatoria",
  endodoncia: "Endodoncia",
  periodoncia: "Periodoncia",
  cirugia: "Cirugía",
  ortodoncia: "Ortodoncia",
  implantes: "Implantes",
  rehabilitacion: "Rehabilitación oral",
  odontopediatria: "Odontopediatría",
  estetica: "Estética",
};

export type CampoProcedimiento =
  | "codigo" | "nombre" | "especialidad" | "precio" | "duracion_minutos" | "requiere_consentimiento"
  | "control_dias" | "activo";

export type EntradaProcedimiento = Partial<Record<CampoProcedimiento, string>>;

export type ProcedimientoValidado = {
  codigo: string;
  nombre: string;
  especialidad: Especialidad;
  precio_base_centimos: number;
  duracion_minutos: number;
  requiere_consentimiento: boolean;
  control_dias: number | null;
  activo: boolean;
};

export type ResultadoProcedimiento =
  | { ok: true; datos: ProcedimientoValidado }
  | { ok: false; errores: Partial<Record<CampoProcedimiento, string>> };

const PRECIO_MAXIMO = 10_000_000;   // S/ 100,000.00

function esEspecialidad(valor: string): valor is Especialidad {
  return Object.hasOwn(ESPECIALIDADES, valor);
}

function entero(texto: string): number | null {
  return /^\d{1,4}$/.test(texto) ? Number(texto) : null;
}

export function validarProcedimiento(entrada: EntradaProcedimiento): ResultadoProcedimiento {
  const e: Partial<Record<CampoProcedimiento, string>> = {};
  const t = (c: CampoProcedimiento) => (entrada[c] ?? "").trim();

  const codigo = t("codigo").toUpperCase().replace(/\s+/g, "");
  if (!codigo) e.codigo = "Ingresa el código.";
  else if (!/^[A-Z0-9][A-Z0-9-]{1,14}$/.test(codigo)) e.codigo = "De 2 a 15 letras, números o guiones (p. ej. END-01).";

  const nombre = t("nombre").replace(/\s+/g, " ");
  if (nombre.length < 3) e.nombre = "Ingresa el nombre del procedimiento.";
  else if (nombre.length > 120) e.nombre = "Máximo 120 caracteres.";

  const especialidad = t("especialidad");
  if (!esEspecialidad(especialidad)) e.especialidad = "Elige la especialidad.";

  let precio = 0;
  const precioTexto = t("precio");
  if (!precioTexto) e.precio = "Ingresa el precio base (0 si no se cobra).";
  else {
    try {
      precio = aCentimos(precioTexto);
      if (precio < 0) e.precio = "El precio no puede ser negativo.";
      else if (precio > PRECIO_MAXIMO) e.precio = "El precio máximo es S/ 100,000.00.";
    } catch {
      e.precio = "Escribe el precio en soles, p. ej. 180 o 180.50.";
    }
  }

  const duracion = entero(t("duracion_minutos"));
  if (duracion === null || duracion < 5 || duracion > 480 || duracion % 5 !== 0) {
    e.duracion_minutos = "Entre 5 y 480 minutos, en múltiplos de 5.";
  }

  const controlTexto = t("control_dias");
  const control = controlTexto ? entero(controlTexto) : null;
  if (controlTexto && (control === null || control < 1 || control > 730)) {
    e.control_dias = "Entre 1 y 730 días, o vacío si no genera control.";
  }

  if (Object.keys(e).length > 0 || !esEspecialidad(especialidad) || duracion === null) return { ok: false, errores: e };
  return {
    ok: true,
    datos: {
      codigo, nombre, especialidad, precio_base_centimos: precio, duracion_minutos: duracion,
      requiere_consentimiento: t("requiere_consentimiento") === "1",
      control_dias: control,
      activo: t("activo") !== "0",
    },
  };
}

/** 90 -> "1 h 30 min"; 45 -> "45 min" */
export function formatearDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
