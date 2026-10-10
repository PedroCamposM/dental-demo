import { expect, test } from "@playwright/test";
import { conEtapa8, conSupabaseLocal, dniAlAzar, entrar, registrarYEsperarFicha } from "./ayudantes";

test.skip(!conSupabaseLocal || !conEtapa8, "Crea datos: solo contra Supabase local con la Etapa 8 encendida");
test.describe.configure({ mode: "serial" });

let pacienteId = "";
const APELLIDO = `Caja${dniAlAzar()}`;

test("la odontóloga deja un plan aceptado para cobrar", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  await page.goto("/pacientes/nuevo");
  await page.getByLabel("Número de documento").fill(dniAlAzar());
  await page.getByLabel("Nombres").fill("Carmen");
  await page.getByLabel("Apellidos").fill(APELLIDO);
  await page.getByLabel("Fecha de nacimiento").fill("1988-08-08");
  await page.getByLabel("Sexo").selectOption("femenino");
  await page.locator("#campo-telefono").fill("944333222");
  await page.getByLabel(/autoriza el tratamiento de sus datos/).check();
  await registrarYEsperarFicha(page);
  pacienteId = page.url().split("/pacientes/")[1]?.split("?")[0] ?? "";
  await page.goto(`/pacientes/${pacienteId}/plan`);
  await page.getByLabel("Título del plan").fill("Restauraciones");
  await page.getByLabel("Primera fase").fill("Operatoria");
  await page.getByRole("button", { name: "Crear plan" }).click();
  await page.locator("#i-procedimiento").selectOption({ label: "OPE-01 · Restauración con resina compuesta" });
  await page.locator("#i-pieza").fill("16");
  await page.getByRole("button", { name: "Agregar al plan" }).click();
  await expect(page.getByText("Agregado: Restauración con resina compuesta.")).toBeVisible();
  await page.getByRole("button", { name: "Registrar aceptación" }).click();
  await expect(page.getByRole("navigation", { name: "Planes del paciente" })).toContainText("Aceptado");
  // La odontóloga no cobra
  await expect(page.getByRole("button", { name: "Registrar pago" })).toHaveCount(0);
});

test("recepción registra pagos, no acepta montos que exceden el saldo y cierra la caja", async ({ page }) => {
  expect(pacienteId, "depende de la prueba anterior").not.toBe("");
  await entrar(page, "recepcion@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}/plan`);
  const pagos = page.getByRole("region", { name: "Pagos", exact: true });
  await pagos.getByLabel("Monto (S/)").fill("999");
  await pagos.getByRole("button", { name: "Registrar pago" }).click();
  await expect(pagos.getByRole("alert")).toContainText("excede el saldo");
  await expect(pagos.getByLabel("Monto (S/)")).toHaveValue("999");   // no se pierde lo escrito

  await pagos.getByLabel("Monto (S/)").fill("100");
  await pagos.getByLabel("Método").selectOption("yape");
  await pagos.getByLabel("N° de operación (opcional)").fill("OP-777");
  await pagos.getByRole("button", { name: "Registrar pago" }).click();
  await expect(pagos.getByText("Pago registrado.")).toBeVisible();
  await expect(pagos).toContainText("S/ 100.00 · Yape · OP-777");
  await expect(pagos).toContainText("Pagado S/ 100.00");

  await page.getByRole("link", { name: "Caja", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Caja", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Pagos del día" })).toContainText(APELLIDO);
  await page.getByLabel("Efectivo contado (S/)").fill("0");
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Cerrar caja del día" }).click();
  await expect(page.getByRole("heading", { name: "Caja cerrada" })).toBeVisible();

  // Día cerrado: el pago ya no se registra; se corrige con un ajuste
  await page.goto(`/pacientes/${pacienteId}/plan`);
  await pagos.getByLabel("Monto (S/)").fill("10");
  await pagos.getByRole("button", { name: "Registrar pago" }).click();
  await expect(pagos.getByRole("alert")).toContainText("ya se cerró");
  await page.goto("/caja");
  await page.getByLabel("Monto (S/, negativo para restar)").fill("-5");
  await page.getByLabel("Motivo").fill("Vuelto mal entregado");
  await page.getByRole("button", { name: "Registrar ajuste" }).click();
  await expect(page.getByRole("region", { name: "Ajustes posteriores al cierre" })).toContainText("Vuelto mal entregado");
});

test("la odontóloga no entra a la caja", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  await expect(page.getByRole("link", { name: "Caja", exact: true })).toHaveCount(0);
  await page.goto("/caja");
  await expect(page).not.toHaveURL(/\/caja/);
});
