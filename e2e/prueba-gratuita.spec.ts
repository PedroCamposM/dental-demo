import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { conEtapa16, conSupabaseLocal } from "./ayudantes";

// Etapa 16: prueba gratuita por clínica. Registro → clínica con pacientes de ejemplo → vence
// (solo lectura) → el superadministrador activa el plan.
test.skip(!conSupabaseLocal || !conEtapa16, "Crea cuentas y clínicas: solo contra Supabase local con la Etapa 16 encendida");
test.describe.configure({ mode: "serial" });

const DB_URL = process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
/** SQL directo a la base local: lo que en producción hace el superadmin a mano (o el paso del tiempo). */
function sql(consulta: string): string {
  return execFileSync("psql", [DB_URL, "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", consulta], { encoding: "utf8" }).trim();
}

const sufijo = `${Date.now()}`;
const CLINICA = `Consultorio Prueba ${sufijo}`;
const CORREO = `prueba-${sufijo}@clinica-nueva.example`;
const SUPER = `super-${sufijo}@plataforma.example`;
const CLAVE = "Prueba2026x";

async function registrar(page: Page, correo: string, clinica: string, cop: string) {
  await page.goto("/login");
  await page.getByRole("link", { name: "Prueba gratis 30 días" }).click();
  await expect(page).toHaveURL(/\/registro$/);
  await page.getByLabel("Nombre de la clínica o consultorio").fill(clinica);
  await page.getByLabel("Tu nombre").fill("Dra. Prueba Nueva");
  await page.getByLabel(/N\.º de colegiatura/).fill(cop);
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Contraseña").fill("corta");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByText("La contraseña tiene de 8 a 72 caracteres.")).toBeVisible();
  await expect(page.getByText(/Acepta los términos/)).toBeVisible();
  await page.getByLabel("Contraseña").fill(CLAVE);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  // Supabase local no pide confirmar el correo: pasa directo a crear la clínica.
  await expect(page).toHaveURL(/\/bienvenida$/);
  await expect(page.getByLabel("Nombre de la clínica o consultorio")).toHaveValue(clinica);
}

test("los términos (borrador) se ven sin iniciar sesión", async ({ page }) => {
  await page.goto("/terminos");
  await expect(page.getByRole("heading", { name: "Términos de uso y política de privacidad" })).toBeVisible();
  await expect(page.getByText(/Borrador para revisar con un abogado/)).toBeVisible();
});

test("quien se registra crea su clínica de prueba con pacientes de ejemplo", async ({ page }) => {
  await registrar(page, CORREO, CLINICA, "9850");
  await page.getByRole("button", { name: "Crear mi clínica" }).click();
  await expect(page).toHaveURL(/\/pacientes/);
  await expect(page.getByRole("banner").getByText(CLINICA)).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Prueba gratuita: quedan 30 días." })).toBeVisible();
  await expect(page.getByText(/\(ejemplo\)/)).toHaveCount(3);
  // Ya con sesión, el registro no se vuelve a mostrar
  await page.goto("/registro");
  await expect(page).not.toHaveURL(/\/registro/);
});

test("al vencer queda en solo lectura y el superadministrador activa el plan", async ({ page, browser }) => {
  sql(`update public.clinica set prueba_hasta = (now() at time zone 'America/Lima')::date - 1 where nombre = '${CLINICA}'`);
  await page.goto("/login");
  await page.getByLabel("Correo").fill(CORREO);
  await page.getByLabel("Contraseña").fill(CLAVE);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "La prueba gratuita terminó" })).toBeVisible();
  // Sigue viendo a sus pacientes
  await expect(page.getByText(/\(ejemplo\)/)).toHaveCount(3);

  // El superadministrador (agregado a mano por SQL, sin clínica) entra a su panel
  const otra = await browser.newPage();
  await registrar(otra, SUPER, "No se crea", "");
  sql(`insert into privado.superadmin (usuario_id) select id from auth.users where email = '${SUPER}'`);
  await otra.goto("/");
  await expect(otra).toHaveURL(/\/plataforma$/);
  const ficha = otra.getByRole("listitem").filter({ hasText: CLINICA });
  await expect(ficha.getByText(/solo lectura/)).toBeVisible();
  const formulario = ficha.getByRole("form", { name: `Plan de ${CLINICA}` });
  await formulario.getByRole("button", { name: "Guardar plan" }).click();
  await expect(formulario.getByText(/Escribe el motivo/)).toBeVisible();
  await formulario.getByLabel("Motivo").fill("Pago por transferencia (prueba)");
  await formulario.getByRole("button", { name: "Guardar plan" }).click();
  await expect(ficha.getByText(/^Activo hasta/)).toBeVisible();
  await otra.close();

  // Con el plan activo, el aviso desaparece
  await page.reload();
  await expect(page.getByText("La prueba gratuita terminó")).toHaveCount(0);
});

test("un usuario de una clínica no entra al panel de la plataforma", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(CORREO);
  await page.getByLabel("Contraseña").fill(CLAVE);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/pacientes/);
  const r = await page.goto("/plataforma");
  expect(r?.status()).toBe(404);
});
