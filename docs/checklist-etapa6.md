# Checklist manual — Etapa 6 (evolución por sesión firmada, con adendas)

Se prueba en la vista previa de Vercel de la rama `claude/affectionate-maxwell-bjl90k`,
**después** de aplicar la migración 0912 y encender `HABILITAR_ETAPA6=1` en Vercel
(Preview), con las etapas 1 a 5 ya encendidas. Contraseña: `DemoTrujillo2026`.
Usa solo datos inventados.

## Preparación (admin `valverde` o recepción)

- [ ] Un paciente con un plan **aceptado** (al menos dos ítems pendientes).
- [ ] Agendarle una cita **hoy** con la Dra. Mendoza (si es fuera de su horario, el admin
      la fuerza con motivo).

## Recepción (`recepcion`)

- [ ] En la agenda de hoy, la cita muestra **En sala**; al pulsarlo queda «En sala».
- [ ] No aparece «Atender» ni enlaces a la evolución.
- [ ] En la ficha del paciente no hay pestaña «Evolución»; abrir `/pacientes/<id>/evolucion`
      a mano devuelve a la ficha.
- [ ] La agenda de otro día no ofrece «En sala».

## Odontóloga (`mendoza`)

- [ ] En la agenda, **Atender** abre la pestaña «Evolución» con un borrador a su nombre.
      Volver a la agenda: el botón dice «Continuar evolución» y abre el mismo borrador.
- [ ] «Firmar y cerrar» sin descripción: pide describir lo realizado.
- [ ] Escribir descripción, anestesia (tipo y cantidad), materiales, indicaciones y próxima
      cita sugerida; marcar un ítem como trabajado y terminado. **Guardar borrador**:
      todo queda guardado al recargar.
- [ ] Cantidad de anestesia sin tipo: mensaje claro.
- [ ] Marcar «Terminado» un ítem que depende de otro aún no realizado y firmar: no firma,
      explica el orden, y el borrador queda guardado.
- [ ] **Firmar y cerrar** (pide confirmación): la evolución pasa a «Evoluciones firmadas»
      con «Firmada por … (COP …)», el ítem terminado aparece «Realizado» (también en el
      plan) y la cita queda «Atendida» con «Ver evolución firmada».
- [ ] En la firmada no hay formulario de edición; **Agregar adenda** la suma con fecha y autor.
- [ ] Una firmada que respalda un ítem realizado no muestra «Anular».
- [ ] **Nueva evolución sin cita** abre otro borrador; **Anular borrador** con motivo lo
      deja tachado con el motivo.

## Otro odontólogo (`alvarado`)

- [ ] Ve el borrador de la Dra. Mendoza pero no lo puede editar ni firmar.
- [ ] Puede agregar adendas a una evolución firmada.

## Asistente (`asistente`)

- [ ] Ve la pestaña «Evolución» y lee las evoluciones; no hay botones para escribir,
      firmar, agregar adendas ni anular.
- [ ] Puede marcar «En sala» en la agenda; no ve «Atender».

## En todos los roles

- [ ] Las 132 notas de la v1 aparecen como evoluciones firmadas en su fecha original.
- [ ] El Tablero de gestión sigue igual (una cita «en sala» cuenta como agendada).
- [ ] Ninguna pantalla en blanco ni mensajes técnicos.
