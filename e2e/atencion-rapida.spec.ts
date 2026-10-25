import { expect, test } from "@playwright/test";
import { conEtapa14, conSupabaseLocal, dniAlAzar, entrar, registrarYEsperarFicha } from "./ayudantes";

test.skip(!conSupabaseLocal || !conEtapa14, "Crea datos: solo contra Supabase local con la Etapa 14 encendida");

// Etapa 21: la atención rápida es la ficha de la clínica piloto en una página (cada sección se
// guarda por separado): anamnesis, odontograma, diagnósticos, plan por zona y ficha de control.
test("la odontóloga llena la ficha rápida de una página, de la anamnesis a la labor firmada", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  await page.goto("/pacientes/nuevo");
  await page.getByLabel("Número de documento").fill(dniAlAzar());
  await page.getByLabel("Nombres").fill("Óscar");
  await page.getByLabel("Apellidos").fill(`Ocasional${dniAlAzar()}`);
  await page.getByLabel("Fecha de nacimiento").fill("1979-11-11");
  await page.getByLabel("Sexo").selectOption("masculino");
  await page.locator("#campo-telefono").fill("944222777");
  await page.getByLabel(/autoriza el tratamiento de sus datos/).check();
  await registrarYEsperarFicha(page);

  await page.getByRole("link", { name: "Atención rápida" }).click();
  await expect(page.getByRole("heading", { name: /^Atención rápida/ })).toBeVisible();
  page.on("dialog", (d) => void d.accept());

  // Anamnesis: motivo y alergias son obligatorios (validado en el servidor)
  const anamnesis = page.getByRole("form", { name: "Anamnesis" });
  await anamnesis.getByRole("button", { name: "Guardar anamnesis" }).click();
  await expect(anamnesis.getByText(/Pregunta por las alergias/)).toBeVisible();
  await anamnesis.getByLabel("Motivo de consulta *").fill("Dolor al frío en molar inferior izquierdo");
  await anamnesis.getByLabel("Enfermedad actual").fill("Sensibilidad al frío desde hace una semana");
  await anamnesis.getByLabel("Alergias", { exact: true }).fill("Penicilina");
  await anamnesis.getByRole("button", { name: "Guardar anamnesis" }).click();
  await expect(anamnesis.getByRole("status")).toHaveText("Anamnesis guardada.");
  await expect(page.getByRole("note", { name: "Alertas clínicas" })).toContainText("Alergia: Penicilina");

  // Odontograma en la misma página
  await page.getByRole("form", { name: "Crear odontograma" }).getByRole("button", { name: "Empezar odontograma" }).click();
  await expect(page.getByRole("heading", { name: /^Odontograma · .* dentición permanente$/ })).toBeVisible();

  // Diagnóstico
  await page.locator("#d-cie10").fill("K02.1");
  await page.getByRole("radio", { name: "Definitivo" }).check();
  await page.locator("#d-pieza").fill("36");
  await page.getByRole("button", { name: "Registrar diagnóstico" }).click();
  await expect(page.getByText("Diagnóstico K02.1 registrado.")).toBeVisible();

  // Plan: una resina en 36 y un destartraje de ambas arcadas (un solo ítem, por zona)
  await page.getByRole("button", { name: "Empezar plan de tratamiento" }).click();
  await page.locator("#i-procedimiento").selectOption({ label: "OPE-01 · Restauración con resina compuesta" });
  await page.locator("#i-pieza").fill("36");
  await page.getByRole("button", { name: "Agregar al plan" }).click();
  await expect(page.getByText("Agregado: Restauración con resina compuesta.")).toBeVisible();
  await page.locator("#i-procedimiento").selectOption({ label: "PRE-01 · Profilaxis y destartraje" });
  await expect(page.getByRole("button", { name: "Ambas arcadas (boca completa)" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Agregar al plan" }).click();
  await expect(page.getByText(/Agregado: Profilaxis y destartraje \(ambas arcadas/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Plan de tratamiento" }).locator("ol > li").filter({ hasText: "Profilaxis y destartraje" }))
    .toContainText("Ambas arcadas (boca completa)");
  await page.getByRole("button", { name: "Registrar aceptación" }).click();
  await expect(page.getByRole("region", { name: "Plan de tratamiento" })).toContainText("aceptado");

  // Ficha de control: la labor de hoy, firmada
  await page.getByRole("button", { name: "Registrar labor de hoy" }).click();
  const labor = page.getByRole("article", { name: "Labor de hoy" });
  await labor.getByLabel("Descripción de lo realizado").fill("Remoción de caries y restauración oclusal con resina en 36.");
  await labor.getByLabel(/^Trabajado: Restauración con resina compuesta/).check();
  await labor.getByLabel(/^Terminado: Restauración con resina compuesta/).check();
  await labor.getByRole("button", { name: "Firmar y cerrar" }).click();
  const control = page.getByRole("region", { name: "Ficha de control" });
  await expect(control.getByRole("row").filter({ hasText: "Remoción de caries" })).toContainText("Restauración con resina compuesta (pieza 36)");
  await expect(control.getByRole("button", { name: "Registrar labor de hoy" })).toBeVisible();
});

test("la asistente no ve la atención rápida", async ({ page }) => {
  await entrar(page, "asistente@clinica-demo.example");
  await page.goto(`/pacientes?q=${encodeURIComponent("Zavaleta Cerna")}`);
  await page.getByRole("link", { name: /^Zavaleta Cerna, Diana/ }).click();
  await page.waitForURL(/\/pacientes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("link", { name: "Atención rápida" })).toHaveCount(0);
  await page.goto(`${page.url()}/atencion-rapida`);
  await expect(page).not.toHaveURL(/atencion-rapida/);
});
