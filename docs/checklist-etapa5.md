# Checklist manual — Etapa 5 (plan de tratamiento con fases y versiones)

Se prueba en la vista previa de Vercel de la rama `claude/affectionate-maxwell-bjl90k`,
**después** de aplicar la migración 0911, cargar `seed_etapa5.sql` y encender
`HABILITAR_ETAPA5=1` en Vercel (Preview). Contraseña: `DemoTrujillo2026`.
Usa solo datos inventados.

## Odontóloga (`mendoza`)

- [ ] Un paciente del seed con presupuesto: la pestaña **Plan de tratamiento** muestra sus
      planes agrupados (si tiene alternativa B, aparece junto a la A), con estado, total,
      realizado y pagado. Cada ítem muestra su estado clínico y, aparte, si está pagado.
- [ ] En «Examen y diagnóstico», en un diagnóstico: **Agregar al plan**. Si no hay plan,
      pide crearlo primero.
- [ ] Crear un plan con su primera fase. Agregar un ítem del catálogo: el precio y la
      duración salen del catálogo si se dejan vacíos; elegir el diagnóstico de origen.
- [ ] Agregar una segunda fase y un ítem con precio ajustado que se hace «después de» el
      primero: aparece «después de #1».
- [ ] Precio negativo, pieza 19 o superficie palatina en una pieza inferior: mensaje claro.
- [ ] **Nueva alternativa**: copia fases, ítems y orden. **Nueva versión** de un plan
      aceptado: copia solo lo pendiente.
- [ ] Cancelar un ítem con motivo: queda tachado con el motivo.

## Recepción (`recepcion`)

- [ ] Ve los planes y los montos, pero no el diagnóstico (Dx) de los ítems ni el
      formulario para agregar ítems.
- [ ] **Registrar aceptación** de la alternativa B: la A queda «Rechazado» con el motivo
      «Se eligió la alternativa B».
- [ ] Aceptación parcial: marcar «Solo algunos ítems»; los no marcados quedan cancelados
      con «El paciente no lo aceptó».
- [ ] Registrar un rechazo con motivo.

## Asistente (`asistente`)

- [ ] Ve el plan; no hay botones para crear, cancelar, aceptar ni copiar.

## En todos los roles

- [ ] El Tablero de gestión sigue mostrando presupuestos abiertos y tratamientos
      detenidos como antes.
- [ ] Ninguna pantalla en blanco ni mensajes técnicos.
