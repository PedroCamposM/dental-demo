# Checklist manual — Etapa 16 (prueba gratuita por clínica)

Se prueba después de aplicar la migración 0929, activar el registro en Supabase Auth (con
SMTP propio y la URL de Vercel en `site_url` y en las URL de redirección), agregar el correo
del superadministrador y encender `HABILITAR_ETAPA16=1` en Vercel.

## Registro
- [ ] Login → «Prueba gratis 30 días» abre el registro.
- [ ] Sin aceptar los términos, con una contraseña corta o un COP con letras: avisa y no crea la cuenta.
- [ ] «Términos y política de privacidad» abre el borrador (sin iniciar sesión).
- [ ] Con un correo nuevo: dice que revises el correo. El enlace del correo lleva a «Crea tu clínica»
      con los datos del registro.
- [ ] «Crear mi clínica» → entra como administrador a Pacientes; ve 3 pacientes «(ejemplo)» y el
      aviso «Prueba gratuita: quedan 30 días.».
- [ ] La clínica nueva no ve nada de la clínica de demostración ni de otras.
- [ ] Tiene el catálogo de procedimientos, las plantillas de consentimiento (de ejemplo), un sillón y
      horario de lunes a sábado; la agenda permite citar.
- [ ] Con un correo ya registrado: no crea otra cuenta.
- [ ] Un enlace de confirmación viejo o usado lleva al login con un aviso claro.

## Solo lectura al vencer (el superadmin pone una fecha pasada, o se espera)
- [ ] Aviso rojo «La prueba gratuita terminó…» en todas las pantallas.
- [ ] Se ven pacientes, historias, planes y documentos; la exportación de la historia funciona.
- [ ] Registrar un paciente, una cita o un pago da un error claro y no guarda nada.

## Superadministrador
- [ ] Al ingresar va a «Clínicas de la plataforma» y ve todas, con plan, fechas, usuarios y pacientes.
- [ ] Sin motivo no guarda. Con motivo, «Activo (pagado)» hasta una fecha → la clínica vuelve a registrar
      y el aviso desaparece.
- [ ] Un usuario de una clínica (cualquier rol) que abre `/plataforma` ve «no encontrado».
- [ ] La clínica de demostración no muestra el formulario de plan y no tiene aviso.
