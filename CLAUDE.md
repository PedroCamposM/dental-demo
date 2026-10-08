# CLAUDE.md — Proyecto: software dental centrado en el plan de tratamiento

## Qué estamos construyendo

Es una **demo funcional para validar el producto con las primeras 10–15 clínicas**. Todavía no es el producto final.

- **Para quién:** consultorios y clínicas de 2 a 6 odontólogos en Perú, empezando por Trujillo, que hacen ortodoncia, rehabilitación o implantes.
- **Problema que resuelve:** la clínica pierde dinero en presupuestos que no se aceptan, tratamientos que quedan a medias, cuotas sin cobrar y pacientes que no vuelven a control.
- **Núcleo del sistema:** el **Plan de Tratamiento**. No es el odontograma ni la cita.
- **Promesa de la demo:** "Mira cuánta plata tienes en riesgo y a quién llamar hoy".

## Stack

- Next.js (App Router) + TypeScript estricto + Tailwind
- Supabase: Postgres, Auth y Row Level Security
- Despliegue en Vercel
- Tests: Vitest para la lógica y Playwright para los flujos de la demo
- Interfaz en español (Perú), montos en soles (S/) y zona horaria America/Lima

## Modelo de datos (núcleo)

- `clinica` es el tenant. **Toda tabla lleva `clinica_id` y tiene RLS activado.** Única excepción aprobada: `catalogo_hallazgo` (catálogo oficial de la NTS 188, igual para todas las clínicas, solo lectura, también con RLS).
- `usuario` con rol: admin, odontologo o recepcion.
- `paciente`: DNI, nombre, teléfono, fecha de nacimiento, apoderado (si es menor) y consentimiento de datos con fecha.
- `odontograma`: tipo inicial o evolución, hallazgos por pieza y superficie, con numeración FDI. Los hallazgos usan el catálogo de la NTS 188 (siglas oficiales, solo azul/rojo). Superficies con nombre anatómico: vestibular, palatino, lingual, mesial, distal, oclusal, incisal.
- `plan_tratamiento`: versiones y alternativas; estado propuesto, aceptado, en curso, detenido, terminado o rechazado; motivo de rechazo; fecha de vencimiento.
- `item_plan`: pieza, superficie, procedimiento, precio, odontólogo y estado clínico (propuesto, aceptado, programado, realizado o cancelado). El estado de cobro (pendiente, parcial o cobrado) **no** es un estado del ítem: se calcula desde los pagos aplicados. Un ítem puede estar cobrado sin estar realizado (adelantos).
- `cita`: se vincula a uno o más `item_plan` y tiene estado (programada, confirmada, atendida, no asistió o cancelada).
- `pago` y `cuota`: pertenecen a un plan. Cada pago tiene un solo método (efectivo, Yape, Plin, tarjeta o transferencia); un pago mixto son varios pagos. `pago_aplicacion` reparte cada pago entre ítems y/o cuotas. Los pagos no se editan: se anulan y se registran de nuevo.
- `seguimiento`: tipo (presupuesto, tratamiento detenido, cuota vencida o control), fecha programada, resultado y nota.
- `auditoria`: quién cambió qué y cuándo, para datos clínicos y pagos.

## Reglas de negocio que NO se rompen

1. Un ítem realizado debe tener una nota de evolución. Un ítem cobrado debe tener un pago asociado (se cumple por construcción: "cobrado" se calcula desde `pago_aplicacion`).
2. Los datos clínicos no se borran nunca. Se anulan con un registro en la auditoría y la historia clínica se conserva a largo plazo.
3. Al terminar un plan, el sistema crea automáticamente un seguimiento de control.
4. Un plan se considera detenido cuando tiene ítems aceptados sin realizar y no tiene cita en los próximos 30 días.
5. Los montos se guardan en céntimos (enteros), nunca como float.
6. Los diagnósticos usan códigos CIE-10.
7. La nomenclatura del odontograma sigue la **NTS 188-MINSA/DGIESP-2022**. **No inventar símbolos ni colores.** Si falta el documento de la norma, pedirlo antes de implementar.

## Tablero "dinero en riesgo" (pantalla principal)

Muestra estos indicadores, siempre en soles:

- Valor presentado vs. valor aceptado en el mes
- Presupuestos abiertos, ordenados por antigüedad
- Tratamientos detenidos y cuánto valen
- Cuotas vencidas
- Controles vencidos
- No-show del mes

Cada número abre una lista de pacientes con un botón para enviar mensaje.

## WhatsApp en la demo

Se usan enlaces `wa.me` con el mensaje pre-llenado desde plantillas editables. **Todavía no se usa la API de Meta**, porque tiene costo por mensaje y requiere aprobar las plantillas. Cada envío queda registrado en `seguimiento`.

## Fuera de alcance en la demo (no construir)

Facturación SUNAT, API de WhatsApp, IA, inventario, laboratorio, periodontograma completo, multisede, app móvil, portal del paciente, comisiones y lista de espera inteligente.

## Forma de trabajar

- Antes de cada módulo, proponer un plan y esperar aprobación.
- Trabajar en rebanadas pequeñas: migración, luego RLS, luego lógica con tests y al final la pantalla.
- Hacer commit al cerrar cada rebanada si los tests pasan.
- No marcar nada como terminado si `npm run build`, el lint, Vitest o Playwright fallan.
- Si algo no está claro en estas reglas, preguntar en lugar de suponer.

## Datos de demo

Un script `seed` crea "Clínica Dental Demo – Trujillo" con 3 odontólogos, unos 120 pacientes ficticios y 6 meses de historia. Debe incluir casos realistas: ortodoncias con cuotas atrasadas, presupuestos de implantes sin respuesta y controles vencidos. **Nunca usar datos reales de pacientes.**
