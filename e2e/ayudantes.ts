import { expect, type Page } from "@playwright/test";

export const PASSWORD = "DemoTrujillo2026";

export async function entrar(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByText("Dinero en riesgo hoy")).toBeVisible();
}

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
