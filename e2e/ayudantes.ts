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
