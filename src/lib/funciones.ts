import "server-only";

// Módulos que dependen de migraciones aún no aplicadas en todos los entornos.
// Se encienden por variable de entorno cuando la base ya las tiene (CI, local,
// y Vercel después de correr el workflow "Aplicar migraciones").
export const modulos = {
  /**
   * Etapa 1: pacientes (búsqueda, alta, ficha, fusión) y seguridad de sesión.
   * Requiere las migraciones 0900-0905 en la base.
   */
  etapa1: process.env.HABILITAR_ETAPA1 === "1",
};
