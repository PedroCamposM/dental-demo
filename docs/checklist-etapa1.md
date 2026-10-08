# Checklist manual — Etapa 1 (v2)

Se prueba en la **vista previa de Vercel** de la rama `claude/affectionate-maxwell-bjl90k`
(Vercel → Deployments → el último de esa rama → Visit). Producción no cambia hasta
fusionar a `main`.

> La vista previa usa la **misma base** que producción: lo que registres queda guardado
> (los datos clínicos no se borran). Usa solo datos inventados.

Contraseña de todos: `DemoTrujillo2026`. Correos `@clinica-demo.example`.
Marca cada casilla; si algo falla, anota el paso, el rol y una captura.

## 1. Recepción (`recepcion`)

- [ ] Entra y ve el tablero «Dinero en riesgo hoy» como antes.
- [ ] El menú muestra **Tablero, Pacientes y Plantillas**; no muestra Configuración.
- [ ] **Pacientes**: busca por DNI de un paciente existente, por nombre sin tildes y por
      celular. Aparece en la lista.
- [ ] **Nuevo paciente** con DNI de 7 dígitos: muestra un error claro en el campo.
- [ ] Registra un adulto inventado (DNI de 8 dígitos, sexo, celular de 9 dígitos y el
      consentimiento): abre su ficha con «Paciente registrado.».
- [ ] Intenta registrar otro paciente con el **mismo DNI**: avisa que ya existe.
- [ ] Registra otro con el mismo nombre y fecha de nacimiento pero otro DNI: aparece
      «Posible paciente duplicado»; «No es la misma persona: crear de todas formas» lo crea.
- [ ] Al provocar un error (p. ej. dejar vacío el celular), el **sexo y el consentimiento
      siguen marcados**.
- [ ] En una ficha: puede **Editar filiación**; **no** ve «Fusionar duplicado».

## 2. Asistente (`asistente`)

- [ ] Entra; el encabezado dice «Milagros Ruiz Arana · Asistente».
- [ ] El menú muestra **Tablero y Pacientes** (sin Plantillas ni Configuración).
- [ ] Registra un **menor** (nacido hace menos de 18 años): aparece el bloque
      «Apoderado (obligatorio: es menor de edad)». Sin apoderado no deja guardar; con
      nombre, DNI, celular y parentesco, sí.
- [ ] No ve «Fusionar duplicado».

## 3. Odontólogo (`mendoza` o `alvarado`)

- [ ] Entra; el menú muestra **Tablero y Pacientes** (sin Plantillas ni Configuración).
- [ ] Puede registrar y editar pacientes.
- [ ] **Bloquear pantalla**: aparece «Pantalla bloqueada». Al recargar la página o abrir
      la app en otra pestaña, sigue bloqueada.
- [ ] Con una contraseña incorrecta dice «Contraseña incorrecta.»; con la correcta vuelve
      a la pantalla donde estaba.

## 4. Administrador (`valverde`)

- [ ] El menú muestra **Tablero, Pacientes, Plantillas y Configuración**.
- [ ] **Configuración**: cambia el cierre por inactividad a **5 minutos** y guarda.
- [ ] Deja la app quieta: al minuto 4 aparece «Tu sesión se cerrará en … s»;
      «Seguir trabajando» la mantiene abierta.
- [ ] Déjala quieta otra vez sin tocar: a los 5 minutos vuelve al login.
- [ ] Vuelve a entrar y deja la inactividad en **15 minutos**.
- [ ] **Fusionar**: abre la ficha del paciente que quieres conservar → «Fusionar
      duplicado» → elige el duplicado. Sin motivo muestra «Escribe el motivo…» y conserva
      lo elegido; con motivo, «Registros fusionados. El duplicado quedó anulado.».
- [ ] La ficha del duplicado dice «Registro anulado: Fusionado con …» y ya no se edita.

## 5. General

- [ ] En la tablet o en un celular, el formulario de paciente se lee y se llena sin
      hacer zoom.
- [ ] Ninguna pantalla queda en blanco ni muestra errores técnicos en inglés.

Cuando todo esté marcado: fusionar la rama a `main` y agregar `HABILITAR_ETAPA1=1`
también en **Production** (Vercel → Settings → Environment Variables).
