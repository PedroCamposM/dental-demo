import { expect, test, type Page } from "@playwright/test";
import { conEtapa2, conSupabaseLocal, entrar } from "./ayudantes";

test.skip(!conSupabaseLocal || !conEtapa2, "Crea citas: solo contra Supabase local con la Etapa 2 encendida");
test.describe.configure({ mode: "serial" });

/** Lunes dentro de ~8 semanas (lejos de las citas del seed) en formato YYYY-MM-DD. */
function lunesLejano(): string {
  const d = new Date(Date.now() + 56 * 86_400_000);
  d.setUTCDate(d.getUTCDate() + ((8 - (d.getUTCDay() || 7)) % 7 || 7));
  return d.toISOString().slice(0, 10);
}
const LUNES = lunesLejano();
const DOMINGO = new Date(Date.parse(`${LUNES}T12:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10);
const MENDOZA = "Dra. Carla Mendoza Paredes";

async function abrirFichaDeUnPaciente(page: Page): Promise<string> {
  await page.goto("/pacientes");
  await page.getByRole("link").filter({ hasText: /, / }).first().click();
  const nombre = (await page.getByRole("heading", { level: 1 }).textContent())?.trim() ?? "";
  expect(nombre).not.toBe("");
  return nombre;
}

test("recepción agenda desde la ficha, la agenda evita choques y días sin atención", async ({ page }) => {
  await entrar(page, "recepcion@clinica-demo.example");
  const paciente = await abrirFichaDeUnPaciente(page);
  await page.getByRole("link", { name: "Agendar cita" }).click();
  await expect(page.getByText(paciente)).toBeVisible();

  await page.locator("#cita-profesional_id").selectOption({ label: MENDOZA });
  await page.locator("#cita-fecha").fill(LUNES);
  await page.locator("#cita-procedimiento_id").selectOption({ label: "Profilaxis y destartraje" });
  await page.locator("#cita-hora").fill("10:00");
  await expect(page.getByText("Los lunes atiende de 09:00 a 19:00 (Sillón 2). La cita sería de 10:00 a 10:45.")).toBeVisible();
  await page.getByRole("button", { name: "Agendar cita" }).click();

  await expect(page).toHaveURL(new RegExp(`/agenda\\?fecha=${LUNES}&creada=1`));
  await expect(page.getByText("Cita agendada.")).toBeVisible();
  const columna = page.getByRole("region", { name: MENDOZA });
  const cita = columna.getByRole("listitem").filter({ hasText: paciente });
  await expect(cita).toContainText("10:00 – 10:45");
  await expect(cita).toContainText("Profilaxis y destartraje");
  await expect(cita).toContainText("Sillón 2");
  await expect(cita).toContainText("Programada");

  // Choque con la misma profesional: lo rechaza la base y no se pierde lo elegido
  await columna.getByRole("link", { name: /Agendar con/ }).click();
  await page.getByPlaceholder("DNI, nombre o celular").fill(paciente.split(" ")[0] ?? paciente);
  await page.getByRole("button", { name: "Buscar" }).click();
  await page.getByRole("link").filter({ hasText: /, / }).first().click();
  await page.locator("#cita-fecha").fill(LUNES);
  await page.locator("#cita-hora").fill("10:30");
  await page.getByRole("button", { name: "Agendar cita" }).click();
  await expect(page.getByRole("alert").filter({ hasText: `${MENDOZA} ya tiene otra cita en ese horario.` })).toBeVisible();
  await expect(page.locator("#cita-hora")).toHaveValue("10:30");

  // Domingo: avisa antes de enviar y la base lo rechaza; recepción no puede forzar
  await page.locator("#cita-fecha").fill(DOMINGO);
  await expect(page.getByText("No atiende los domingos. La hora elegida queda fuera de su horario.")).toBeVisible();
  await expect(page.locator("#cita-forzada_motivo")).toHaveCount(0);
  await page.getByRole("button", { name: "Agendar cita" }).click();
  await expect(page.getByRole("alert").filter({ hasText: `${MENDOZA} no atiende los domingos.` })).toBeVisible();

  // Confirmar y cancelar
  await page.goto(`/agenda?fecha=${LUNES}`);
  await cita.getByRole("button", { name: /^Confirmar/ }).click();
  await expect(cita).toContainText("Confirmada");
  page.once("dialog", (d) => void d.accept());
  await cita.getByRole("button", { name: /^Cancelar la cita/ }).click();
  await expect(cita).toContainText("Cancelada");
});

test("el admin agenda fuera del horario con un motivo que queda a la vista", async ({ page }) => {
  await entrar(page, "valverde@clinica-demo.example");
  const paciente = await abrirFichaDeUnPaciente(page);
  await page.getByRole("link", { name: "Agendar cita" }).click();
  await page.locator("#cita-profesional_id").selectOption({ label: MENDOZA });
  await page.locator("#cita-fecha").fill(DOMINGO);
  await page.locator("#cita-hora").fill("11:00");
  await page.locator("#cita-forzada_motivo").fill("Urgencia por dolor");
  await page.getByRole("button", { name: "Agendar cita" }).click();

  await expect(page).toHaveURL(new RegExp(`/agenda\\?fecha=${DOMINGO}&creada=1`));
  const cita = page.getByRole("region", { name: MENDOZA }).getByRole("listitem").filter({ hasText: paciente });
  await expect(cita).toContainText("11:00 – 11:30");
  await expect(cita).toContainText("Fuera del horario (autorizado): Urgencia por dolor");
  await expect(page.getByRole("region", { name: MENDOZA })).toContainText("No atiende este día");
});

test("toda la clínica ve la agenda; el día sin atención lo explica", async ({ page }) => {
  await entrar(page, "asistente@clinica-demo.example");
  await page.getByRole("link", { name: "Agenda" }).click();
  await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
  await page.goto(`/agenda?fecha=${new Date(Date.parse(`${DOMINGO}T12:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10)}`);
  await expect(page.getByText("Nadie atiende los domingos según el horario de la clínica.")).toBeVisible();
});
