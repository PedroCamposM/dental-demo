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
  /**
   * Etapa 5: plan de tratamiento con fases, dependencias, alternativas y versiones.
   * Requiere la migración 0911 (y las etapas 1 a 4).
   */
  etapa5: process.env.HABILITAR_ETAPA1 === "1" && process.env.HABILITAR_ETAPA2 === "1"
    && process.env.HABILITAR_ETAPA3 === "1" && process.env.HABILITAR_ETAPA4 === "1"
    && process.env.HABILITAR_ETAPA5 === "1",
  /**
   * Etapa 6: evolución por sesión, firmada y con adendas; «en sala» y «Atender» en la agenda.
   * Requiere la migración 0912 (y las etapas 1 a 5).
   */
  etapa6: process.env.HABILITAR_ETAPA1 === "1" && process.env.HABILITAR_ETAPA2 === "1"
    && process.env.HABILITAR_ETAPA3 === "1" && process.env.HABILITAR_ETAPA4 === "1"
    && process.env.HABILITAR_ETAPA5 === "1" && process.env.HABILITAR_ETAPA6 === "1",
  /**
   * Etapa 7: imágenes y archivos, consentimientos, recetas, constancias e interconsultas.
   * Requiere las migraciones 0913 en adelante (y las etapas 1 a 6).
   */
  etapa7: process.env.HABILITAR_ETAPA1 === "1" && process.env.HABILITAR_ETAPA2 === "1"
    && process.env.HABILITAR_ETAPA3 === "1" && process.env.HABILITAR_ETAPA4 === "1"
    && process.env.HABILITAR_ETAPA5 === "1" && process.env.HABILITAR_ETAPA6 === "1"
    && process.env.HABILITAR_ETAPA7 === "1",
  /**
   * Etapa 8: seguimiento clínico, tablero clínico, pagos y cierre de caja.
   * Requiere las migraciones 0917 en adelante (y las etapas 1 a 7).
   */
  etapa8: process.env.HABILITAR_ETAPA1 === "1" && process.env.HABILITAR_ETAPA2 === "1"
    && process.env.HABILITAR_ETAPA3 === "1" && process.env.HABILITAR_ETAPA4 === "1"
    && process.env.HABILITAR_ETAPA5 === "1" && process.env.HABILITAR_ETAPA6 === "1"
    && process.env.HABILITAR_ETAPA7 === "1" && process.env.HABILITAR_ETAPA8 === "1",
  /**
   * Etapa 9: periodontograma y registros por especialidad.
   * Requiere las migraciones 0919 en adelante (y las etapas 1 a 8).
   */
  etapa9: process.env.HABILITAR_ETAPA1 === "1" && process.env.HABILITAR_ETAPA2 === "1"
    && process.env.HABILITAR_ETAPA3 === "1" && process.env.HABILITAR_ETAPA4 === "1"
    && process.env.HABILITAR_ETAPA5 === "1" && process.env.HABILITAR_ETAPA6 === "1"
    && process.env.HABILITAR_ETAPA7 === "1" && process.env.HABILITAR_ETAPA8 === "1"
    && process.env.HABILITAR_ETAPA9 === "1",
  /**
   * Etapa 10: laboratorio (órdenes de trabajo vinculadas al ítem del plan).
   * Requiere las migraciones 0921 en adelante (y las etapas 1 a 9).
   */
  etapa10: process.env.HABILITAR_ETAPA1 === "1" && process.env.HABILITAR_ETAPA2 === "1"
    && process.env.HABILITAR_ETAPA3 === "1" && process.env.HABILITAR_ETAPA4 === "1"
    && process.env.HABILITAR_ETAPA5 === "1" && process.env.HABILITAR_ETAPA6 === "1"
    && process.env.HABILITAR_ETAPA7 === "1" && process.env.HABILITAR_ETAPA8 === "1"
    && process.env.HABILITAR_ETAPA9 === "1"
    && process.env.HABILITAR_ETAPA10 === "1",
  /**
   * Etapa 11: exportar la historia clínica completa (con motivo, en la auditoría).
   * Requiere las migraciones 0922 en adelante (y las etapas 1 a 10).
   */
  etapa11: process.env.HABILITAR_ETAPA1 === "1" && process.env.HABILITAR_ETAPA2 === "1"
    && process.env.HABILITAR_ETAPA3 === "1" && process.env.HABILITAR_ETAPA4 === "1"
    && process.env.HABILITAR_ETAPA5 === "1" && process.env.HABILITAR_ETAPA6 === "1"
    && process.env.HABILITAR_ETAPA7 === "1" && process.env.HABILITAR_ETAPA8 === "1"
    && process.env.HABILITAR_ETAPA9 === "1"
    && process.env.HABILITAR_ETAPA10 === "1"
    && process.env.HABILITAR_ETAPA11 === "1",
  /**
   * Etapa 14: atención rápida (paciente ocasional, una sola sesión).
   * Requiere la migración 0925 (y las etapas 1 a 11).
   */
  etapa14: process.env.HABILITAR_ETAPA1 === "1" && process.env.HABILITAR_ETAPA2 === "1"
    && process.env.HABILITAR_ETAPA3 === "1" && process.env.HABILITAR_ETAPA4 === "1"
    && process.env.HABILITAR_ETAPA5 === "1" && process.env.HABILITAR_ETAPA6 === "1"
    && process.env.HABILITAR_ETAPA7 === "1" && process.env.HABILITAR_ETAPA8 === "1"
    && process.env.HABILITAR_ETAPA9 === "1"
    && process.env.HABILITAR_ETAPA10 === "1"
    && process.env.HABILITAR_ETAPA11 === "1" && process.env.HABILITAR_ETAPA14 === "1",
  /**
   * Etapa 15: personalización de la clínica (logo, color y membrete de los documentos).
   * Requiere la migración 0928 (y la Etapa 1).
   */
  etapa15: process.env.HABILITAR_ETAPA1 === "1" && process.env.HABILITAR_ETAPA15 === "1",
  /**
   * Etapa 16: prueba gratuita por clínica (registro, solo lectura al vencer, superadmin).
   * Requiere la migración 0929 (y la Etapa 1).
   */
  etapa16: process.env.HABILITAR_ETAPA1 === "1" && process.env.HABILITAR_ETAPA16 === "1",
};
