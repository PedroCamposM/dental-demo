// Etapa 18: envío diario de avisos. Reserva cada correo ANTES de enviarlo (dos ejecuciones a la
// vez no lo duplican) y libera la reserva si el envío falla (se reintenta al día siguiente).
// Con tope por ejecución: lo que no alcance sale al día siguiente.

export type Pendiente = { clinica_id: string; tipo: string; referencia: string; para: string };
export type Operaciones<P extends Pendiente> = {
  reservar: (p: P) => Promise<boolean>;
  enviar: (p: P) => Promise<boolean>;
  liberar: (p: P) => Promise<void>;
};

export const TOPE_POR_EJECUCION = 40;

export async function procesarPendientes<P extends Pendiente>(pendientes: P[], op: Operaciones<P>, tope = TOPE_POR_EJECUCION) {
  let enviados = 0;
  let fallidos = 0;
  let omitidos = 0;
  for (const p of pendientes.slice(0, tope)) {
    if (!(await op.reservar(p))) { omitidos++; continue; }
    if (await op.enviar(p)) enviados++;
    else { fallidos++; await op.liberar(p); }
  }
  return { enviados, fallidos, omitidos, pendientes: Math.max(pendientes.length - tope, 0) };
}
