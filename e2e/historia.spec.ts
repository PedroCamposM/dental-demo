import { expect, test, type Page } from "@playwright/test";
import { conEtapa3, conSupabaseLocal, dniAlAzar, entrar, registrarYEsperarFicha } from "./ayudantes";

test.skip(!conSupabaseLocal || !conEtapa3, "Crea datos: solo contra Supabase local con la Etapa 3 encendida");
test.describe.configure({ mode: "serial" });

let pacienteId = "";
const apellidos = `Historia${dniAlAzar()}`;

async function crearPaciente(page: Page) {
  await page.goto("/pacientes/nuevo");
  await page.getByLabel("Número de documento").fill(dniAlAzar());
  await page.getByLabel("Nombres").fill("Carmen");
  await page.getByLabel("Apellidos").fill(apellidos);
  await page.getByLabel("Fecha de nacimiento").fill("1990-05-20");
  await page.getByLabel("Sexo").selectOption("femenino");
  await page.locator("#campo-telefono").fill("944111222");
  await page.getByLabel(/autoriza el tratamiento de sus datos/).check();
  await registrarYEsperarFicha(page);
  pacienteId = page.url().split("/pacientes/")[1]?.split("?")[0] ?? "";
  expect(pacienteId).toMatch(/^[0-9a-f-]{36}$/);
}

test("la odontóloga registra la historia y la actualiza en una versión nueva", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  await crearPaciente(page);
  const alertas = page.getByRole("note", { name: "Alertas clínicas" });
  await expect(alertas).toContainText("Historia clínica sin registrar");

  await page.getByRole("navigation", { name: "Secciones del paciente" }).getByRole("link", { name: "Historia clínica" }).click();
  await expect(page.getByText("Aún no tiene historia clínica.")).toBeVisible();
  await page.getByRole("link", { name: "Registrar historia" }).click();
  await page.locator("#h-motivo_consulta").fill("Dolor en molar inferior derecho");
  await page.locator("#h-alergias").fill("Penicilina");
  await page.getByLabel("Hipertensión arterial").check();
  await page.getByLabel("Bruxismo").check();
  await page.getByRole("button", { name: "Guardar versión nueva" }).click();
  await expect(page.getByText("Historia guardada como versión 1.")).toBeVisible();
  await expect(alertas).toContainText("Alergia: Penicilina");
  await expect(alertas).toContainText("Hipertensión arterial");

  // Versión 2: falta el anticoagulante → error, sin perder lo escrito
  await page.getByRole("link", { name: "Actualizar historia" }).click();
  await expect(page.locator("#h-alergias")).toHaveValue("Penicilina");
  await expect(page.getByLabel("Hipertensión arterial")).toBeChecked();
  await page.locator("#h-motivo_consulta").fill("Control");
  await page.getByLabel(/Toma anticoagulantes/).check();
  await page.getByRole("radio", { name: "Sí" }).check();
  await page.locator("#h-semanas_gestacion").fill("18");
  await page.getByRole("button", { name: "Guardar versión nueva" }).click();
  await expect(page.getByText("Indica qué anticoagulante toma.")).toBeVisible();
  await expect(page.locator("#h-motivo_consulta")).toHaveValue("Control");
  await expect(page.locator("#h-semanas_gestacion")).toHaveValue("18");

  await page.locator("#h-anticoagulante").fill("Warfarina 5 mg diaria");
  await page.getByRole("button", { name: "Guardar versión nueva" }).click();
  await expect(page.getByText("Historia guardada como versión 2.")).toBeVisible();
  await expect(alertas).toContainText("Anticoagulado: Warfarina 5 mg diaria");
  await expect(alertas).toContainText("Embarazo (18 semanas)");

  // La versión anterior se conserva
  await page.getByRole("link", { name: "Ver versión 1" }).click();
  await expect(page.getByText(/Versión anterior 1/)).toBeVisible();
  await expect(page.getByText("Dolor en molar inferior derecho")).toBeVisible();
});

test("la asistente ve la historia pero no la modifica", async ({ page }) => {
  await entrar(page, "asistente@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}/historia`);
  await expect(page.getByText("Dolor en molar inferior derecho")).toHaveCount(0);   // muestra la vigente (versión 2)
  await expect(page.getByText("Versión vigente 2")).toBeVisible();
  await expect(page.getByRole("link", { name: "Actualizar historia" })).toHaveCount(0);
  await page.goto(`/pacientes/${pacienteId}/historia/nueva`);
  await expect(page).toHaveURL(new RegExp(`/pacientes/${pacienteId}/historia$`));
});

test("la asistente registra signos vitales y anula uno mal digitado", async ({ page }) => {
  await entrar(page, "asistente@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}/signos`);
  await page.locator("#s-temperatura_c").fill("45");
  await page.locator("#s-presion_sistolica").fill("120");
  await page.getByRole("button", { name: "Registrar signos vitales" }).click();
  await expect(page.getByText("Entre 34 y 42 °C.")).toBeVisible();
  await expect(page.getByText("Registra la presión completa (sistólica y diastólica).")).toBeVisible();

  await page.locator("#s-temperatura_c").fill("36,6");
  await page.locator("#s-presion_diastolica").fill("80");
  await page.locator("#s-peso_kg").fill("64.5");
  await page.locator("#s-talla_cm").fill("158");
  await page.getByRole("button", { name: "Registrar signos vitales" }).click();
  await expect(page.getByText("Signos vitales registrados.")).toBeVisible();
  const fila = page.getByRole("row").filter({ hasText: "120/80 mmHg" });
  await expect(fila).toContainText("36.6 °C");
  await expect(fila).toContainText("25.8");   // IMC calculado
  await expect(fila).toContainText("Milagros Ruiz Arana");

  await fila.getByText("Anular", { exact: true }).click();
  await fila.getByPlaceholder(/Motivo/).fill("Peso mal digitado");
  await fila.getByRole("button", { name: "Confirmar anulación" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Anulado: Peso mal digitado" })).toBeVisible();
});

test("recepción no ve la historia, pero sí las alertas en la ficha y en la agenda", async ({ page }) => {
  await entrar(page, "recepcion@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}`);
  const alertas = page.getByRole("note", { name: "Alertas clínicas" });
  await expect(alertas).toContainText("Alergia: Penicilina");
  await expect(alertas).toContainText("Anticoagulado: Warfarina 5 mg diaria");
  await expect(page.getByRole("link", { name: "Historia clínica" })).toHaveCount(0);
  await page.goto(`/pacientes/${pacienteId}/historia`);
  await expect(page).toHaveURL(new RegExp(`/pacientes/${pacienteId}$`));

  // En la agenda, la cita muestra las alertas (también al pasar el cursor)
  // Un jueves lejano: agenda.spec usa lunes y domingos; horarios.spec bloquea un 2–3 de marzo
  const jueves = new Date(Date.now() + 70 * 86_400_000);
  jueves.setUTCDate(jueves.getUTCDate() + ((11 - (jueves.getUTCDay() || 7)) % 7 || 7));
  let fecha = jueves.toISOString().slice(0, 10);
  if (/-(12-08|03-0[23])$/.test(fecha)) fecha = new Date(jueves.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  await page.goto(`/agenda/nueva?paciente=${pacienteId}&fecha=${fecha}`);
  await page.locator("#cita-profesional_id").selectOption({ label: "Dra. Lucía Valverde Ríos" });
  await page.locator("#cita-hora").fill("15:00");
  await page.getByRole("button", { name: "Agendar cita" }).click();
  await expect(page.getByText("Cita agendada.")).toBeVisible();
  const cita = page.getByRole("listitem").filter({ hasText: `Carmen ${apellidos}` }).filter({ hasText: "Programada" });
  await expect(cita).toContainText("Alergia: Penicilina");
  await expect(cita).toHaveAttribute("title", /Alertas registradas: Alergia: Penicilina/);
  page.once("dialog", (d) => void d.accept());
  await cita.getByRole("button", { name: /^Cancelar la cita/ }).click();
  await expect(page.getByRole("listitem").filter({ hasText: `Carmen ${apellidos}` }).filter({ hasText: "Programada" }))
    .toHaveCount(0);
});
