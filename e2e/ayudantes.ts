import { expect, type Page } from "@playwright/test";

export const PASSWORD = "DemoTrujillo2026";

export async function entrar(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
}

/** Las pantallas de pacientes están encendidas (CI y vista previa con HABILITAR_ETAPA1=1). */
export const conEtapa1 = process.env.HABILITAR_ETAPA1 === "1";

/** Las pruebas que crean datos solo corren contra un Supabase local (CI o PC con Docker). */
export const conSupabaseLocal = /127\.0\.0\.1|localhost/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");

/** DNI de 8 dígitos distinto en cada ejecución. */
export function dniAlAzar(): string {
  return String(Math.floor(30_000_000 + Math.random() * 9_999_999));
}

/**
 * Pulsa «Registrar paciente» y espera la ficha. Antes de leer errores espera a que
 * termine el envío (sin «Guardando…»), para no tomar mensajes del envío anterior.
 * Si no llega a la ficha, la prueba falla con lo que muestra la página.
 */
export async function registrarYEsperarFicha(page: Page, confirmarDuplicado = false) {
  const guardando = page.getByRole("button", { name: "Guardando…" });
  await page.getByRole("button", { name: "Registrar paciente" }).click();
  if (confirmarDuplicado) {
    const confirmar = page.getByRole("button", { name: /crear de todas formas/ });
    await expect(confirmar).toBeVisible({ timeout: 10_000 });
    await expect(guardando).toHaveCount(0, { timeout: 10_000 });
    await confirmar.click();
  }
  try {
    await page.waitForURL(/\/pacientes\/[0-9a-f-]{36}\?creado=1/, { timeout: 12_000 });
  } catch {
    await expect(guardando).toHaveCount(0, { timeout: 3_000 }).catch(() => undefined);
    const errores = page.locator('[role="alert"]:not(#__next-route-announcer__), [id$="-error"]');
    const textos = (await errores.allTextContents()).map((t) => t.trim()).filter(Boolean);
    throw new Error(`No se registró el paciente. La página muestra: ${JSON.stringify(textos)} (url ${page.url()})`);
  }
  await expect(page.getByText("Paciente registrado.")).toBeVisible();
}

/** Catálogo, horarios y agenda encendidos (CI con HABILITAR_ETAPA2=1). */
export const conEtapa2 = conEtapa1 && process.env.HABILITAR_ETAPA2 === "1";

/** Historia clínica, signos vitales y alertas encendidos (CI con HABILITAR_ETAPA3=1). */
export const conEtapa3 = conEtapa2 && process.env.HABILITAR_ETAPA3 === "1";

/** Examen clínico, diagnóstico CIE-10 y odontograma encendidos (CI con HABILITAR_ETAPA4=1). */
export const conEtapa4 = conEtapa3 && process.env.HABILITAR_ETAPA4 === "1";

/** Plan de tratamiento con fases y versiones encendido (CI con HABILITAR_ETAPA5=1). */
export const conEtapa5 = conEtapa4 && process.env.HABILITAR_ETAPA5 === "1";

/** Evolución por sesión firmada y «Atender» en la agenda (CI con HABILITAR_ETAPA6=1). */
export const conEtapa6 = conEtapa5 && process.env.HABILITAR_ETAPA6 === "1";

/** Imágenes, consentimientos, recetas y documentos clínicos (CI con HABILITAR_ETAPA7=1). */
export const conEtapa7 = conEtapa6 && process.env.HABILITAR_ETAPA7 === "1";

/** Seguimiento clínico, tablero clínico, pagos y cierre de caja (CI con HABILITAR_ETAPA8=1). */
export const conEtapa8 = conEtapa7 && process.env.HABILITAR_ETAPA8 === "1";
/** Periodontograma y registros por especialidad (CI con HABILITAR_ETAPA9=1). */
export const conEtapa9 = conEtapa8 && process.env.HABILITAR_ETAPA9 === "1";
/** Laboratorio (CI con HABILITAR_ETAPA10=1). */
export const conEtapa10 = conEtapa9 && process.env.HABILITAR_ETAPA10 === "1";
/** Exportar la historia clínica (CI con HABILITAR_ETAPA11=1). */
export const conEtapa11 = conEtapa10 && process.env.HABILITAR_ETAPA11 === "1";
/** Etapa 14: atención rápida (migración 0925). */
export const conEtapa14 = conEtapa11 && process.env.HABILITAR_ETAPA14 === "1";
/** Etapa 15: personalización de la clínica (migración 0928). */
export const conEtapa15 = conEtapa1 && process.env.HABILITAR_ETAPA15 === "1";
/** Etapa 16: prueba gratuita por clínica (migración 0929). */
export const conEtapa16 = conEtapa1 && process.env.HABILITAR_ETAPA16 === "1";
