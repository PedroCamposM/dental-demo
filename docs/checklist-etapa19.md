# Checklist manual — Etapa 19 (equipo de la clínica y mejoras)

Se prueba después de aplicar la migración 0932, poner en Supabase las plantillas de correo de
invitación y de recuperar contraseña (lo hago yo con tu OK) y encender `HABILITAR_ETAPA19=1` en
Vercel (Production y Preview). **Orden: primero la 0932 y las plantillas, después la bandera.**
Las invitaciones usan `SUPABASE_SERVICE_ROLE_KEY` (solo en Production).

## Equipo (Configuración → Equipo, solo administrador)
- [ ] Invitar sin correo válido o a un odontólogo sin COP: avisa y no envía nada.
- [ ] Invitar a una asistente: llega el correo «Te invitaron a Dental Demo»; el enlace (también
      desde el celular) lleva a «Tu contraseña»; al guardarla entra como Asistente.
- [ ] En la lista aparece con «Invitación pendiente» hasta que entra; luego con su último ingreso.
- [ ] «Reenviar invitación» le manda un nuevo enlace para crear su contraseña.
- [ ] Desactivar: pide confirmar; esa persona ya no entra («Sin acceso a una clínica»); nada se borra.
      Reactivar: vuelve a entrar.
- [ ] No puedes desactivarte a ti mismo. Odontólogo, asistente y recepción no ven «Equipo».
- [ ] Si con la invitación la clínica supera su plan, el mensaje lo dice (no lo impide).
- [ ] Con la clínica vencida no se puede invitar (mensaje de solo lectura).

## Contraseña
- [ ] Login → «¿Olvidaste tu contraseña?» → correo → enlace → «Tu contraseña» → entra con la nueva.
- [ ] Un correo que no existe muestra el mismo mensaje (no revela si hay cuenta).

## Registro y planes
- [ ] El registro pide «Celular (WhatsApp)» (9 dígitos, empieza con 9); en tu panel aparece el
      botón de WhatsApp de esa clínica.
- [ ] En «Plan y pagos», la opción anual muestra el ahorro real del plan elegido.

## Solo lectura
- [ ] Con la clínica vencida, guardar en historia, signos vitales, odontograma, catálogo,
      laboratorios o marca muestra «…está en solo lectura…» (ya no un error genérico).
