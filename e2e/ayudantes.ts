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
 * Pulsa «Registrar paciente» y espera la ficha. Si la página muestra un error, la
 * prueba falla con ese texto (así el log dice por qué no se guardó).
 */
export async function registrarYEsperarFicha(page: Page, confirmarDuplicado = false) {
  await page.getByRole("button", { name: "Registrar paciente" }).click();
  if (confirmarDuplicado) await page.getByRole("button", { name: /crear de todas formas/ }).click();
  const exito = page.getByText("Paciente registrado.");
  const errores = page.locator('[role="alert"]:not(#__next-route-announcer__), [id$="-error"]');
  await expect(exito.or(errores.first())).toBeVisible({ timeout: 15_000 });
  if (!(await exito.isVisible())) {
    const textos = (await errores.allTextContents()).map((t) => t.trim()).filter(Boolean);
    throw new Error(`No se registró el paciente. La página muestra: ${JSON.stringify(textos)} (url ${page.url()})`);
  }
}
