# Checklist manual — Etapa 20 (herramientas del superadministrador y turnos de caja)

Se prueba después de aplicar las migraciones 0933 y 0934 (lo hago yo con tu OK) y de encender
`HABILITAR_ETAPA20=1` en Vercel (Config, en Production y Preview), y luego redeploy.
**Orden: primero las migraciones, después la bandera.**

Para probar como clínica, crea una propia en `/registro` con un correo alias (por ejemplo
`tucorreo+prueba1@gmail.com`). La clínica de demostración no tiene plan, pagos ni
suspensión, y conserva su nombre.

## Superadministrador (agencia.hud@gmail.com)
- [ ] En «Clínicas de la plataforma», cada clínica tiene el botón «Ver ficha →», y la ficha abre.
- [ ] En la lista se ve «Activación: N de 5». En la ficha, los 5 pasos con ✓ o ○.
- [ ] Cambiar el nombre desde la ficha:
  - [ ] sin motivo, avisa;
  - [ ] con motivo, cambia en la lista y aparece en la bitácora de la ficha.
- [ ] Descuento:
  - [ ] guardar 20 % para tu clínica de prueba: en la lista aparece «−20 %»;
  - [ ] la clínica lo ve en «Plan y pagos»;
  - [ ] al reportar un pago, el monto ya viene con descuento;
  - [ ] guardar 0 lo quita.
- [ ] Avisos:
  - [ ] publicar un aviso «Informativo» a todas: lo ve todo el personal de cada clínica
        arriba de cada pantalla, y «Entendido» lo oculta en ese navegador;
  - [ ] un aviso «Importante» no se puede cerrar;
  - [ ] «Retirar» lo quita.
- [ ] Suspender (pide confirmar):
  - [ ] la clínica ve «La cuenta de la clínica está suspendida…»;
  - [ ] puede ver y exportar, pero no registrar (mensaje de solo lectura);
  - [ ] el resumen muestra «Suspendidas: 1»;
  - [ ] reactivar devuelve todo a la normalidad.
- [ ] «Ingresos»:
  - [ ] totales por mes y detalle de los pagos confirmados;
  - [ ] «Descargar CSV» abre bien en Excel, con tildes.
- [ ] «Bitácora» lista cada cambio con fecha, hora y tu correo.

## Clínica (administrador de tu clínica de prueba)
- [ ] En Configuración → «Datos de la clínica»:
  - [ ] cambiar el nombre: se ve en el encabezado y en los documentos;
  - [ ] con menos de 3 letras, avisa.
- [ ] Odontólogo, asistente y recepción no ven Configuración, ni el panel del superadministrador,
      ni `/plataforma/ingresos/csv`.

## Turnos de caja (admin o recepción, en Caja)
- [ ] «Abrir turno» con fondo S/ 100:
  - [ ] aparece «Turno abierto»;
  - [ ] cada pago que registres se suma al turno.
- [ ] Con el turno abierto, «Cerrar caja del día» avisa que primero hay que cerrar el turno.
- [ ] «Cerrar turno» (pide confirmar):
  - [ ] contando de menos, muestra la diferencia en rojo;
  - [ ] el turno queda en la lista y no se reabre.
- [ ] Abrir un segundo turno el mismo día (por ejemplo, la tarde) y cerrarlo.
- [ ] Cerrar la caja del día: el efectivo esperado es el de los pagos, sin los fondos.
- [ ] Sin abrir turnos, la caja funciona como antes.
- [ ] El odontólogo y la asistente no ven la caja.
