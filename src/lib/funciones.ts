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
  /**
   * Etapa 2: catálogo de procedimientos, horarios, bloqueos y agenda.
   * Requiere las migraciones 0906-0907 (y la Etapa 1).
   */
  etapa2: process.env.HABILITAR_ETAPA1 === "1" && process.env.HABILITAR_ETAPA2 === "1",
  /**
   * Etapa 3: historia clínica versionada, signos vitales y alertas clínicas.
   * Requiere las migraciones 0908 y 0909 (y las etapas 1 y 2).
   */
  etapa3: process.env.HABILITAR_ETAPA1 === "1" && process.env.HABILITAR_ETAPA2 === "1"
    && process.env.HABILITAR_ETAPA3 === "1",
  /**
   * Etapa 4: examen clínico, diagnóstico CIE-10 y odontograma (NTS 188).
   * Requiere la migración 0910 (y las etapas 1 a 3).
   */
  etapa4: process.env.HABILITAR_ETAPA1 === "1" && process.env.HABILITAR_ETAPA2 === "1"
    && process.env.HABILITAR_ETAPA3 === "1" && process.env.HABILITAR_ETAPA4 === "1",
};
