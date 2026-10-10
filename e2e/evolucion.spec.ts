import { expect, test, type Page } from "@playwright/test";
import { conEtapa6, conSupabaseLocal, dniAlAzar, entrar, registrarYEsperarFicha } from "./ayudantes";

test.skip(!conSupabaseLocal || !conEtapa6, "Crea datos: solo contra Supabase local con la Etapa 6 encendida");
test.describe.configure({ mode: "serial" });

const MENDOZA = "Dra. Carla Mendoza Paredes";
const APELLIDO = `Sesion${dniAlAzar()}`;
let pacienteId = "";

/** Hoy en Lima y una hora libre (de noche, fuera del horario de atención y de las citas del seed). */
function hoyYHora(): { fecha: string; hora: string } | null {
  const lima = new Date(Date.now() - 5 * 3_600_000);
  const fecha = lima.toISOString().slice(0, 10);
  // Hora al azar entre las 22:00 y las 23:00 para que un reintento no choque con la cita anterior.
  const minutos = Math.max(22 * 60 + 5 * Math.floor(Math.random() * 12), Math.ceil((lima.getUTCHours() * 60 + lima.getUTCMinutes() + 10) / 5) * 5);
  if (minutos > 23 * 60 + 25) return null;   // la cita (30 min) termina el mismo día
  return { fecha, hora: `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}` };
}
const CUANDO = hoyYHora();

async function crearPacienteConPlan(page: Page) {
  await page.goto("/pacientes/nuevo");
  await page.getByLabel("Número de documento").fill(dniAlAzar());
  await page.getByLabel("Nombres").fill("Rosa");
  await page.getByLabel("Apellidos").fill(APELLIDO);
  await page.getByLabel("Fecha de nacimiento").fill("1985-04-12");
  await page.getByLabel("Sexo").selectOption("femenino");
  await page.locator("#campo-telefono").fill("944555666");
  await page.getByLabel(/autoriza el tratamiento de sus datos/).check();
  await registrarYEsperarFicha(page);
  pacienteId = page.url().split("/pacientes/")[1]?.split("?")[0] ?? "";
  expect(pacienteId).toMatch(/^[0-9a-f-]{36}$/);

  await page.goto(`/pacientes/${pacienteId}/plan`);
  await page.getByLabel("Título del plan").fill("Prevención");
  await page.getByLabel("Primera fase").fill("Higiene");
  await page.getByRole("button", { name: "Crear plan" }).click();
  await expect(page.getByRole("heading", { name: "Prevención" })).toBeVisible();
  for (const [opcion, nombre] of [["PRE-01 · Profilaxis y destartraje", "Profilaxis y destartraje"],
    ["PRE-02 · Aplicación de flúor", "Aplicación de flúor"]] as const) {
    await page.locator("#i-procedimiento").selectOption({ label: opcion });
    await page.getByRole("button", { name: "Agregar al plan" }).click();
    await expect(page.getByText(`Agregado: ${nombre}.`)).toBeVisible();
  }
  await page.getByRole("button", { name: "Registrar aceptación" }).click();
  await expect(page.getByRole("navigation", { name: "Planes del paciente" })).toContainText("Aceptado");
}

test("el admin agenda hoy a una paciente con plan aceptado", async ({ page }) => {
  test.skip(CUANDO === null, "Muy tarde en Lima para agendar hoy");
  await entrar(page, "valverde@clinica-demo.example");
  await crearPacienteConPlan(page);
  await page.goto(`/agenda/nueva?paciente=${pacienteId}`);
  await page.locator("#cita-profesional_id").selectOption({ label: MENDOZA });
  await page.locator("#cita-fecha").fill(CUANDO?.fecha ?? "");
  await page.locator("#cita-hora").fill(CUANDO?.hora ?? "");
  await page.locator("#cita-forzada_motivo").fill("Paciente que solo puede de noche");
  await page.getByRole("button", { name: "Agendar cita" }).click();
  await expect(page.getByText("Cita agendada.")).toBeVisible();
});

test("recepción marca «en sala» y no ve la evolución", async ({ page }) => {
  test.skip(CUANDO === null, "Muy tarde en Lima para agendar hoy");
  expect(pacienteId, "depende de la prueba anterior").not.toBe("");
  await entrar(page, "recepcion@clinica-demo.example");
  await page.goto("/agenda");
  const cita = page.getByRole("region", { name: MENDOZA }).getByRole("listitem").filter({ hasText: APELLIDO });
  await expect(cita.getByRole("button", { name: /^Atender/ })).toHaveCount(0);
  await cita.getByRole("button", { name: /^Marcar en sala/ }).click();
  await expect(cita).toContainText("En sala");
  await page.goto(`/pacientes/${pacienteId}`);
  await expect(page.getByRole("link", { name: "Evolución", exact: true })).toHaveCount(0);
  await page.goto(`/pacientes/${pacienteId}/evolucion`);
  await expect(page).toHaveURL(new RegExp(`/pacientes/${pacienteId}$`));
});

test("la odontóloga atiende, escribe la evolución, la firma y agrega una adenda", async ({ page }) => {
  test.skip(CUANDO === null, "Muy tarde en Lima para agendar hoy");
  expect(pacienteId, "depende de la prueba anterior").not.toBe("");
  await entrar(page, "mendoza@clinica-demo.example");
  await page.goto("/agenda");
  const cita = page.getByRole("region", { name: MENDOZA }).getByRole("listitem").filter({ hasText: APELLIDO });
  await cita.getByRole("button", { name: /^Atender/ }).click();
  await page.waitForURL(new RegExp(`/pacientes/${pacienteId}/evolucion`));

  const borrador = page.getByRole("article", { name: /Evolución en borrador/ });
  await expect(borrador).toBeVisible();
  // Sin descripción no se firma
  page.once("dialog", (d) => void d.accept());
  await borrador.getByRole("button", { name: "Firmar y cerrar" }).click();
  await expect(borrador.getByText("Describe lo realizado en la sesión antes de firmar.")).toBeVisible();

  await borrador.getByLabel("Descripción de lo realizado").fill("Profilaxis con ultrasonido y pulido coronal.");
  await borrador.getByLabel("Indicaciones al paciente").fill("Cepillado tres veces al día.");
  await borrador.getByRole("checkbox", { name: "Trabajado: Profilaxis y destartraje" }).check();
  await borrador.getByRole("checkbox", { name: "Terminado: Profilaxis y destartraje" }).check();
  await borrador.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(borrador.getByText("Borrador guardado.")).toBeVisible();
  await expect(borrador.getByLabel("Descripción de lo realizado")).toHaveValue("Profilaxis con ultrasonido y pulido coronal.");

  page.once("dialog", (d) => void d.accept());
  await borrador.getByRole("button", { name: "Firmar y cerrar" }).click();
  await expect(page.getByRole("article", { name: /Evolución en borrador/ })).toHaveCount(0);
  const firmada = page.locator("li[id^=evolucion-]").filter({ hasText: "Profilaxis con ultrasonido" });
  await expect(firmada).toContainText(/Firmada por Dra\. Carla Mendoza Paredes \(COP \d+\)/);
  await expect(firmada).toContainText("Realizado Profilaxis y destartraje");
  await expect(firmada).toContainText("Cepillado tres veces al día.");

  // Firmada: solo adendas
  await firmada.getByText("Agregar adenda").click();
  await firmada.getByLabel("Texto de la adenda").fill("Se indicó control en seis meses.");
  await firmada.getByRole("button", { name: "Guardar adenda" }).click();
  await expect(firmada).toContainText("Se indicó control en seis meses.");
  await expect(firmada.getByText("Anular")).toHaveCount(0);   // respalda un ítem realizado

  // El plan y la agenda lo reflejan
  await page.goto(`/pacientes/${pacienteId}/plan`);
  await expect(page.locator("li[data-item]").filter({ hasText: "Profilaxis y destartraje" })).toContainText("Realizado");
  await expect(page.locator("li[data-item]").filter({ hasText: "Aplicación de flúor" })).toContainText("Aceptado");
  await page.goto("/agenda");
  const atendida = page.getByRole("region", { name: MENDOZA }).getByRole("listitem").filter({ hasText: APELLIDO });
  await expect(atendida).toContainText("Atendida");
  await expect(atendida.getByRole("link", { name: "Ver evolución firmada" })).toBeVisible();
});

test("la asistente lee la evolución pero no la edita", async ({ page }) => {
  test.skip(CUANDO === null, "Muy tarde en Lima para agendar hoy");
  expect(pacienteId, "depende de la prueba anterior").not.toBe("");
  await entrar(page, "asistente@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}/evolucion`);
  await expect(page.getByText("Profilaxis con ultrasonido y pulido coronal.")).toBeVisible();
  await expect(page.getByText("Agregar adenda")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Nueva evolución sin cita" })).toHaveCount(0);
});
