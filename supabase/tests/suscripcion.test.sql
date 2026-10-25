-- Etapa 17 (v2): suscripción con cobro manual. La clínica reporta su pago (también vencida),
-- el superadministrador lo confirma o rechaza; al confirmar, el plan se extiende solo.
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values
  ('c7000000-0000-0000-0000-00000000000a'),   -- admin de la clínica que paga
  ('c7000000-0000-0000-0000-00000000000b'),   -- odontólogo de esa clínica
  ('c7000000-0000-0000-0000-0000000000aa'),   -- superadministrador
  ('d7000000-0000-0000-0000-00000000000a');   -- admin de otra clínica
insert into public.clinica (id, nombre, plan, prueba_hasta) values
  ('c7c7c7c7-0000-0000-0000-000000000000', 'Clínica que paga', 'prueba', (now() at time zone 'America/Lima')::date - 3),
  ('d7d7d7d7-0000-0000-0000-000000000000', 'Otra clínica', 'activo', null);
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('c7000000-0000-0000-0000-00000000000a', 'c7c7c7c7-0000-0000-0000-000000000000', 'Admin P', 'admin', '9871'),
  ('c7000000-0000-0000-0000-00000000000b', 'c7c7c7c7-0000-0000-0000-000000000000', 'Odontólogo P', 'odontologo', '9872'),
  ('d7000000-0000-0000-0000-00000000000a', 'd7d7d7d7-0000-0000-0000-000000000000', 'Admin O', 'admin', '9873');
insert into privado.superadmin (usuario_id) values ('c7000000-0000-0000-0000-0000000000aa');

set role authenticated;
-- La clínica ve tarifas, datos de cobro y sus odontólogos activos
select pruebas.como('c7000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.tarifas()), 3, 'tres tarifas');
select pruebas.igual((select mensual_centimos from public.tarifas() where codigo = 'consultorio'), 9900, 'consultorio S/ 99');
select pruebas.igual((select count(*) from public.datos_cobro()), 1, 'datos de cobro (vacíos al inicio)');
select pruebas.igual(public.odontologos_activos(), 2, 'cuenta admin y odontólogo con COP');
-- Nadie toca las tarifas ni escribe pagos directo
select pruebas.debe_fallar($$select public.guardar_tarifa('consultorio', 1, 1)$$, 'superadministrador');
select pruebas.debe_fallar($$select * from privado.tarifa$$, 'permission denied');
select pruebas.debe_fallar($$insert into public.pago_suscripcion (clinica_id, tarifa, periodo, monto_centimos, metodo, operacion,
  pagado_el, reportado_por) values ('c7c7c7c7-0000-0000-0000-000000000000', 'consultorio', 'mensual', 1, 'yape', '123456',
  (now() at time zone 'America/Lima')::date, auth.uid())$$, 'permission denied');

-- Vencida (solo lectura): no registra pacientes, pero sí reporta su pago, con validaciones en la base
select pruebas.debe_fallar($$insert into public.paciente (clinica_id, nombres, apellidos, fecha_nacimiento, telefono, consentimiento_datos_at)
  values ('c7c7c7c7-0000-0000-0000-000000000000', 'No', 'Entra', '1980-01-01', '51911111111', now())$$, 'solo lectura');
select pruebas.debe_fallar($$select public.reportar_pago_suscripcion('oro', 'mensual', 'yape', '123456', (now() at time zone 'America/Lima')::date, null)$$, 'plan');
select pruebas.debe_fallar($$select public.reportar_pago_suscripcion('consultorio', 'mensual', 'yape', '12', (now() at time zone 'America/Lima')::date, null)$$,
                           'número de operación');
select pruebas.debe_fallar($$select public.reportar_pago_suscripcion('consultorio', 'mensual', 'yape', '123456',
  (now() at time zone 'America/Lima')::date + 1, null)$$, 'últimos 60 días');
select pruebas.debe_fallar($$select public.reportar_pago_suscripcion('consultorio', 'mensual', 'yape', '123456', (now() at time zone 'America/Lima')::date,
  'd7d7d7d7-0000-0000-0000-000000000000/x.png')$$, 'Constancia inválida');
select public.reportar_pago_suscripcion('consultorio', 'mensual', 'yape', '123456', (now() at time zone 'America/Lima')::date,
                                        'c7c7c7c7-0000-0000-0000-000000000000/constancia.png');
select pruebas.igual((select monto_centimos from public.pago_suscripcion), 9900, 'el monto sale de la tarifa (no lo pone la clínica)');
select pruebas.debe_fallar($$select public.reportar_pago_suscripcion('clinica', 'anual', 'plin', '999999', (now() at time zone 'America/Lima')::date, null)$$,
                           'por confirmar');
-- Constancia: sube a su carpeta, no a la de otra clínica
insert into storage.objects (bucket_id, name) values ('suscripcion', 'c7c7c7c7-0000-0000-0000-000000000000/constancia.png');
select pruebas.debe_fallar($$insert into storage.objects (bucket_id, name) values ('suscripcion', 'd7d7d7d7-0000-0000-0000-000000000000/x.png')$$,
                           'row-level security');
-- El odontólogo no ve los pagos ni reporta
select pruebas.como('c7000000-0000-0000-0000-00000000000b');
select pruebas.igual((select count(*) from public.pago_suscripcion), 0, 'el odontólogo no ve los pagos');
select pruebas.debe_fallar($$select public.reportar_pago_suscripcion('consultorio', 'mensual', 'yape', '777777', (now() at time zone 'America/Lima')::date, null)$$,
                           'administrador');
-- Otra clínica no ve el pago ni la constancia, ni puede confirmar
select pruebas.como('d7000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.pago_suscripcion), 0, 'otra clínica no ve el pago');
select pruebas.igual((select count(*) from storage.objects where bucket_id = 'suscripcion'), 0, 'otra clínica no ve la constancia');
select pruebas.debe_fallar($$select public.revisar_pago_suscripcion((select id from public.pago_suscripcion limit 1), true, null)$$,
                           'superadministrador');
select pruebas.debe_fallar($$select * from public.pagos_por_confirmar()$$, 'superadministrador');

-- El superadministrador ve el pago y la constancia, y lo confirma
select pruebas.como('c7000000-0000-0000-0000-0000000000aa');
select pruebas.igual((select count(*) from public.pagos_por_confirmar() where clinica = 'Clínica que paga' and odontologos = 2), 1,
                     'pago por confirmar con sus odontólogos');
select pruebas.igual((select count(*) from storage.objects where bucket_id = 'suscripcion'), 1, 'el superadmin ve la constancia');
create temp table pago_id as select id from public.pagos_por_confirmar() where clinica = 'Clínica que paga';
select pruebas.debe_fallar($$select public.revisar_pago_suscripcion((select id from pago_id), false, '')$$, 'motivo');
select public.revisar_pago_suscripcion((select id from pago_id), true, null);
select pruebas.debe_fallar($$select public.revisar_pago_suscripcion((select id from pago_id), true, null)$$, 'ya fue revisado');
select pruebas.igual((select count(*) from public.clinicas_plataforma() where nombre = 'Clínica que paga' and plan = 'activo'
                        and tarifa = 'consultorio'
                        and activo_hasta = ((now() at time zone 'America/Lima')::date + interval '1 month')::date - 1), 1,
                     'vencida: el mes cuenta desde hoy (inclusive)');
select pruebas.debe_fallar($$select public.revisar_pago_suscripcion((select id from pago_id), null, null)$$, 'confirmas o rechazas');
-- Cambia precios y datos de cobro
select public.guardar_tarifa('consultorio', 10900, 109000);
select public.guardar_cobro('{"yape": "999 888 777", "titular": "Titular de ejemplo"}');
reset role;
select pruebas.igual((select count(*) from public.auditoria where tabla = 'clinica' and despues ->> 'motivo' like 'Pago 123456 confirmado%'), 1,
                     'la confirmación queda en la auditoría');

set role authenticated;
-- De nuevo activa: registra; un segundo pago anual se suma al fin actual
select pruebas.como('c7000000-0000-0000-0000-00000000000a');
insert into public.paciente (clinica_id, nombres, apellidos, fecha_nacimiento, telefono, consentimiento_datos_at)
values ('c7c7c7c7-0000-0000-0000-000000000000', 'Ya', 'Entra', '1980-01-01', '51911111111', now());
select pruebas.igual((select count(*) from public.datos_cobro() where yape = '999 888 777'), 1, 've el Yape para pagar');
-- La misma operación no se reporta dos veces en la clínica
select pruebas.debe_fallar($$select public.reportar_pago_suscripcion('consultorio', 'mensual', 'yape', ' 123456 ', (now() at time zone 'America/Lima')::date, null)$$,
                           'ya fue reportado');
select public.reportar_pago_suscripcion('consultorio', 'anual', 'transferencia', 'OP-2026-1', (now() at time zone 'America/Lima')::date, null);
select pruebas.igual((select monto_centimos from public.pago_suscripcion where estado = 'pendiente'), 109000, 'precio nuevo');
select pruebas.como('c7000000-0000-0000-0000-0000000000aa');
select public.revisar_pago_suscripcion((select id from public.pagos_por_confirmar() where clinica = 'Clínica que paga'), true, null);
select pruebas.igual((select count(*) from public.clinicas_plataforma() where nombre = 'Clínica que paga'
                        and activo_hasta = (((now() at time zone 'America/Lima')::date + interval '1 month')::date + interval '1 year')::date - 1), 1,
                     'vigente: el año se suma al fin actual');
reset role;
-- Fin de mes: un plan que termina el 30 de abril se renueva hasta el 31 de mayo
update public.clinica set activo_hasta = date '2099-04-30' where id = 'c7c7c7c7-0000-0000-0000-000000000000';
set role authenticated;
select pruebas.como('c7000000-0000-0000-0000-00000000000a');
select public.reportar_pago_suscripcion('consultorio', 'mensual', 'plin', 'FINMES-1', (now() at time zone 'America/Lima')::date, null);
-- Otra clínica puede tener el mismo número de operación (bancos distintos)
select pruebas.como('d7000000-0000-0000-0000-00000000000a');
select public.reportar_pago_suscripcion('consultorio', 'mensual', 'plin', 'FINMES-1', (now() at time zone 'America/Lima')::date, null);
select pruebas.como('c7000000-0000-0000-0000-0000000000aa');
select public.revisar_pago_suscripcion((select id from public.pagos_por_confirmar() where clinica = 'Clínica que paga'), true, null);
select pruebas.igual((select count(*) from public.clinicas_plataforma() where nombre = 'Clínica que paga'
                        and activo_hasta = date '2099-05-31'), 1, 'fin de mes: 30-abr → 31-may');
reset role;
-- Deja la plataforma como estaba: el CI corre después Playwright sobre esta misma base.
update privado.tarifa set mensual_centimos = 9900, anual_centimos = 99000 where codigo = 'consultorio';
update privado.cobro set yape = null, plin = null, banco = null, cuenta = null, cci = null, titular = null, instrucciones = null where id;
select pruebas.como(null);
\echo 'suscripcion: todas las aserciones pasaron'
