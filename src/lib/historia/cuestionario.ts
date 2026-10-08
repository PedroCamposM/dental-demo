// Historia clínica: opciones, validación del cuestionario y de los signos vitales,
// y el texto de las alertas. Corre en el servidor; la base vuelve a validar.
// Las alertas solo describen lo registrado: nunca recomiendan nada.

export const ENFERMEDADES = {
  hipertension: "Hipertensión arterial",
  diabetes: "Diabetes",
  cardiopatia: "Cardiopatía",
  asma: "Asma",
  epilepsia: "Epilepsia",
  hepatitis: "Hepatitis",
  vih: "VIH",
  coagulacion: "Trastorno de la coagulación",
  renal: "Enfermedad renal",
  tiroides: "Enfermedad tiroidea",
  cancer: "Cáncer",
  osteoporosis: "Osteoporosis",
} as const;
export type Enfermedad = keyof typeof ENFERMEDADES;

export const HABITOS = {
  tabaco: "Tabaco",
  alcohol: "Alcohol",
  bruxismo: "Bruxismo",
  onicofagia: "Onicofagia (morderse las uñas)",
  succion_digital: "Succión digital",
  respiracion_bucal: "Respiración bucal",
  morder_objetos: "Morder objetos",
} as const;
export type Habito = keyof typeof HABITOS;

export const EMBARAZO = { no: "No", si: "Sí", no_sabe: "No sabe", no_aplica: "No aplica" } as const;
export type Embarazo = keyof typeof EMBARAZO;

export type CuestionarioValidado = {
  motivo_consulta: string;
  enfermedad_actual: string | null;
  enfermedades: Enfermedad[];
  enfermedades_otras: string | null;
  cirugias: string | null;
  hospitalizaciones: string | null;
  medicacion: string | null;
  anticoagulado: boolean;
  anticoagulante: string | null;
  alergias: string[];
  embarazo: Embarazo;
  semanas_gestacion: number | null;
  lactancia: boolean;
  habitos: Habito[];
  habitos_otros: string | null;
  antecedentes_odontologicos: string | null;
  observaciones: string | null;
};
export type CampoCuestionario = keyof CuestionarioValidado;

/** Lo que llega del formulario: textos y listas (casillas múltiples). */
export type EntradaCuestionario = {
  texto: (campo: string) => string;
  lista: (campo: string) => string[];
};

const LIMITES: Partial<Record<CampoCuestionario, number>> = {
  motivo_consulta: 500, enfermedad_actual: 2000, enfermedades_otras: 500, cirugias: 1000, hospitalizaciones: 1000,
  medicacion: 1000, anticoagulante: 200, habitos_otros: 500, antecedentes_odontologicos: 2000, observaciones: 2000,
};

/** Alergias escritas en líneas o separadas por comas: sin vacíos ni repetidas. */
export function leerAlergias(texto: string): string[] {
  const vistas = new Set<string>();
  const salida: string[] = [];
  for (const parte of texto.split(/[\n,;]+/)) {
    const a = parte.trim().replace(/\s+/g, " ");
    if (a.length < 2 || vistas.has(a.toLowerCase())) continue;
    vistas.add(a.toLowerCase());
    salida.push(a);
  }
  return salida;
}

/**
 * Valida el cuestionario. `puedeGestar` viene del paciente (mujer de 12 años o más):
 * si no, el embarazo queda «no aplica» aunque llegue otra cosa.
 */
export function validarCuestionario(e: EntradaCuestionario, puedeGestar: boolean):
  { ok: true; datos: CuestionarioValidado } | { ok: false; errores: Partial<Record<CampoCuestionario, string>> } {
  const errores: Partial<Record<CampoCuestionario, string>> = {};
  const opcional = (campo: CampoCuestionario): string | null => {
    const v = e.texto(campo).trim();
    const max = LIMITES[campo];
    if (max && v.length > max) errores[campo] = `Máximo ${max} caracteres.`;
    return v || null;
  };

  const motivo = e.texto("motivo_consulta").trim();
  if (motivo.length < 3) errores.motivo_consulta = "Escribe el motivo de consulta.";
  else if (motivo.length > 500) errores.motivo_consulta = "Máximo 500 caracteres.";

  const enfermedades = e.lista("enfermedades").filter((x): x is Enfermedad => Object.hasOwn(ENFERMEDADES, x));
  const habitos = e.lista("habitos").filter((x): x is Habito => Object.hasOwn(HABITOS, x));
  const anticoagulado = e.texto("anticoagulado") === "1";
  const anticoagulante = opcional("anticoagulante");
  if (anticoagulado && !anticoagulante) errores.anticoagulante = "Indica qué anticoagulante toma.";
  const alergias = leerAlergias(e.texto("alergias"));
  if (alergias.length > 15) errores.alergias = "Máximo 15 alergias.";
  if (alergias.some((a) => a.length > 80)) errores.alergias = "Cada alergia, máximo 80 caracteres.";

  let embarazo: Embarazo = "no_aplica";
  let semanas: number | null = null;
  if (puedeGestar) {
    const v = e.texto("embarazo");
    embarazo = Object.hasOwn(EMBARAZO, v) ? (v as Embarazo) : "no";
    if (embarazo === "si") {
      const s = e.texto("semanas_gestacion").trim();
      if (s) {
        semanas = /^\d{1,2}$/.test(s) ? Number(s) : NaN;
        if (!(semanas >= 1 && semanas <= 42)) errores.semanas_gestacion = "Entre 1 y 42 semanas.";
      }
    }
  }

  const datos: CuestionarioValidado = {
    motivo_consulta: motivo,
    enfermedad_actual: opcional("enfermedad_actual"),
    enfermedades,
    enfermedades_otras: opcional("enfermedades_otras"),
    cirugias: opcional("cirugias"),
    hospitalizaciones: opcional("hospitalizaciones"),
    medicacion: opcional("medicacion"),
    anticoagulado,
    anticoagulante: anticoagulado ? anticoagulante : null,
    alergias,
    embarazo,
    semanas_gestacion: Number.isNaN(semanas) ? null : semanas,
    lactancia: puedeGestar && e.texto("lactancia") === "1",
    habitos,
    habitos_otros: opcional("habitos_otros"),
    antecedentes_odontologicos: opcional("antecedentes_odontologicos"),
    observaciones: opcional("observaciones"),
  };
  return Object.keys(errores).length > 0 ? { ok: false, errores } : { ok: true, datos };
}

// ---------------------------------------------------------------------------
// Signos vitales
// ---------------------------------------------------------------------------
export type SignosValidados = {
  presion_sistolica: number | null; presion_diastolica: number | null; frecuencia_cardiaca: number | null;
  frecuencia_respiratoria: number | null; temperatura_c: number | null; peso_kg: number | null; talla_cm: number | null;
};
export type CampoSignos = keyof SignosValidados;

const RANGOS: Record<CampoSignos, [number, number, number, string]> = {
  // mínimo, máximo, decimales, unidad
  presion_sistolica: [50, 260, 0, "mmHg"],
  presion_diastolica: [30, 160, 0, "mmHg"],
  frecuencia_cardiaca: [30, 220, 0, "lpm"],
  frecuencia_respiratoria: [6, 60, 0, "rpm"],
  temperatura_c: [34, 42, 1, "°C"],
  peso_kg: [1, 300, 2, "kg"],
  talla_cm: [30, 230, 1, "cm"],
};

export function validarSignos(texto: (campo: string) => string):
  { ok: true; datos: SignosValidados } | { ok: false; errores: Partial<Record<CampoSignos | "general", string>> } {
  const errores: Partial<Record<CampoSignos | "general", string>> = {};
  const datos = {} as SignosValidados;
  for (const [campo, [min, max, decimales, unidad]] of Object.entries(RANGOS) as [CampoSignos, [number, number, number, string]][]) {
    const v = texto(campo).trim().replace(",", ".");
    if (!v) { datos[campo] = null; continue; }
    const patron = decimales === 0 ? /^\d{1,3}$/ : new RegExp(`^\\d{1,3}(\\.\\d{1,${decimales}})?$`);
    const n = Number(v);
    if (!patron.test(v) || n < min || n > max) {
      errores[campo] = `Entre ${min} y ${max} ${unidad}${decimales ? "" : ", sin decimales"}.`;
      datos[campo] = null;
    } else datos[campo] = n;
  }
  if ((datos.presion_sistolica === null) !== (datos.presion_diastolica === null) && !errores.presion_sistolica && !errores.presion_diastolica) {
    errores.presion_sistolica = "Registra la presión completa (sistólica y diastólica).";
  } else if (datos.presion_sistolica !== null && datos.presion_diastolica !== null && datos.presion_sistolica <= datos.presion_diastolica) {
    errores.presion_sistolica = "La sistólica debe ser mayor que la diastólica.";
  }
  if (Object.keys(errores).length === 0 && Object.values(datos).every((v) => v === null)) {
    errores.general = "Registra al menos un signo vital.";
  }
  return Object.keys(errores).length > 0 ? { ok: false, errores } : { ok: true, datos };
}

/** Índice de masa corporal (solo el cálculo; no se interpreta). */
export function imc(pesoKg: number | null, tallaCm: number | null): number | null {
  if (!pesoKg || !tallaCm) return null;
  return Math.round((pesoKg / (tallaCm / 100) ** 2) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Alertas: solo lo registrado
// ---------------------------------------------------------------------------
export type Alertas = {
  alergias: string[]; anticoagulante: string | null; enfermedades: string[]; embarazo: boolean;
  semanas_gestacion: number | null;
};

/** Frases cortas para el banner y la agenda, en orden fijo. */
export function describirAlertas(a: Alertas): string[] {
  const frases: string[] = [];
  if (a.alergias.length > 0) frases.push(`Alergia: ${a.alergias.join(", ")}`);
  if (a.anticoagulante) frases.push(`Anticoagulado: ${a.anticoagulante}`);
  const enfermedades = a.enfermedades.map((x) => ENFERMEDADES[x as Enfermedad] ?? x);
  if (enfermedades.length > 0) frases.push(enfermedades.join(", "));
  if (a.embarazo) frases.push(a.semanas_gestacion ? `Embarazo (${a.semanas_gestacion} semanas)` : "Embarazo");
  return frases;
}
