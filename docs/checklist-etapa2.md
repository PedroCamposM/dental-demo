# Checklist manual — Etapa 2 (catálogo, horarios y agenda)

Se prueba en la vista previa de Vercel de la rama `claude/affectionate-maxwell-bjl90k`,
**después** de correr «Aplicar migraciones», cargar `seed_etapa2.sql` y encender
`HABILITAR_ETAPA2=1` en Vercel (Preview). Contraseña: `DemoTrujillo2026`.
Lo que registres queda guardado en la base: usa datos inventados.

## Administrador (`valverde`)

- [ ] Configuración muestra tres pestañas: General · Procedimientos y aranceles ·
      Sillones y horarios.
- [ ] **Procedimientos y aranceles**: el catálogo aparece agrupado por especialidad
      (p. ej. Endodoncia multirradicular, S/ 750.00, 1 h 30 min, consentimiento «Sí»).
- [ ] Nuevo procedimiento con precio negativo: error claro y la especialidad sigue elegida.
- [ ] Nuevo procedimiento válido: aparece en la lista. Con el mismo código: «Ya hay un
      procedimiento con este código.».
- [ ] Editar el precio y desmarcar «Activo»: deja de verse; «Mostrar inactivos» lo muestra.
- [ ] **Sillones y horarios**: tres sillones; cada odontólogo de lunes a sábado de 9:00 a
      19:00 en su sillón.
- [ ] Asignar el Sillón 1 al Dr. Alvarado el lunes: «Ese sillón ya está asignado a Dra.
      Lucía Valverde Ríos…» y no cambia nada.
- [ ] Nuevo bloqueo (vacaciones de un odontólogo, dos días): aparece en la lista; si hay
      citas en ese rango, avisa cuántas reprogramar. Anularlo con motivo.
- [ ] El feriado del 8 de diciembre aparece en bloqueos y en la agenda de ese día.

## Recepción (`recepcion`)

- [ ] El menú muestra **Agenda**. La agenda de hoy tiene una columna por odontólogo con
      su horario y sillón, y las citas con paciente, hora y estado.
- [ ] «← Anterior», «Hoy», «Siguiente →» e «Ir» a una fecha funcionan.
- [ ] Desde la ficha de un paciente, «Agendar cita»: elegir odontólogo, fecha, hora y un
      procedimiento (la duración se ajusta sola). Debajo dice el horario de ese día.
- [ ] Agendar a la misma hora que otra cita del mismo odontólogo: lo rechaza con un
      mensaje claro y no se pierde lo elegido.
- [ ] Un domingo: avisa «No atiende los domingos» y no deja agendar.
- [ ] El 8 de diciembre: «Agenda bloqueada por feriado…».
- [ ] Confirmar una cita y cancelar otra (pide confirmación).
- [ ] La ficha del paciente muestra «Próximas citas».
- [ ] No ve la pestaña de Configuración.

## Administrador, otra vez

- [ ] Agendar un domingo con el motivo «Urgencia por dolor»: se agenda y la tarjeta dice
      «Fuera del horario (autorizado): Urgencia por dolor».

## Asistente y odontólogo

- [ ] Ven la Agenda y pueden agendar dentro del horario; no ven Configuración.

## General

- [ ] En la tablet la agenda se lee bien (una columna por odontólogo, una debajo de otra
      en pantallas angostas).
