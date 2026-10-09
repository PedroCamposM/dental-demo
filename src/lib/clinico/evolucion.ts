// Evolución clínica por sesión: validación en el servidor del borrador y de la firma.
// La base vuelve a validar (checks, triggers, RLS). El sistema no sugiere anestesia,
// materiales ni indicaciones: los escribe el profesional (regla 11).

export const CAMPOS_EVOLUCION = {
  texto: { etiqueta: "Descripción de lo realizado", max: 4000 },
  anestesia_tipo: { etiqueta: "Anestesia (tipo)", max: 100 },
  anestesia_cantidad: { etiqueta: "Anestesia (cantidad)", max: 60 },
  materiales: { etiqueta: "Materiales", max: 1000 },
  incidencias: { etiqueta: "Incidencias", max: 1000 },
  indicaciones: { etiqueta: "Indicaciones al paciente", max: 2000 },
  proxima_cita: { etiqueta: "Próxima cita sugerida", max: 200 },
} as const;
export type CampoEvolucion = keyof typeof CAMPOS_EVOLUCION;
export const LISTA_CAMPOS_EVOLUCION = Object.keys(CAMPOS_EVOLUCION) as CampoEvolucion[];

export type EvolucionValidada = { texto: string } & Record<Exclude<CampoEvolucion, "texto">, string | null>;

/** Ítem del plan marcado en la sesión. Terminado implica trabajado. */
export type ItemSesion = { item_id: string; trabajado: boolean; terminado: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Borrador: todo puede quedar vacío. Al firmar, la descripción es obligatoria
 * (la evolución firmada ya no se edita) y la cantidad de anestesia exige su tipo.
 */
export function validarEvolucion(texto: (campo: CampoEvolucion) => string, firmar: boolean):
  { ok: true; datos: EvolucionValidada } | { ok: false; errores: Partial<Record<CampoEvolucion, string>> } {
  const errores: Partial<Record<CampoEvolucion, string>> = {};
  const datos = { texto: "" } as EvolucionValidada;
  for (const c of LISTA_CAMPOS_EVOLUCION) {
    const v = texto(c).trim();
    const { max } = CAMPOS_EVOLUCION[c];
    if (v.length > max) errores[c] = `Máximo ${max} caracteres.`;
    if (c === "texto") datos.texto = v;
    else datos[c] = v || null;
  }
  if (firmar && !errores.texto && datos.texto.length < 3) {
    errores.texto = "Describe lo realizado en la sesión antes de firmar.";
  }
  if (datos.anestesia_cantidad && !datos.anestesia_tipo && !errores.anestesia_tipo) {
    errores.anestesia_tipo = "Indica el anestésico usado.";
  }
  return Object.keys(errores).length > 0 ? { ok: false, errores } : { ok: true, datos };
}

/**
 * Ítems de la sesión desde el formulario: `trabajado` y `terminado` son listas de ids.
 * Solo se aceptan ids de `permitidos` (ítems aceptados o programados del paciente).
 */
export function leerItemsSesion(trabajados: string[], terminados: string[], permitidos: Set<string>):
  { ok: true; items: ItemSesion[] } | { ok: false; error: string } {
  const todos = [...trabajados, ...terminados];
  if (todos.some((id) => !UUID.test(id) || !permitidos.has(id))) {
    return { ok: false, error: "Hay un ítem del plan que ya no está pendiente. Recarga la página." };
  }
  const trab = new Set(trabajados);
  const term = new Set(terminados);
  const sinTrabajar = [...term].filter((id) => !trab.has(id));
  if (sinTrabajar.length > 0) return { ok: false, error: "Un ítem terminado también debe marcarse como trabajado." };
  return { ok: true, items: [...permitidos].map((id) => ({ item_id: id, trabajado: trab.has(id), terminado: term.has(id) })) };
}
