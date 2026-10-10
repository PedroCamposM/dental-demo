import { expect, test } from "@playwright/test";
import { conEtapa10, conSupabaseLocal, dniAlAzar, entrar, registrarYEsperarFicha } from "./ayudantes";

test.skip(!conSupabaseLocal || !conEtapa10, "Crea datos: solo contra Supabase local con la Etapa 10 encendida");
test.describe.configure({ mode: "serial" });

let pacienteId = "";
const APELLIDO = `Laboratorio${dniAlAzar()}`;
const LAB = `Lab E2E ${dniAlAzar()}`;
const lima = (dias: number) => {
  const d = new Date(Date.now() + dias * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(d);
};

test("el admin agrega un laboratorio", async ({ page }) => {
  await entrar(page, "valverde@clinica-demo.example");
  await page.goto("/configuracion/laboratorios");
  await page.getByLabel("Nombre").fill(LAB);
  await page.getByLabel("Teléfono (opcional)").fill("abc");
  await page.getByRole("button", { name: "Agregar laboratorio" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Teléfono" })).toBeVisible();
  await expect(page.getByLabel("Nombre")).toHaveValue(LAB);
  await page.getByLabel("Teléfono (opcional)").fill("944 123 456");
  await page.getByRole("button", { name: "Agregar laboratorio" }).click();
  await expect(page.getByRole("status").filter({ hasText: `Agregado: ${LAB}.` })).toBeVisible();
  await expect(page.getByRole("region", { name: "Laboratorios" })).toContainText(LAB);
});

test("la odontóloga prescribe una corona al laboratorio desde el plan del paciente", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  await page.goto("/pacientes/nuevo");
  await page.getByLabel("Número de documento").fill(dniAlAzar());
  await page.getByLabel("Nombres").fill("Raúl");
  await page.getByLabel("Apellidos").fill(APELLIDO);
  await page.getByLabel("Fecha de nacimiento").fill("1970-05-05");
  await page.getByLabel("Sexo").selectOption("masculino");
  await page.locator("#campo-telefono").fill("944777888");
  await page.getByLabel(/autoriza el tratamiento de sus datos/).check();
  await registrarYEsperarFicha(page);
  pacienteId = page.url().split("/pacientes/")[1]?.split("?")[0] ?? "";

  await page.goto(`/pacientes/${pacienteId}/plan`);
  await page.getByLabel("Título del plan").fill("Rehabilitación");
  await page.getByLabel("Primera fase").fill("Prótesis");
  await page.getByRole("button", { name: "Crear plan" }).click();
  await page.locator("#i-procedimiento").selectOption({ label: "REH-02 · Corona de zirconio" });
  await page.locator("#i-pieza").fill("36");
  await page.getByRole("button", { name: "Agregar al plan" }).click();
  await expect(page.getByText("Agregado: Corona de zirconio.")).toBeVisible();
  await page.getByRole("button", { name: "Registrar aceptación" }).click();
  await expect(page.getByRole("navigation", { name: "Planes del paciente" })).toContainText("Aceptado");

  await page.getByRole("navigation", { name: "Secciones del paciente" }).getByRole("link", { name: "Laboratorio" }).click();
  const nueva = page.getByRole("region", { name: "Nueva orden de laboratorio" });
  await nueva.getByLabel("Ítem del plan").selectOption({ label: "Corona de zirconio · pieza 36" });
  await nueva.getByLabel("Laboratorio", { exact: true }).selectOption({ label: LAB });
  await nueva.getByLabel("Tipo de trabajo").fill("Corona de zirconio monolítica");
  await nueva.getByLabel("Color").fill("A2");
  await nueva.getByLabel("Costo del laboratorio (S/, opcional)").fill("450");
  await nueva.getByRole("button", { name: "Registrar orden" }).click();
  await expect(nueva.getByRole("status")).toHaveText("Orden registrada: por enviar.");
  const ordenes = page.getByRole("region", { name: "Órdenes" });
  await expect(ordenes).toContainText("Corona de zirconio monolítica (pieza 36)");
  await expect(ordenes).toContainText("Por enviar");
  await expect(ordenes).toContainText("costo S/ 450.00");
});

test("la asistente registra el envío, ve el atraso y la recepción", async ({ page }) => {
  expect(pacienteId, "depende de la prueba anterior").not.toBe("");
  await entrar(page, "asistente@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}/laboratorio`);
  await expect(page.getByRole("region", { name: "Nueva orden de laboratorio" })).toHaveCount(0);   // no prescribe
  const orden = page.locator("li[data-orden]").first();
  await orden.getByText("Registrar envío").click();
  const envio = orden.getByRole("form", { name: /^Registrar envío/ });
  await envio.getByLabel("Fecha de envío").fill(lima(-10));
  await envio.getByLabel("Entrega prevista").fill(lima(-12));
  await envio.getByRole("button", { name: "Guardar" }).click();
  await expect(envio.getByRole("alert")).toContainText("anterior al envío");
  await envio.getByLabel("Entrega prevista").fill(lima(-3));
  await envio.getByRole("button", { name: "Guardar" }).click();
  await expect(orden).toContainText("En laboratorio");
  await expect(orden).toContainText("Atrasada 3 días");

  // En la página de Laboratorio aparece entre las atrasadas
  await page.getByRole("navigation", { name: "Secciones", exact: true }).getByRole("link", { name: "Laboratorio" }).click();
  await expect(page.getByRole("heading", { name: "Laboratorio", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: /Atrasadas/ })).toContainText(APELLIDO);

  // El laboratorio avisa otra fecha y luego entrega
  await page.goto(`/pacientes/${pacienteId}/laboratorio`);
  await orden.getByText("Cambiar entrega prevista").click();
  const cambio = orden.getByRole("form", { name: /^Cambiar entrega prevista/ });
  await cambio.getByLabel("Entrega prevista").fill(lima(2));
  await cambio.getByRole("button", { name: "Guardar" }).click();
  await expect(orden).not.toContainText("Atrasada");
  await orden.getByText("Registrar recepción").click();
  const recibir = orden.getByRole("form", { name: /^Registrar recepción/ });
  await recibir.getByLabel("Costo final (S/, opcional)").fill("460");
  await recibir.getByRole("button", { name: "Recibir" }).click();
  await expect(orden).toContainText("Recibida");
  await expect(orden).toContainText("costo S/ 460.00");
  await expect(orden.getByText("Registrar recepción")).toHaveCount(0);
});

test("recepción no ve el laboratorio", async ({ page }) => {
  await entrar(page, "recepcion@clinica-demo.example");
  await expect(page.getByRole("navigation", { name: "Secciones", exact: true }).getByRole("link", { name: "Laboratorio" })).toHaveCount(0);
  await page.goto("/laboratorio");
  await expect(page).not.toHaveURL(/\/laboratorio/);
});
