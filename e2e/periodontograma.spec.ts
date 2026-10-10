import { expect, test } from "@playwright/test";
import { conEtapa9, conSupabaseLocal, dniAlAzar, entrar, registrarYEsperarFicha } from "./ayudantes";

test.skip(!conSupabaseLocal || !conEtapa9, "Crea datos: solo contra Supabase local con la Etapa 9 encendida");
test.describe.configure({ mode: "serial" });

let pacienteId = "";
let borradorAsistente = "";

test("la odontóloga registra un periodontograma, ve el NIC calculado y lo firma con su mantenimiento", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  await page.goto("/pacientes/nuevo");
  await page.getByLabel("Número de documento").fill(dniAlAzar());
  await page.getByLabel("Nombres").fill("Pía");
  await page.getByLabel("Apellidos").fill(`Periodonto${dniAlAzar()}`);
  await page.getByLabel("Fecha de nacimiento").fill("1972-02-02");
  await page.getByLabel("Sexo").selectOption("femenino");
  await page.locator("#campo-telefono").fill("944111222");
  await page.getByLabel(/autoriza el tratamiento de sus datos/).check();
  await registrarYEsperarFicha(page);
  pacienteId = page.url().split("/pacientes/")[1]?.split("?")[0] ?? "";

  await page.getByRole("link", { name: "Periodontograma" }).click();
  await page.getByRole("button", { name: "Nuevo periodontograma" }).click();
  await expect(page).toHaveURL(/\?p=/);
  await page.getByLabel("PS 16 MV", { exact: true }).fill("3");
  await page.getByLabel("PS 16 V", { exact: true }).fill("5");
  await page.getByLabel("MG 16 V", { exact: true }).fill("-1");
  await page.getByLabel("MG 16 MV", { exact: true }).fill("2");
  await expect(page.getByLabel("NIC 16 V", { exact: true })).toHaveText("4");
  await expect(page.getByLabel("NIC 16 MV", { exact: true })).toHaveText("5");
  await page.getByLabel("Sangrado 16 V", { exact: true }).check();
  await page.getByLabel("Movilidad 16").selectOption("1");
  await page.getByLabel("Ausente 18").check();
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Borrador guardado." })).toBeVisible();

  // Un valor fuera de rango no se guarda y no se pierde lo escrito
  await page.getByLabel("PS 26 V", { exact: true }).fill("25");
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Pieza 26" })).toBeVisible();
  await expect(page.getByLabel("PS 16 V", { exact: true })).toHaveValue("5");
  await page.getByLabel("PS 26 V", { exact: true }).fill("2");

  await page.getByLabel("Mantenimiento periodontal en (meses)").fill("3");
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Guardar y firmar" }).click();
  // Si falla, el mensaje muestra todos los avisos de la página y la dirección.
  await expect.poll(async () => [page.url(), ...(await page.locator("[role=status], [role=alert]").allInnerTexts())])
    .toContain("Firmado. Mantenimiento programado a 3 meses.");
  await expect(page.getByText("Aus.").first()).toBeVisible();   // la 18 quedó ausente
  // Firmado: solo lectura
  await expect(page.getByRole("button", { name: "Guardar borrador" })).toHaveCount(0);
  await expect(page.getByLabel("PS 16 V", { exact: true })).toHaveText("5");
  await expect(page.getByRole("region", { name: "Periodontogramas" })).toContainText("Firmado");
});

test("la asistente registra uno a nombre de la odontóloga y no lo firma", async ({ page }) => {
  expect(pacienteId, "depende de la prueba anterior").not.toBe("");
  await entrar(page, "asistente@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}/periodontograma`);
  await page.getByLabel("Cirujano dentista responsable").selectOption({ label: "Dra. Carla Mendoza Paredes" });
  await page.getByRole("button", { name: "Nuevo periodontograma" }).click();
  await expect(page).toHaveURL(/\?p=/);
  const url = page.url();
  await page.getByLabel("PS 16 MV", { exact: true }).fill("3");
  await page.getByLabel("PS 16 V", { exact: true }).fill("8");
  await page.getByLabel("MG 16 V", { exact: true }).fill("-1");
  await page.getByLabel("MG 16 MV", { exact: true }).fill("2");
  await page.getByLabel("PS 26 V", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Borrador guardado." })).toBeVisible();
  // La asistente no firma
  await expect(page.getByRole("button", { name: "Guardar y firmar" })).toHaveCount(0);
  borradorAsistente = url;
});

test("la odontóloga responsable firma el de la asistente y compara las fechas", async ({ page }) => {
  expect(borradorAsistente, "depende de la prueba anterior").not.toBe("");
  await entrar(page, "mendoza@clinica-demo.example");
  await page.goto(borradorAsistente);
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Guardar y firmar" }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Firmado\.$/ })).toBeVisible();
  const comparar = page.getByRole("region", { name: "Comparar fechas" });
  await expect(comparar).toBeVisible();
  // 16 V: NIC 4 → 7
  await expect(comparar.getByRole("row", { name: /16\s+V\s+4 mm\s+7 mm\s+\+3 mm/ })).toBeVisible();
});

test("recepción no ve el periodontograma", async ({ page }) => {
  expect(pacienteId, "depende de la primera prueba").not.toBe("");
  await entrar(page, "recepcion@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}`);
  await expect(page.getByRole("link", { name: "Periodontograma" })).toHaveCount(0);
  await page.goto(`/pacientes/${pacienteId}/periodontograma`);
  await expect(page).toHaveURL(new RegExp(`/pacientes/${pacienteId}$`));
});
