// Registros por especialidad (Etapa 9): validación en el servidor y textos. La base vuelve
// a validar (evolución en borrador del autor, ítem trabajado de la especialidad, rangos).
// El sistema no sugiere valores clínicos (regla 11): solo registra lo que se escribe.

export type TipoRegistro =
  | "endodoncia" | "ortodoncia_caso" | "ortodoncia_control" | "implante" | "implante_fase" | "cirugia" | "odontopediatria";

/** Tabla de cada tipo de registro. */
export const TABLA_REGISTRO: Record<TipoRegistro, string> = {
  endodoncia: "endodoncia_conducto",
  ortodoncia_caso: "ortodoncia_caso",
  ortodoncia_control: "ortodoncia_control",
  implante: "implante",
  implante_fase: "implante_fase",
  cirugia: "cirugia_registro",
  odontopediatria: "odontopediatria_registro",
};

export const TIPOS_REGISTRO = Object.keys(TABLA_REGISTRO) as TipoRegistro[];

/** Registros que se ofrecen para un ítem trabajado, según la especialidad del procedimiento. */
export const REGISTROS_POR_ESPECIALIDAD: Partial<Record<string, TipoRegistro[]>> = {
  endodoncia: ["endodoncia"],
  ortodoncia: ["ortodoncia_caso", "ortodoncia_control"],
  implantes: ["implante"],
  cirugia: ["cirugia"],
};

export const FASES_IMPLANTE = {
  colocacion: "Colocación (cirugía)",
  oseointegracion: "Oseointegración",
  segunda_fase: "Segunda fase (descubrimiento)",
  protesica: "Fase protésica",
  carga: "En carga",
} as const;
export type FaseImplante = keyof typeof FASES_IMPLANTE;

/** Escala de conducta de Frankl. */
export const FRANKL: Record<number, string> = {
  1: "1 · Definitivamente negativa",
  2: "2 · Negativa",
  3: "3 · Positiva",
  4: "4 · Definitivamente positiva",
};

type Leer = (campo: string) => string;
export type Resultado = { ok: true; datos: Record<string, string | number | boolean | null> } | { ok: false; error: string };

const texto = (v: string, max: number, etiqueta: string, min = 0): string | null | { error: string } => {
  const t = v.trim();
  if (t.length === 0) return min > 0 ? { error: `Escribe ${etiqueta}.` } : null;
  if (t.length < min) return { error: `${etiqueta[0]?.toUpperCase()}${etiqueta.slice(1)}: al menos ${min} caracteres.` };
  if (t.length > max) return { error: `${etiqueta[0]?.toUpperCase()}${etiqueta.slice(1)}: máximo ${max} caracteres.` };
  return t;
};

/** Número con un decimal como máximo (coma o punto), dentro de un rango. */
function decimal(v: string, min: number, max: number, etiqueta: string, obligatorio: boolean): number | null | { error: string } {
  const t = v.trim().replace(",", ".");
  if (!t) return obligatorio ? { error: `Indica ${etiqueta}.` } : null;
  if (!/^\d{1,2}(\.\d)?$/.test(t)) return { error: `${etiqueta[0]?.toUpperCase()}${etiqueta.slice(1)}: un número con hasta un decimal.` };
  const n = Number(t);
  if (n < min || n > max) return { error: `${etiqueta[0]?.toUpperCase()}${etiqueta.slice(1)}: entre ${min} y ${max}.` };
  return n;
}

function entero(v: string, min: number, max: number, etiqueta: string): number | null | { error: string } {
  const t = v.trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return { error: `${etiqueta[0]?.toUpperCase()}${etiqueta.slice(1)}: un número entero.` };
  const n = Number(t);
  if (n < min || n > max) return { error: `${etiqueta[0]?.toUpperCase()}${etiqueta.slice(1)}: entre ${min} y ${max}.` };
  return n;
}

const esError = (x: unknown): x is { error: string } => typeof x === "object" && x !== null && "error" in x;

/** Valida los campos de un registro; devuelve las columnas listas para insertar. */
export function validarRegistro(tipo: TipoRegistro, leer: Leer): Resultado {
  const campos: Record<string, string | number | boolean | null | { error: string }> = {};
  switch (tipo) {
    case "endodoncia":
      campos.conducto = texto(leer("conducto"), 30, "el conducto", 1);
      campos.longitud_trabajo_mm = decimal(leer("longitud_trabajo_mm"), 5, 40, "la longitud de trabajo (mm)", false);
      campos.referencia = texto(leer("referencia"), 60, "la referencia");
      campos.lima_maestra = texto(leer("lima_maestra"), 40, "la lima maestra");
      campos.irrigacion = texto(leer("irrigacion"), 200, "la irrigación");
      campos.tecnica_obturacion = texto(leer("tecnica_obturacion"), 120, "la técnica de obturación");
      campos.observaciones = texto(leer("observaciones"), 500, "las observaciones");
      break;
    case "ortodoncia_caso":
      campos.diagnostico = texto(leer("diagnostico"), 2000, "el diagnóstico ortodóncico", 3);
      campos.aparatologia = texto(leer("aparatologia"), 1000, "la aparatología", 3);
      break;
    case "ortodoncia_control":
      campos.arco_superior = texto(leer("arco_superior"), 100, "el arco superior");
      campos.arco_inferior = texto(leer("arco_inferior"), 100, "el arco inferior");
      campos.ligaduras = texto(leer("ligaduras"), 100, "las ligaduras");
      campos.activaciones = texto(leer("activaciones"), 300, "las activaciones");
      campos.observaciones = texto(leer("observaciones"), 1000, "las observaciones");
      break;
    case "implante":
      campos.marca = texto(leer("marca"), 80, "la marca", 2);
      campos.diametro_mm = decimal(leer("diametro_mm"), 2, 8, "el diámetro (mm)", true);
      campos.longitud_mm = decimal(leer("longitud_mm"), 4, 25, "la longitud (mm)", true);
      campos.lote = texto(leer("lote"), 60, "el lote");
      campos.torque_ncm = entero(leer("torque_ncm"), 0, 100, "el torque (Ncm)");
      campos.observaciones = texto(leer("observaciones"), 500, "las observaciones");
      break;
    case "implante_fase": {
      const fase = leer("fase");
      if (!Object.hasOwn(FASES_IMPLANTE, fase) || fase === "colocacion") return { ok: false, error: "Elige la fase." };
      campos.fase = fase;
      const fecha = leer("fecha").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha))) return { ok: false, error: "Indica la fecha de la fase." };
      campos.fecha = fecha;
      campos.observaciones = texto(leer("observaciones"), 500, "las observaciones");
      break;
    }
    case "cirugia":
      campos.tecnica = texto(leer("tecnica"), 500, "la técnica", 3);
      campos.sutura = texto(leer("sutura"), 200, "la sutura");
      campos.retiro_puntos_dias = entero(leer("retiro_puntos_dias"), 3, 30, "los días para el retiro de puntos");
      campos.observaciones = texto(leer("observaciones"), 500, "las observaciones");
      if (campos.retiro_puntos_dias !== null && !esError(campos.retiro_puntos_dias) && campos.sutura === null) {
        return { ok: false, error: "Indica la sutura para programar el retiro de puntos." };
      }
      break;
    case "odontopediatria": {
      const presente = leer("apoderado_presente");
      if (presente !== "si" && presente !== "no") return { ok: false, error: "Indica si el apoderado estuvo presente." };
      campos.apoderado_presente = presente === "si";
      campos.acompanante = texto(leer("acompanante"), 120, "el acompañante");
      campos.conducta_frankl = entero(leer("conducta_frankl"), 1, 4, "la conducta (Frankl)");
      campos.conducta = texto(leer("conducta"), 500, "la conducta");
      if (campos.conducta_frankl === null && campos.conducta === null) return { ok: false, error: "Registra la conducta del paciente." };
      break;
    }
  }
  for (const v of Object.values(campos)) if (esError(v)) return { ok: false, error: v.error };
  if (tipo === "endodoncia" && ["longitud_trabajo_mm", "lima_maestra", "irrigacion", "tecnica_obturacion", "observaciones"]
    .every((c) => campos[c] === null)) {
    return { ok: false, error: "Registra al menos un dato del conducto (longitud, lima, irrigación u obturación)." };
  }
  if (tipo === "ortodoncia_control" && Object.values(campos).every((v) => v === null)) {
    return { ok: false, error: "Registra al menos un dato del control." };
  }
  return { ok: true, datos: campos as Record<string, string | number | boolean | null> };
}
