# Checklist manual — Etapa 14 (atención rápida)

Se prueba después de aplicar la migración 0925 y encender `HABILITAR_ETAPA14=1` en Vercel
(con las etapas 1 a 11 encendidas). Contraseña: `DemoTrujillo2026`.

- [ ] Odontóloga: en la ficha de un paciente, botón **Atención rápida**. Asistente y recepción
      no lo ven; si escriben la dirección, vuelven a la ficha.
- [ ] Si el paciente ya tiene historia, alergias, anticoagulantes y medicación vienen
      precargados para confirmarlos.
- [ ] Sin motivo, sin responder alergias («Ninguna conocida» o escribirlas), sin
      anticoagulantes, sin examen, sin CIE-10, sin procedimiento o sin descripción: no se
      firma y dice qué falta. Lo escrito no se pierde.
- [ ] Los procedimientos que requieren consentimiento (p. ej. exodoncia) no aparecen en la
      lista y se explica por qué.
- [ ] Un procedimiento en varias piezas (p. ej. «16, 26») crea un ítem por pieza.
- [ ] «Firmar atención» pide confirmación y lleva al plan: «Atención rápida registrada y
      firmada»; el plan queda **Terminado** y ahí se cobra.
- [ ] En la historia aparece una versión nueva con el motivo; en Examen y diagnóstico, el
      examen y el diagnóstico; en Evolución, la nota firmada (sin editar, solo adendas).
- [ ] Si se registró una alergia, el banner de alertas la muestra.
- [ ] Si el procedimiento tiene control automático, aparece en «Controles programados».
