import { expect, test } from "@playwright/test";
import { conSupabaseLocal, dniAlAzar, entrar } from "./ayudantes";

test.skip(!conSupabaseLocal, "Crea pacientes: solo contra Supabase local");

test("recepción registra un paciente, recibe aviso de duplicado y lo encuentra al buscar", async ({ page }) => {
  await entrar(page, "recepcion@clinica-demo.example");
  await page.getByRole("link", { name: "Pacientes" }).click();
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
  await page.getByLabel("Celular", { exact: true }).fill("911 222 333");
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
  await page.getByLabel("Celular", { exact: true }).fill("922333444");
  await page.getByLabel(/autoriza el tratamiento de sus datos/).check();
  await page.getByRole("button", { name: "Registrar paciente" }).click();
  await expect(page.getByText("Ya hay un paciente registrado con este documento.")).toBeVisible();

  // Mismo nombre (sin tildes) y fecha, otro documento: aviso de posible duplicado
  await page.goto("/pacientes/nuevo");
  await page.getByLabel("Número de documento").fill(dniAlAzar());
  await page.getByLabel("Nombres").fill("LUCIA");
  await page.getByLabel("Apellidos").fill(apellidos.toLowerCase());
  await page.getByLabel("Fecha de nacimiento").fill("1988-04-12");
  await page.getByLabel("Sexo").selectOption("femenino");
  await page.getByLabel("Celular", { exact: true }).fill("933444555");
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

  await page.getByLabel("Nombre completo").fill("Carmen Ruiz Vega");
  await page.getByLabel("DNI", { exact: true }).fill("10000099");
  await page.getByLabel("Celular", { exact: true }).last().fill("944555666");
  await page.getByLabel("Parentesco", { exact: true }).last().fill("madre");
  await page.getByLabel(/autoriza el tratamiento de sus datos/).check();
  await page.getByRole("button", { name: "Registrar paciente" }).click();
  await expect(page.getByText("Paciente registrado.")).toBeVisible();
  await expect(page.getByText("Carmen Ruiz Vega (madre)")).toBeVisible();

  await page.getByRole("link", { name: "Editar filiación" }).click();
  await page.getByLabel("Ocupación").fill("Estudiante de primaria");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();
  await expect(page.getByText("Estudiante de primaria")).toBeVisible();
});
