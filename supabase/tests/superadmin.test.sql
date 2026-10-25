-- Etapa 20 (v2): herramientas del superadministrador. Nombre de la clínica (su admin o el
-- superadmin con motivo), suspensión (solo lectura), descuento, avisos, activación, ingresos y
-- bitácora. Nada de esto lo usa una clínica salvo su nombre, su descuento y sus avisos.
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id, email) values
  ('cb000000-0000-0000-0000-00000000000a', 'admin-s@clinica.example'),
  ('cb000000-0000-0000-0000-00000000000b', 'recep-s@clinica.example'),
  ('cb000000-0000-0000-0000-0000000000aa', 'super-s@plataforma.example'),
  ('db000000-0000-0000-0000-00000000000a', 'admin-t@clinica.example');
insert into public.clinica (id, nombre, plan, prueba_hasta) values
  ('cbcbcbcb-0000-0000-0000-000000000000', 'Clínica Super', 'prueba', (now() at time zone 'America/Lima')::date + 10),
  ('dbdbdbdb-0000-0000-0000-000000000000', 'Clínica Tercera', 'prueba', (now() at time zone 'America/Lima')::date + 10),
  ('ebebebeb-0000-0000-0000-000000000000', 'Clínica Demo S', 'demo', null);
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('cb000000-0000-0000-0000-00000000000a', 'cbcbcbcb-0000-0000-0000-000000000000', 'Admin S', 'admin', '9861'),
  ('cb000000-0000-0000-0000-00000000000b', 'cbcbcbcb-0000-0000-0000-000000000000', 'Recepción S', 'recepcion', null),
  ('db000000-0000-0000-0000-00000000000a', 'dbdbdbdb-0000-0000-0000-000000000000', 'Admin T', 'admin', '9862');
insert into privado.superadmin (usuario_id) values ('cb000000-0000-0000-0000-0000000000aa');

set role authenticated;
-- Nombre: el admin cambia el de su clínica; nadie más
select pruebas.como('cb000000-0000-0000-0000-00000000000a');
select public.cambiar_nombre_clinica('cbcbcbcb-0000-0000-0000-000000000000', '  Clínica   Super  Sonrisa ');
select pruebas.igual((select count(*) from public.clinica where nombre = 'Clínica Super Sonrisa'), 1, 'nombre limpio');
select pruebas.debe_fallar($$select public.cambiar_nombre_clinica('cbcbcbcb-0000-0000-0000-000000000000', 'X')$$, '3 a 120');
select pruebas.debe_fallar($$select public.cambiar_nombre_clinica('dbdbdbdb-0000-0000-0000-000000000000', 'Ajena')$$, 'administrador');
select pruebas.debe_fallar($$update public.clinica set nombre = 'Directo' where id = 'cbcbcbcb-0000-0000-0000-000000000000'$$,
                           'permission denied');
select pruebas.como('cb000000-0000-0000-0000-00000000000b');
select pruebas.debe_fallar($$select public.cambiar_nombre_clinica('cbcbcbcb-0000-0000-0000-000000000000', 'Recepción cambia')$$,
                           'administrador');
-- La clínica no ve ni usa nada del superadministrador
select pruebas.debe_fallar($$select public.suspender_clinica('cbcbcbcb-0000-0000-0000-000000000000', true, 'Prueba')$$, 'superadministrador');
select pruebas.debe_fallar($$select public.guardar_descuento('cbcbcbcb-0000-0000-0000-000000000000', 10, null, 'Prueba')$$, 'superadministrador');
select pruebas.debe_fallar($$select public.publicar_aviso(null, 'Hola', 'info', (now() at time zone 'America/Lima')::date)$$, 'superadministrador');
select pruebas.debe_fallar($$select * from public.bitacora_plataforma()$$, 'superadministrador');
select pruebas.debe_fallar($$select * from public.ingresos_plataforma((now() at time zone 'America/Lima')::date - 30, (now() at time zone 'America/Lima')::date)$$, 'superadministrador');
select pruebas.debe_fallar($$select * from privado.bitacora_plataforma$$, 'permission denied');
select pruebas.debe_fallar($$select * from privado.aviso_plataforma$$, 'permission denied');
select pruebas.igual((select count(*) from public.mi_descuento()), 0, 'recepción no ve descuentos');

-- Superadministrador
select pruebas.como('cb000000-0000-0000-0000-0000000000aa');
select pruebas.debe_fallar($$select public.cambiar_nombre_clinica('cbcbcbcb-0000-0000-0000-000000000000', 'Sin motivo')$$, 'motivo');
select public.cambiar_nombre_clinica('cbcbcbcb-0000-0000-0000-000000000000', 'Clínica Súper', 'La clínica pidió el acento');
select pruebas.debe_fallar($$select public.cambiar_nombre_clinica('ebebebeb-0000-0000-0000-000000000000', 'Demo')$$, 'motivo');
select pruebas.debe_fallar($$select public.cambiar_nombre_clinica('ebebebeb-0000-0000-0000-000000000000', 'Demo', 'Probar')$$,
                           'demostración');
-- Quitar un descuento que no existe no deja nada en la bitácora
select public.guardar_descuento('dbdbdbdb-0000-0000-0000-000000000000', 0, null, 'Nada que quitar');
-- Descuento del 20 %: se aplica solo al reportar el pago
select pruebas.debe_fallar($$select public.guardar_descuento('cbcbcbcb-0000-0000-0000-000000000000', 95, null, 'Mucho')$$, '90');
select pruebas.debe_fallar($$select public.guardar_descuento('cbcbcbcb-0000-0000-0000-000000000000', 20, (now() at time zone 'America/Lima')::date - 1, 'Pasado')$$,
                           'hoy o posterior');
select public.guardar_descuento('cbcbcbcb-0000-0000-0000-000000000000', 20, null, 'Clínica fundadora');
-- Aviso a todas y a una sola clínica
select pruebas.debe_fallar($$select public.publicar_aviso(null, 'Largo', 'info', (now() at time zone 'America/Lima')::date + 120)$$, '90 días');
select public.publicar_aviso(null, 'Mantenimiento el domingo de 6 a 7 a. m.', 'info', (now() at time zone 'America/Lima')::date + 3);
select public.publicar_aviso('dbdbdbdb-0000-0000-0000-000000000000', 'Solo para la Tercera', 'importante',
                             (now() at time zone 'America/Lima')::date + 3);
reset role;

set role authenticated;
select pruebas.como('cb000000-0000-0000-0000-00000000000a');
select pruebas.igual((select porcentaje from public.mi_descuento()), 20, 'el admin ve su descuento');
select public.reportar_pago_suscripcion('consultorio', 'mensual', 'yape', 'SUP-1', (now() at time zone 'America/Lima')::date, null);
select pruebas.igual((select monto_centimos from public.pago_suscripcion where operacion = 'SUP-1'),
                     (select round(mensual_centimos * 0.8) from public.tarifas() where codigo = 'consultorio')::bigint,
                     'el monto lleva el descuento');
select pruebas.igual((select count(*) from public.avisos_vigentes()), 1, 've el aviso general, no el de otra clínica');
select pruebas.como('db000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.avisos_vigentes()), 2, 'la tercera ve los dos');
select pruebas.igual((select count(*) from public.avisos_vigentes() where nivel = 'importante'), 1, 'el importante');
select pruebas.igual((select count(*) from public.mi_descuento()), 0, 'otra clínica no tiene descuento');

-- Confirmación, activación, ingresos y suspensión
select pruebas.como('cb000000-0000-0000-0000-0000000000aa');
select public.revisar_pago_suscripcion((select id from public.pagos_por_confirmar() where clinica = 'Clínica Súper'), true, null);
select pruebas.igual((select activacion from public.clinicas_plataforma('cbcbcbcb-0000-0000-0000-000000000000')), 2,
                     'activación: equipo y pago');
select pruebas.igual((select count(*) from public.ingresos_plataforma((now() at time zone 'America/Lima')::date,
                        (now() at time zone 'America/Lima')::date) where operacion = 'SUP-1' and descuento_pct = 20), 1,
                     'el pago confirmado está en los ingresos');
select pruebas.debe_fallar($$select * from public.ingresos_plataforma((now() at time zone 'America/Lima')::date, (now() at time zone 'America/Lima')::date - 1)$$, 'rango');
select pruebas.debe_fallar($$select public.suspender_clinica('dbdbdbdb-0000-0000-0000-000000000000', true, '')$$, 'motivo');
select pruebas.debe_fallar($$select public.suspender_clinica('ebebebeb-0000-0000-0000-000000000000', true, 'Demo')$$, 'demostración');
select public.suspender_clinica('dbdbdbdb-0000-0000-0000-000000000000', true, 'Pidió pausar la cuenta');
select pruebas.debe_fallar($$select public.suspender_clinica('dbdbdbdb-0000-0000-0000-000000000000', true, 'Otra vez')$$, 'ya está');
select pruebas.igual((select suspendidas from public.resumen_plataforma()), 1, 'una suspendida en el resumen');
-- Bitácora: todo lo anterior quedó registrado
select pruebas.igual((select count(*) from public.bitacora_plataforma('cbcbcbcb-0000-0000-0000-000000000000')
                       where accion in ('cambiar_nombre', 'descuento', 'confirmar_pago')), 3, 'bitácora de la clínica');
select pruebas.igual((select count(*) from public.bitacora_plataforma() where accion = 'suspender' and clinica = 'Clínica Tercera'), 1,
                     'bitácora de la suspensión');
select pruebas.igual((select jsonb_array_length(public.ficha_clinica('cbcbcbcb-0000-0000-0000-000000000000') -> 'bitacora')), 3,
                     'la ficha trae su bitácora');

-- Suspendida: solo lectura (pero puede reportar su pago y sigue viendo sus datos)
select pruebas.como('db000000-0000-0000-0000-00000000000a');
select pruebas.debe_fallar($$insert into public.paciente (clinica_id, nombres, apellidos, fecha_nacimiento, telefono, consentimiento_datos_at)
  values ('dbdbdbdb-0000-0000-0000-000000000000', 'No', 'Entra', '1980-01-01', '51911111111', now())$$, 'suspendida');
select pruebas.debe_fallar($$select public.cambiar_nombre_clinica('dbdbdbdb-0000-0000-0000-000000000000', 'Nuevo nombre')$$, 'solo lectura');
select pruebas.igual((select count(*) from public.clinica where suspendida_at is not null), 1, 've que está suspendida');
select public.reportar_pago_suscripcion('consultorio', 'mensual', 'plin', 'SUP-2', (now() at time zone 'America/Lima')::date, null);
-- Reactivada: vuelve a registrar
select pruebas.como('cb000000-0000-0000-0000-0000000000aa');
select public.suspender_clinica('dbdbdbdb-0000-0000-0000-000000000000', false, 'Retoma el servicio');
select pruebas.como('db000000-0000-0000-0000-00000000000a');
insert into public.paciente (clinica_id, nombres, apellidos, fecha_nacimiento, telefono, consentimiento_datos_at)
values ('dbdbdbdb-0000-0000-0000-000000000000', 'Ya', 'Entra', '1980-01-01', '51911111111', now());
reset role;
select pruebas.igual((select count(*) from public.auditoria where tabla = 'clinica' and despues ? 'nombre'
                        and registro_id = 'cbcbcbcb-0000-0000-0000-000000000000'), 2, 'los cambios de nombre en la auditoría');
select pruebas.igual((select count(*) from privado.bitacora_plataforma where accion = 'quitar_descuento'), 0,
                     'quitar sin descuento no se anota');
-- Deja la plataforma como estaba: el CI corre después Playwright sobre esta misma base.
update privado.aviso_plataforma set retirado_at = now() where retirado_at is null;
update public.pago_suscripcion set estado = 'rechazado', motivo_rechazo = 'Limpieza de la prueba SQL', revisado_at = now()
 where operacion = 'SUP-2';
delete from privado.descuento_clinica where clinica_id = 'cbcbcbcb-0000-0000-0000-000000000000';
update public.clinica set plan = 'prueba', prueba_hasta = (now() at time zone 'America/Lima')::date
 where id = 'ebebebeb-0000-0000-0000-000000000000';
delete from privado.superadmin where usuario_id = 'cb000000-0000-0000-0000-0000000000aa';
select pruebas.como(null);
\echo 'superadmin: todas las aserciones pasaron'
