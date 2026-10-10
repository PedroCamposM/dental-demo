import { expect, test } from "@playwright/test";
import { conEtapa9, conSupabaseLocal, dniAlAzar, entrar, registrarYEsperarFicha } from "./ayudantes";

test.skip(!conSupabaseLocal || !conEtapa9, "Crea datos: solo contra Supabase local con la Etapa 9 encendida");
test.describe.configure({ mode: "serial" });

let pacienteId = "";
const ENDO = "Endodoncia multirradicular · pieza 46";
const EXO = "Exodoncia simple · pieza 38";

test("la odontóloga registra conductos y la cirugía en la evolución, y al firmar quedan fijos", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  await page.goto("/pacientes/nuevo");
  await page.getByLabel("Número de documento").fill(dniAlAzar());
  await page.getByLabel("Nombres").fill("Elena");
  await page.getByLabel("Apellidos").fill(`Especialidad${dniAlAzar()}`);
  await page.getByLabel("Fecha de nacimiento").fill("1979-07-07");
  await page.getByLabel("Sexo").selectOption("femenino");
  await page.locator("#campo-telefono").fill("944555666");
  await page.getByLabel(/autoriza el tratamiento de sus datos/).check();
  await registrarYEsperarFicha(page);
  pacienteId = page.url().split("/pacientes/")[1]?.split("?")[0] ?? "";

  // Plan aceptado con una endodoncia y una exodoncia
  await page.goto(`/pacientes/${pacienteId}/plan`);
  await page.getByLabel("Título del plan").fill("Endodoncia y exodoncia");
  await page.getByLabel("Primera fase").fill("Tratamiento");
  await page.getByRole("button", { name: "Crear plan" }).click();
  for (const [codigo, nombre, pieza] of [["END-02", "Endodoncia multirradicular", "46"], ["CIR-01", "Exodoncia simple", "38"]] as const) {
    await page.locator("#i-procedimiento").selectOption({ label: `${codigo} · ${nombre}` });
    await page.locator("#i-pieza").fill(pieza);
    await page.getByRole("button", { name: "Agregar al plan" }).click();
    await expect(page.getByText(`Agregado: ${nombre}.`)).toBeVisible();
  }
  await page.getByRole("button", { name: "Registrar aceptación" }).click();
  await expect(page.getByRole("navigation", { name: "Planes del paciente" })).toContainText("Aceptado");

  // Evolución en borrador con los dos ítems trabajados
  await page.goto(`/pacientes/${pacienteId}/evolucion`);
  await page.getByRole("button", { name: "Nueva evolución sin cita" }).click();
  const borrador = page.getByRole("article", { name: /Evolución en borrador/ });
  await borrador.getByLabel("Descripción de lo realizado").fill("Apertura cameral y conductometría en 46; exodoncia de 38.");
  await borrador.getByRole("checkbox", { name: `Trabajado: ${ENDO}` }).check();
  await borrador.getByRole("checkbox", { name: `Trabajado: ${EXO}` }).check();
  await borrador.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(borrador.getByText("Borrador guardado.")).toBeVisible();

  // Endodoncia: un conducto (un dato fuera de rango no se guarda y no se pierde lo escrito)
  await borrador.getByText(`Endodoncia (conducto) · ${ENDO}`).click();
  const endo = borrador.getByRole("form", { name: `Endodoncia (conducto) · ${ENDO}` });
  await endo.getByLabel(/^Conducto/).fill("MV");
  await endo.getByLabel("Longitud de trabajo (mm)").fill("45");
  await endo.getByRole("button", { name: "Registrar conducto" }).click();
  await expect(endo.getByRole("alert")).toContainText("entre 5 y 40");
  await expect(endo.getByLabel(/^Conducto/)).toHaveValue("MV");
  await endo.getByLabel("Longitud de trabajo (mm)").fill("21.5");
  await endo.getByLabel("Lima maestra").fill("K 30");
  await endo.getByRole("button", { name: "Registrar conducto" }).click();
  await expect(borrador.getByRole("list", { name: "Registros de especialidad" })).toContainText("Conducto MV · LT 21.5 mm");

  // Cirugía con retiro de puntos
  await borrador.getByText(`Cirugía · ${EXO}`).click();
  const cir = borrador.getByRole("form", { name: `Cirugía · ${EXO}` });
  await cir.getByLabel("Técnica").fill("Exodoncia con elevador y fórceps");
  await cir.getByLabel("Sutura").fill("Seda 3-0, 1 punto");
  await cir.getByLabel(/Retiro de puntos/).fill("7");
  await cir.getByRole("button", { name: "Registrar cirugía" }).click();
  await expect(borrador.getByRole("list", { name: "Registros de especialidad" })).toContainText("retiro de puntos a los 7 días");

  page.once("dialog", (d) => void d.accept());
  await borrador.getByRole("button", { name: "Firmar y cerrar" }).click();
  await expect(page.getByRole("article", { name: /Evolución en borrador/ })).toHaveCount(0);
  const firmada = page.locator("li[id^=evolucion-]").filter({ hasText: "Apertura cameral" });
  await expect(firmada.getByRole("list", { name: "Registros de especialidad" })).toContainText("Conducto MV");
  await expect(firmada.getByRole("list", { name: "Registros de especialidad" })).toContainText("Técnica: Exodoncia con elevador");
  // Firmada: los registros ya no se anulan
  await expect(firmada.getByRole("list", { name: "Registros de especialidad" }).getByText("Anular")).toHaveCount(0);
});

test("el historial por especialidad lo ve la asistente", async ({ page }) => {
  expect(pacienteId, "depende de la prueba anterior").not.toBe("");
  await entrar(page, "asistente@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}`);
  await page.getByRole("link", { name: "Especialidades" }).click();
  const endo = page.getByRole("region", { name: "Endodoncia" });
  await expect(endo).toContainText(ENDO);
  await expect(endo).toContainText("1 sesión(es) · en curso");
  await expect(endo).toContainText("lima maestra K 30");
  await expect(page.getByRole("region", { name: "Cirugía" })).toContainText("Seda 3-0, 1 punto");
});

test("recepción no ve el historial por especialidad", async ({ page }) => {
  expect(pacienteId, "depende de la primera prueba").not.toBe("");
  await entrar(page, "recepcion@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}`);
  await expect(page.getByRole("link", { name: "Especialidades" })).toHaveCount(0);
  await page.goto(`/pacientes/${pacienteId}/especialidades`);
  await expect(page).toHaveURL(new RegExp(`/pacientes/${pacienteId}$`));
});
