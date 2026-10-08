import { expect, test } from "@playwright/test";
import { conSupabaseLocal, entrar, PASSWORD } from "./ayudantes";

test.skip(!conSupabaseLocal, "Cambia la configuración de la clínica: solo contra Supabase local");
// Comparten la configuración de la clínica demo: una tras otra.
test.describe.configure({ mode: "serial" });

test("bloquear la pantalla pide la contraseña para volver", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  await page.getByRole("button", { name: "Bloquear pantalla" }).click();
  const bloqueo = page.getByRole("dialog", { name: "Pantalla bloqueada" });
  await expect(bloqueo).toBeVisible();

  await page.reload();   // recargar no la desbloquea
  await expect(bloqueo).toBeVisible();
  const otraPestana = await page.context().newPage();   // ni abrir otra pestaña
  await otraPestana.goto("/");
  await expect(otraPestana.getByRole("dialog", { name: "Pantalla bloqueada" })).toBeVisible();
  await otraPestana.close();
  // Lo de debajo queda inerte: no se puede activar el menú
  await expect(page.getByRole("link", { name: "Tablero" })).toHaveAttribute("aria-current", "page");
  expect(await page.locator("header").evaluate((n) => n.closest("[inert]") !== null)).toBe(true);

  await bloqueo.getByLabel("Contraseña").fill("incorrecta");
  await bloqueo.getByRole("button", { name: "Desbloquear" }).click();
  await expect(bloqueo.getByRole("alert")).toHaveText("Contraseña incorrecta.");
  await bloqueo.getByLabel("Contraseña").fill(PASSWORD);
  await bloqueo.getByRole("button", { name: "Desbloquear" }).click();
  await expect(bloqueo).toBeHidden();
  await expect(page.getByText("Dinero en riesgo hoy")).toBeVisible();
});

test("tras 15 minutos sin actividad avisa y cierra la sesión", async ({ page }) => {
  await page.clock.install();
  await entrar(page, "recepcion@clinica-demo.example");
  await page.clock.fastForward("14:10");
  await expect(page.getByText(/Tu sesión se cerrará en \d+ s por inactividad/)).toBeVisible();
  await page.clock.fastForward("01:00");
  await expect(page).toHaveURL(/\/login\?motivo=inactividad$/);
  await expect(page.getByText("Cerramos tu sesión por inactividad. Vuelve a ingresar.")).toBeVisible();
});

test("«Seguir trabajando» mantiene la sesión abierta", async ({ page }) => {
  await page.clock.install();
  await entrar(page, "recepcion@clinica-demo.example");
  await page.clock.fastForward("14:10");
  await page.getByRole("button", { name: "Seguir trabajando" }).click();
  await page.clock.fastForward("02:00");
  await expect(page.getByText("Dinero en riesgo hoy")).toBeVisible();
  await expect(page.getByText(/Tu sesión se cerrará/)).toBeHidden();
});

test("al volver a una pestaña cerrada hace rato, el servidor cierra la sesión", async ({ page, context, baseURL }) => {
  await entrar(page, "recepcion@clinica-demo.example");
  await page.close();
  const hace20min = Date.now() - 20 * 60_000;
  await context.addCookies([{ name: "dental_ult", value: String(hace20min), url: baseURL ?? "http://localhost:3100" }]);
  const nueva = await context.newPage();
  await nueva.goto("/pacientes");
  await expect(nueva).toHaveURL(/\/login\?motivo=inactividad$/);
});

test("solo el admin configura los minutos de inactividad", async ({ page }) => {
  await entrar(page, "recepcion@clinica-demo.example");
  await expect(page.getByRole("link", { name: "Configuración" })).toHaveCount(0);
  await page.goto("/configuracion");
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await entrar(page, "valverde@clinica-demo.example");
  await page.getByRole("link", { name: "Configuración" }).click();
  const minutos = page.getByLabel(/minutos sin actividad/);
  await minutos.fill("200");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Elige entre 5 y 120 minutos.")).toBeVisible();
  await minutos.fill("30");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(/tras 30 minutos sin actividad/)).toBeVisible();
  await minutos.fill("15");   // deja la clínica demo como estaba
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(/tras 15 minutos sin actividad/)).toBeVisible();
});
