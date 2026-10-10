import { expect, test } from "@playwright/test";
import { conSupabaseLocal, dniAlAzar, entrar, registrarYEsperarFicha } from "./ayudantes";

test.skip(!conSupabaseLocal, "Crea pacientes: solo contra Supabase local");

test("recepción registra un paciente, recibe aviso de duplicado y lo encuentra al buscar", async ({ page }) => {
  await entrar(page, "recepcion@clinica-demo.example");
  await page.getByRole("link", { name: "Pacientes", exact: true }).click();
  await page.getByRole("link", { name: "Nuevo paciente" }).click();

  const dni = dniAlAzar();
  const apellidos = `Prueba${dni}`;
  // Sin consentimiento ni campos obligatorios: errores en español, sin crear nada
  await page.getByRole("button", { name: "Registrar paciente" }).click();
  await expect(page.getByText("Ingresa el número de documento.")).toBeVisible();
  await expect(page.getByText(/Marca el consentimiento/)).toBeVisible();

  await page.getByLabel("Número de documento").fill(dni);
  await page.getByLabel("Nombres").fill("Lucía");
  await page.getByLabel("Apellidos").fill(apellidos);
  await page.getByLabel("Fecha de nacimiento").fill("1988-04-12");
  await page.getByLabel("Sexo").selectOption("femenino");
  await page.locator("#campo-telefono").fill("911 222 333");
  await page.getByLabel(/autoriza el tratamiento de sus datos/).check();
  await page.getByRole("button", { name: "Registrar paciente" }).click();
  await expect(page.getByText("Paciente registrado.")).toBeVisible();
  await expect(page.getByRole("heading", { name: `Lucía ${apellidos}` })).toBeVisible();

  // Mismo documento: error claro
  await page.goto("/pacientes/nuevo");
  await page.getByLabel("Número de documento").fill(dni);
  await page.getByLabel("Nombres").fill("Otra");
  await page.getByLabel("Apellidos").fill("Persona");
  await page.getByLabel("Fecha de nacimiento").fill("1990-01-01");
  await page.getByLabel("Sexo").selectOption("masculino");
  await page.locator("#campo-telefono").fill("922333444");
  await page.getByLabel(/autoriza el tratamiento de sus datos/).check();
  await page.getByRole("button", { name: "Registrar paciente" }).click();
  await expect(page.getByText(/Ya hay un paciente registrado con este documento/)).toBeVisible();

  // Mismo nombre (sin tildes) y fecha, otro documento: aviso de posible duplicado
  await page.goto("/pacientes/nuevo");
  await page.getByLabel("Número de documento").fill(dniAlAzar());
  await page.getByLabel("Nombres").fill("LUCIA");
  await page.getByLabel("Apellidos").fill(apellidos.toLowerCase());
  await page.getByLabel("Fecha de nacimiento").fill("1988-04-12");
  await page.getByLabel("Sexo").selectOption("femenino");
  await page.locator("#campo-telefono").fill("933444555");
  await page.getByLabel(/autoriza el tratamiento de sus datos/).check();
  await page.getByRole("button", { name: "Registrar paciente" }).click();
  await expect(page.getByText("Posible paciente duplicado")).toBeVisible();
  await expect(page.getByRole("link", { name: `Lucía ${apellidos}` })).toBeVisible();

  // Buscar por DNI y por nombre sin tildes
  await page.goto(`/pacientes?q=${dni}`);
  await expect(page.getByText(`${apellidos}, Lucía`)).toBeVisible();
  await page.goto(`/pacientes?q=lucia ${apellidos.toLowerCase()}`);
  await expect(page.getByText(`${apellidos}, Lucía`)).toBeVisible();
});

test("un menor exige apoderado y la edición guarda la filiación", async ({ page }) => {
  await entrar(page, "asistente@clinica-demo.example");
  await page.goto("/pacientes/nuevo");
  const dni = dniAlAzar();
  await page.getByLabel("Número de documento").fill(dni);
  await page.getByLabel("Nombres").fill("Mateo");
  await page.getByLabel("Apellidos").fill(`Menor${dni}`);
  await page.getByLabel("Fecha de nacimiento").fill("2016-06-15");
  await page.getByLabel("Sexo").selectOption("masculino");
  await expect(page.getByText("Apoderado (obligatorio: es menor de edad)")).toBeVisible();
  await page.getByLabel(/autoriza el tratamiento de sus datos/).check();
  await page.getByRole("button", { name: "Registrar paciente" }).click();
  await expect(page.getByText("Es menor de edad: ingresa el nombre del apoderado.")).toBeVisible();
  // Tras un error del servidor, lo elegido se conserva (no hay que volver a elegirlo).
  await expect(page.getByLabel("Sexo")).toHaveValue("masculino");
  await expect(page.getByLabel(/autoriza el tratamiento de sus datos/)).toBeChecked();

  await page.getByLabel("Nombre completo").fill("Carmen Ruiz Vega");
  await page.locator("#campo-apoderado_dni").fill("10000099");
  await page.locator("#campo-apoderado_telefono").fill("944555666");
  await page.locator("#campo-apoderado_parentesco").fill("madre");
  await registrarYEsperarFicha(page);
  await expect(page.getByText("Carmen Ruiz Vega (madre)")).toBeVisible();

  await page.getByRole("link", { name: "Editar filiación" }).click();
  await page.getByLabel("Ocupación").fill("Estudiante de primaria");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();
  await expect(page.getByText("Estudiante de primaria")).toBeVisible();
});

test("admin fusiona un registro duplicado y el duplicado queda anulado, no borrado", async ({ page }) => {
  await entrar(page, "valverde@clinica-demo.example");
  const apellidos = `Fusion${dniAlAzar()}`;
  const crear = async (dni: string, confirmar: boolean) => {
    await page.goto("/pacientes/nuevo");
    await page.getByLabel("Número de documento").fill(dni);
    await page.getByLabel("Nombres").fill("Elena");
    await page.getByLabel("Apellidos").fill(apellidos);
    await page.getByLabel("Fecha de nacimiento").fill("1970-07-07");
    await page.getByLabel("Sexo").selectOption("femenino");
    await page.locator("#campo-telefono").fill("955666777");
    await page.getByLabel(/autoriza el tratamiento de sus datos/).check();
    await registrarYEsperarFicha(page, confirmar);
    return page.url().split("/pacientes/")[1]?.split("?")[0] ?? "";
  };
  const conservar = await crear(dniAlAzar(), false);
  const duplicado = await crear(dniAlAzar(), true);

  await page.goto(`/pacientes/${conservar}`);
  await page.getByRole("link", { name: "Fusionar duplicado" }).click();
  await page.locator(`input[name="duplicado"][value="${duplicado}"]`).check();
  await page.getByRole("button", { name: "Fusionar registros" }).click();
  await expect(page.getByText(/Escribe el motivo/)).toBeVisible();
  await expect(page.locator(`input[name="duplicado"][value="${duplicado}"]`)).toBeChecked();
  await page.getByLabel(/Motivo/).fill("Se registró dos veces en recepción");
  await page.getByRole("button", { name: "Fusionar registros" }).click();
  await expect(page.getByText("Registros fusionados. El duplicado quedó anulado.")).toBeVisible();

  await page.goto(`/pacientes/${duplicado}`);
  await expect(page.getByText(/Registro anulado: Fusionado con Elena/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Editar filiación" })).toHaveCount(0);
});

test("recepción no ve la opción de fusionar", async ({ page }) => {
  await entrar(page, "recepcion@clinica-demo.example");
  await page.goto("/pacientes");
  // No uno de la prueba de fusión (corre en paralelo y anula su duplicado).
  await page.getByRole("link").filter({ hasText: /, / }).filter({ hasNotText: "Fusion" }).first().click();
  await expect(page.getByRole("link", { name: "Editar filiación" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Fusionar duplicado" })).toHaveCount(0);
});
