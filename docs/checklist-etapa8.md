# Checklist manual — Etapa 8 (seguimiento clínico, Tablero clínico y caja)

Se prueba en la vista previa de Vercel de la rama `claude/affectionate-maxwell-bjl90k`,
**después** de aplicar las migraciones 0917 y 0918 y de encender `HABILITAR_ETAPA8=1` en
Vercel (Preview), con las etapas 1 a 7 ya encendidas. Contraseña: `DemoTrujillo2026`.
Usa solo datos inventados.

## Controles automáticos (regla 5)

- [ ] Admin: en el catálogo, un procedimiento de cirugía con «genera control a los 7 días».
- [ ] Odontóloga: plan aceptado con ese procedimiento y otro más. Atender, terminar la
      cirugía en la evolución y firmar → el plan pasa a «En curso» y aparece un control
      «Retiro de puntos» a 7 días (Tablero de gestión / ficha cuando venza).
- [ ] Terminar el último ítem → el plan queda «Terminado» y se crea el control de los
      6 meses.
- [ ] Otro plan: realizar un ítem y **cancelar** el último pendiente → el plan también
      queda «Terminado» con su control.
- [ ] Hacer una versión nueva de un plan en curso: el anterior queda «Reemplazado» (no
      «Terminado»).

## Tablero clínico

- [ ] Odontóloga y asistente: menú **Tablero clínico** con evoluciones sin firmar,
      consentimientos pendientes (incluye ítems que requieren consentimiento sin formato),
      controles vencidos, tratamientos en curso y detenidos. Cada fila abre al paciente.
- [ ] Un control vencido desaparece si el paciente tiene una cita agendada o fue atendido
      en o después de la fecha del control (igual en el Tablero de gestión).
- [ ] Recepción: no ve el menú; abrir `/clinico` la lleva al Tablero de gestión.

## Pagos y caja

- [ ] Recepción: en el plan aceptado, región **Pagos**: un monto mayor al saldo da
      «excede el saldo» y no borra lo escrito. Registrar un pago en Yape con N° de
      operación → aparece en la lista; «Pagado» y «saldo» coinciden con la tarjeta del plan.
- [ ] Plan con cuotas (ortodoncia del seed): el pago se aplica a la cuota más antigua y el
      ítem también avanza en su cobro.
- [ ] Odontóloga y asistente: ven los pagos, pero no registran ni anulan.
- [ ] Recepción: **Anular** un pago con motivo → queda tachado con el motivo.
- [ ] Menú **Caja**: resumen del día por método y por profesional, lista de pagos.
      «← Anterior» / «Siguiente →» cambian de día; no deja ir al futuro.
- [ ] **Cerrar caja del día** con el efectivo contado (pide confirmar) → «Caja cerrada»
      con esperado, contado y diferencia.
- [ ] Con el día cerrado: un pago nuevo da «La caja de ese día ya se cerró…»; en el plan,
      los pagos de ese día ya no muestran «Anular» sino «se corrige con un ajuste en Caja».
- [ ] **Registrar ajuste** (monto con signo, método y motivo) → queda en «Ajustes
      posteriores al cierre» con autor y hora.
- [ ] Odontóloga: no ve el menú Caja; `/caja` la devuelve al inicio.

Nota: cerrar la caja de **hoy** bloquea los pagos que lleguen más tarde ese mismo día
(se corrigen con un ajuste). Conviene cerrarla al final de la jornada.
