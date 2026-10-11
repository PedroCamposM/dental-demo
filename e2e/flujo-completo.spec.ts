import { expect, test } from "@playwright/test";
import { conEtapa8, conSupabaseLocal, dniAlAzar, entrar, registrarYEsperarFicha } from "./ayudantes";

// Flujo principal (CLAUDE.md, «Sistema de calidad»): alta de paciente → historia →
// odontograma → diagnóstico → plan → cita → evolución firmada → pago → control.
test.skip(!conSupabaseLocal || !conEtapa8, "Crea datos: solo contra Supabase local con las etapas 1 a 8 encendidas");
test.describe.configure({ mode: "serial" });

const MENDOZA = "Dra. Carla Mendoza Paredes";
const APELLIDO = `Flujo${dniAlAzar()}`;
const RESINA = "Restauración con resina compuesta";
let pacienteId = "";

/** Hoy en Lima y una hora libre (de noche: fuera del horario de atención y de las citas del seed). */
function hoyYHora(): { fecha: string; hora: string } | null {
  const lima = new Date(Date.now() - 5 * 3_600_000);
  const fecha = lima.toISOString().slice(0, 10);
  const minutos = Math.max(22 * 60 + 5 * Math.floor(Math.random() * 12), Math.ceil((lima.getUTCHours() * 60 + lima.getUTCMinutes() + 10) / 5) * 5);
  if (minutos > 23 * 60 + 25) return null;
  return { fecha, hora: `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}` };
}
const CUANDO = hoyYHora();

test("1. recepción da de alta al paciente", async ({ page }) => {
  await entrar(page, "recepcion@clinica-demo.example");
  await page.goto("/pacientes/nuevo");
  await page.getByLabel("Número de documento").fill(dniAlAzar());
  await page.getByLabel("Nombres").fill("Julio");
  await page.getByLabel("Apellidos").fill(APELLIDO);
  await page.getByLabel("Fecha de nacimiento").fill("1982-09-09");
  await page.getByLabel("Sexo").selectOption("masculino");
  await page.locator("#campo-telefono").fill("944999888");
  await page.getByLabel(/autoriza el tratamiento de sus datos/).check();
  await registrarYEsperarFicha(page);
  pacienteId = page.url().split("/pacientes/")[1]?.split("?")[0] ?? "";
  expect(pacienteId).toMatch(/^[0-9a-f-]{36}$/);
});

test("2. la odontóloga registra historia, odontograma, diagnóstico y plan", async ({ page }) => {
  expect(pacienteId, "depende de la prueba anterior").not.toBe("");
  await entrar(page, "mendoza@clinica-demo.example");

  // Historia clínica con una alergia: aparece en las alertas
  await page.goto(`/pacientes/${pacienteId}/historia`);
  await page.getByRole("link", { name: "Registrar historia" }).click();
  await page.locator("#h-motivo_consulta").fill("Sensibilidad al frío en molar inferior izquierdo");
  await page.locator("#h-alergias").fill("Penicilina");
  await page.getByRole("button", { name: "Guardar versión nueva" }).click();
  await expect(page.getByText("Historia guardada como versión 1.")).toBeVisible();
  await expect(page.getByRole("note", { name: "Alertas clínicas" })).toContainText("Alergia: Penicilina");

  // Odontograma inicial: caries oclusal en la 36
  await page.goto(`/pacientes/${pacienteId}/odontograma`);
  await page.getByRole("button", { name: "Crear odontograma" }).click();
  await page.getByRole("button", { name: "Pieza 36", exact: true }).click();
  await page.locator("#h-codigo").selectOption("caries");
  await page.getByRole("checkbox", { name: "Oclusal" }).check();
  await page.getByRole("radio", { name: /^CD / }).check();
  await page.getByRole("button", { name: "Agregar hallazgo" }).click();
  await expect(page.getByText("Hallazgo registrado: Lesión de caries dental.")).toBeVisible();

  // Del hallazgo al diagnóstico CIE-10
  await page.locator("tr[data-hallazgo]").filter({ hasText: "Lesión de caries dental" }).getByRole("link", { name: "Registrar diagnóstico" }).click();
  await page.locator("#d-cie10").fill("K02.1");
  await page.getByRole("radio", { name: "Definitivo" }).check();
  await page.getByRole("button", { name: "Registrar diagnóstico" }).click();
  await expect(page.getByText("Diagnóstico K02.1 registrado.")).toBeVisible();

  // Del diagnóstico al plan: restauración con el diagnóstico de origen; el paciente acepta
  await page.locator("li[data-diagnostico]").filter({ hasText: "K02.1" }).getByRole("link", { name: "Agregar al plan" }).click();
  await page.getByLabel("Título del plan").fill("Restauración de la 36");
  await page.getByLabel("Primera fase").fill("Operatoria");
  await page.getByRole("button", { name: "Crear plan" }).click();
  await page.locator("#i-procedimiento").selectOption({ label: `OPE-01 · ${RESINA}` });
  const dx = await page.locator("#i-diagnostico option").filter({ hasText: "K02.1" }).textContent();
  await page.locator("#i-diagnostico").selectOption({ label: dx ?? "" });
  await page.locator("#i-pieza").fill("36");
  await page.getByRole("button", { name: "Agregar al plan" }).click();
  await expect(page.getByText(`Agregado: ${RESINA}.`)).toBeVisible();
  await expect(page.locator("li[data-item]").filter({ hasText: RESINA })).toContainText("Dx K02.1");
  await page.getByRole("button", { name: "Registrar aceptación" }).click();
  await expect(page.getByRole("navigation", { name: "Planes del paciente" })).toContainText("Aceptado");
});

test("3. se agenda la cita de hoy", async ({ page }) => {
  test.skip(CUANDO === null, "Muy tarde en Lima para agendar hoy");
  expect(pacienteId, "depende de la prueba anterior").not.toBe("");
  // De noche, fuera del horario: solo el administrador fuerza la cita (queda con motivo).
  await entrar(page, "valverde@clinica-demo.example");
  await page.goto(`/agenda/nueva?paciente=${pacienteId}`);
  await page.locator("#cita-profesional_id").selectOption({ label: MENDOZA });
  await page.locator("#cita-fecha").fill(CUANDO?.fecha ?? "");
  await page.locator("#cita-hora").fill(CUANDO?.hora ?? "");
  await page.locator("#cita-forzada_motivo").fill("Paciente que solo puede de noche");
  await page.getByRole("button", { name: "Agendar cita" }).click();
  await expect(page.getByText("Cita agendada.")).toBeVisible();
});

test("4. la odontóloga atiende y firma la evolución: el ítem queda realizado y el plan terminado", async ({ page }) => {
  test.skip(CUANDO === null, "Muy tarde en Lima para agendar hoy");
  await entrar(page, "mendoza@clinica-demo.example");
  await page.goto("/agenda");
  const cita = page.getByRole("region", { name: MENDOZA }).getByRole("listitem").filter({ hasText: APELLIDO });
  await cita.getByRole("button", { name: /^Atender/ }).click();
  await page.waitForURL(new RegExp(`/pacientes/${pacienteId}/evolucion`));
  const borrador = page.getByRole("article", { name: /Evolución en borrador/ });
  await borrador.getByLabel("Descripción de lo realizado").fill("Remoción de caries y restauración oclusal con resina en la 36.");
  await borrador.getByRole("checkbox", { name: `Trabajado: ${RESINA} · pieza 36` }).check();
  await borrador.getByRole("checkbox", { name: `Terminado: ${RESINA} · pieza 36` }).check();
  page.once("dialog", (d) => void d.accept());
  await borrador.getByRole("button", { name: "Firmar y cerrar" }).click();
  await expect(page.getByRole("article", { name: /Evolución en borrador/ })).toHaveCount(0);
  await expect(page.locator("li[id^=evolucion-]").filter({ hasText: "Remoción de caries" })).toContainText(`Realizado ${RESINA}`);

  await page.goto(`/pacientes/${pacienteId}/plan`);
  await expect(page.getByRole("navigation", { name: "Planes del paciente" })).toContainText("Terminado");
});

test("5. recepción cobra y el paciente queda con su control programado", async ({ page }) => {
  test.skip(CUANDO === null, "Muy tarde en Lima para agendar hoy");
  await entrar(page, "recepcion@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}/plan`);
  const pagos = page.getByRole("region", { name: "Pagos", exact: true });
  await pagos.getByLabel("Monto (S/)").fill("180");
  await pagos.getByLabel("Método").selectOption("yape");
  await pagos.getByRole("button", { name: "Registrar pago" }).click();
  await expect(pagos).toContainText("Pagado S/ 180.00 · saldo S/ 0.00");

  // Regla 5: al terminar el plan se programa el control
  await page.goto(`/pacientes/${pacienteId}`);
  await expect(page.getByRole("region", { name: "Controles programados" })).toContainText("Control");
  await expect(page.getByRole("region", { name: "Controles programados" })).not.toContainText("No tiene controles pendientes");
});
