import { execFileSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";

// Ayudantes de las pruebas de la plataforma (prueba gratuita y suscripción): SQL directo a la
// base local para lo que en producción hace el superadmin a mano o el paso del tiempo.
const DB_URL = process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export const hayPsql = (() => { try { execFileSync("psql", ["--version"]); return true; } catch { return false; } })();

export function sql(consulta: string): string {
  return execFileSync("psql", [DB_URL, "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", consulta], { encoding: "utf8" }).trim();
}

/** Se registra a la prueba y llega a «Crea tu clínica» (Supabase local no pide confirmar el correo). */
export async function registrarCuenta(page: Page, correo: string, clave: string, clinica: string, cop: string) {
  await page.goto("/registro");
  await page.getByLabel("Nombre de la clínica o consultorio").fill(clinica);
  await page.getByLabel("Tu nombre").fill("Dra. Prueba Nueva");
  await page.getByLabel(/N\.º de colegiatura/).fill(cop);
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Contraseña").fill(clave);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/bienvenida$/);
}

export async function ingresar(page: Page, correo: string, clave: string) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Contraseña").fill(clave);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
