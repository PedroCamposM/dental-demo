# Checklist manual — Etapa 17 (suscripción con cobro manual)

Se prueba después de aplicar la migración 0930 y encender `HABILITAR_ETAPA17=1` en Vercel
(Production y Preview). **Orden: primero la 0930, después la bandera.**

## Superadministrador (panel «Clínicas de la plataforma»)
- [ ] «Datos de cobro»: pon tu Yape/Plin, banco, cuenta, CCI y titular. Guardar.
- [ ] «Precios»: aparecen Consultorio S/ 99 / S/ 990, Clínica S/ 179 / S/ 1,790, Clínica+ S/ 299 / S/ 2,990.
      Cambiar un precio y volver a dejarlo.
- [ ] Cada clínica muestra sus odontólogos activos y su tarifa; si tiene más odontólogos que su plan, lo marca en rojo.

## Administrador de una clínica de prueba
- [ ] Configuración → «Plan y pagos»: ve su plan, sus odontólogos activos, el plan que le corresponde,
      la tabla de precios y los datos para pagar.
- [ ] Reportar un pago sin número de operación o con fecha futura: avisa y no guarda.
- [ ] Reportar un pago con captura de Yape (PNG/JPG o PDF de hasta 1,5 MB): queda «Por confirmar» con el
      monto del plan (lo pone el sistema). Un segundo reporte espera al primero.
- [ ] Con la prueba vencida (solo lectura) también puede reportar su pago (el aviso rojo lleva a «Plan y pagos»).
- [ ] Odontólogo, asistente y recepción no ven «Plan y pagos».

## Confirmación
- [ ] El superadmin ve el pago en «Pagos por confirmar», abre la constancia y lo confirma: la clínica queda
      «Activo» hasta un mes (o un año) después; si estaba vencida, cuenta desde hoy.
- [ ] El administrador ve «Confirmado (plan hasta …)» y vuelve a registrar pacientes.
- [ ] Rechazar sin motivo no se puede; con motivo, el administrador ve «Rechazado: motivo».
- [ ] La clínica de demostración no tiene plan ni pagos.
