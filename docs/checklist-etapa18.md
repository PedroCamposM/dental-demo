# Checklist manual — Etapa 18 (gestión de clientes)

Se prueba después de aplicar la migración 0931 y encender `HABILITAR_ETAPA18=1` en Vercel
(Production y Preview). **Orden: primero la 0931, después la bandera.** Para los correos, en
Production: `SMTP_USER`, `SMTP_PASS`, `CRON_SECRET` y `SUPABASE_SERVICE_ROLE_KEY` (ya puestas).

## Panel del superadministrador (`/plataforma`)
- [ ] Arriba, el resumen: ingreso mensual, en prueba, activas, vencidas, vencen en 7 días,
      conversión prueba → pago y vencieron este mes.
- [ ] «Por contactar»: las que vencen en 7 días, las vencidas y las de pago rechazado, con botones
      Correo y WhatsApp (WhatsApp solo si la clínica puso su teléfono en Configuración).
- [ ] Buscar por nombre, administrador o correo; filtrar por estado y por salud; «Quitar filtros».
- [ ] Cada clínica muestra su semáforo (Activa, Uso en baja, Sin uso) y su última actividad.

## Ficha de la clínica (clic en su nombre)
- [ ] Estado del plan, contacto, uso por semana de las últimas 8 semanas (solo cantidades),
      usuarios con su último ingreso, pagos y ajuste manual del plan.
- [ ] Notas internas: escribir una y verla en la lista (la clínica no la ve).
- [ ] No aparece ningún nombre de paciente ni dato clínico.

## Correos (desde contacto.hud@gmail.com)
- [ ] Al crear una clínica de prueba nueva llega el correo de bienvenida.
- [ ] Al confirmar o rechazar un pago, el administrador de la clínica recibe el aviso.
- [ ] Al día siguiente (9:00 de Lima), las clínicas que vencen en 7 días, las que vencieron y las
      que llevan 10 días sin uso reciben su aviso una sola vez; en la ficha aparece en
      «Correos automáticos enviados».
- [ ] Una clínica (cualquier rol) no entra a `/plataforma` ni a una ficha.
