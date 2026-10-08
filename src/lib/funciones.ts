import "server-only";

// Módulos que dependen de migraciones aún no aplicadas en todos los entornos.
// Se encienden por variable de entorno cuando la base ya las tiene (CI, local,
// y Vercel después de correr el workflow "Aplicar migraciones").
export const modulos = {
  /** Etapa 1: búsqueda, alta y ficha de pacientes (migraciones 0900-0903). */
  pacientes: process.env.HABILITAR_PACIENTES === "1",
};
