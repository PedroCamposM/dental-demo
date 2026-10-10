# Checklist manual — Etapa 10 (laboratorio)

Se prueba en la vista previa de Vercel de la rama `claude/affectionate-maxwell-bjl90k`,
**después** de aplicar la migración 0921, cargar `seed_etapa10.sql` y encender
`HABILITAR_ETAPA10=1` en Vercel (Preview), con las etapas 1 a 9 ya encendidas.
Contraseña: `DemoTrujillo2026`. Usa solo datos inventados.

## Laboratorios (administrador)

- [ ] **Configuración → Laboratorios**: aparecen los dos de la demo. Agregar uno; un
      teléfono con letras da error y no se pierde lo escrito; un nombre repetido se rechaza.
- [ ] Desactivar uno: ya no se ofrece en órdenes nuevas; sus órdenes se conservan.

## Órdenes

- [ ] Odontóloga: paciente con un plan aceptado que tenga una corona. Pestaña
      **Laboratorio** → «Nueva orden»: ítem del plan, laboratorio, tipo de trabajo, color,
      indicaciones y costo (opcional). Queda «Por enviar» con la pieza del ítem.
- [ ] Asistente: no ve «Nueva orden» (no prescribe), pero puede **Registrar envío**
      (fecha de envío y entrega prevista). Una entrega anterior al envío o un envío futuro
      se rechazan.
- [ ] Con la entrega prevista ya pasada, la orden muestra «Atrasada N días».
- [ ] «Cambiar entrega prevista» (el laboratorio avisó otra fecha): deja de estar atrasada.
- [ ] «Registrar recepción» con el costo final: queda «Recibida» con su fecha y costo.
- [ ] «Cancelar» exige motivo; una orden recibida ya no se cancela.
- [ ] Menú **Laboratorio**: atrasadas (la de la demo), por llegar, por enviar y recibidas
      en los últimos 30 días; cada fila lleva a la ficha del paciente.
- [ ] **Tablero clínico**: «Trabajos de laboratorio por llegar», con los atrasados en rojo.
- [ ] Recepción: no ve el menú ni la pestaña; `/laboratorio` la devuelve al inicio.
