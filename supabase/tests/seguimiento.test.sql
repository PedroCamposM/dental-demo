-- Etapa 8.1 (v2): regla 5. Al realizarse un procedimiento con control automático se
-- crea su control; el plan pasa a «en curso» y, completo, a «terminado» con su control.
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values ('a3000000-0000-0000-0000-00000000000b');
insert into public.clinica (id, nombre) values ('a3a3a3a3-0000-0000-0000-000000000000', 'Clínica Z');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('a3000000-0000-0000-0000-00000000000b', 'a3a3a3a3-0000-0000-0000-000000000000', 'Odontóloga Z', 'odontologo', '9841');
insert into public.paciente (id, clinica_id, dni, nombres, apellidos, fecha_nacimiento) values
  ('a3a3a3a3-0000-0000-0000-0000000000f1', 'a3a3a3a3-0000-0000-0000-000000000000', '65000001', 'Pía', 'Periodonto', '1975-01-01');
insert into public.procedimiento (id, clinica_id, codigo, nombre, especialidad, precio_base_centimos, duracion_minutos, control_dias) values
  ('a3a3a3a3-0000-0000-0000-0000000000d1', 'a3a3a3a3-0000-0000-0000-000000000000', 'PER-01', 'Raspado', 'periodoncia', 20000, 60, 90),
  ('a3a3a3a3-0000-0000-0000-0000000000d2', 'a3a3a3a3-0000-0000-0000-000000000000', 'OPE-01', 'Resina', 'operatoria', 18000, 45, null);
insert into public.plan_tratamiento (id, clinica_id, paciente_id, odontologo_id, titulo, estado, aceptado_at) values
  ('a3a3a3a3-0000-0000-0000-0000000000a1', 'a3a3a3a3-0000-0000-0000-000000000000', 'a3a3a3a3-0000-0000-0000-0000000000f1',
   'a3000000-0000-0000-0000-00000000000b', 'Periodoncia', 'aceptado', now());
insert into public.item_plan (id, clinica_id, plan_id, procedimiento, procedimiento_id, precio_centimos, odontologo_id, estado, orden, pieza) values
  ('a3a3a3a3-0000-0000-0000-0000000000e1', 'a3a3a3a3-0000-0000-0000-000000000000', 'a3a3a3a3-0000-0000-0000-0000000000a1',
   'Raspado', 'a3a3a3a3-0000-0000-0000-0000000000d1', 20000, 'a3000000-0000-0000-0000-00000000000b', 'aceptado', 1, null),
  ('a3a3a3a3-0000-0000-0000-0000000000e2', 'a3a3a3a3-0000-0000-0000-000000000000', 'a3a3a3a3-0000-0000-0000-0000000000a1',
   'Resina', 'a3a3a3a3-0000-0000-0000-0000000000d2', 18000, 'a3000000-0000-0000-0000-00000000000b', 'aceptado', 2, 16);

set role authenticated;
select pruebas.como('a3000000-0000-0000-0000-00000000000b');
-- Sesión 1: raspado
insert into public.nota_evolucion (id, clinica_id, paciente_id, odontologo_id, texto) values
  ('a3a3a3a3-0000-0000-0000-000000000091', 'a3a3a3a3-0000-0000-0000-000000000000', 'a3a3a3a3-0000-0000-0000-0000000000f1',
   'a3000000-0000-0000-0000-00000000000b', 'Raspado y alisado radicular');
insert into public.evolucion_item (clinica_id, nota_id, item_id, terminado) values
  ('a3a3a3a3-0000-0000-0000-000000000000', 'a3a3a3a3-0000-0000-0000-000000000091', 'a3a3a3a3-0000-0000-0000-0000000000e1', true);
select public.firmar_evolucion('a3a3a3a3-0000-0000-0000-000000000091');
reset role;
select pruebas.igual((select count(*) from public.seguimiento where item_plan_id = 'a3a3a3a3-0000-0000-0000-0000000000e1'
                        and tipo = 'mantenimiento_periodontal' and resultado = 'pendiente'
                        and fecha_programada = (now() at time zone 'America/Lima')::date + 90), 1,
                     'mantenimiento periodontal a los 90 días');
select pruebas.igual((select count(*) from public.plan_tratamiento where id = 'a3a3a3a3-0000-0000-0000-0000000000a1'
                        and estado = 'en_curso'), 1, 'el plan pasa a en curso');
-- Sesión 2: resina (sin control automático); el plan queda terminado con su control
set role authenticated;
insert into public.nota_evolucion (id, clinica_id, paciente_id, odontologo_id, texto) values
  ('a3a3a3a3-0000-0000-0000-000000000092', 'a3a3a3a3-0000-0000-0000-000000000000', 'a3a3a3a3-0000-0000-0000-0000000000f1',
   'a3000000-0000-0000-0000-00000000000b', 'Resina en la 16');
insert into public.evolucion_item (clinica_id, nota_id, item_id, terminado) values
  ('a3a3a3a3-0000-0000-0000-000000000000', 'a3a3a3a3-0000-0000-0000-000000000092', 'a3a3a3a3-0000-0000-0000-0000000000e2', true);
select public.firmar_evolucion('a3a3a3a3-0000-0000-0000-000000000092');
reset role;
select pruebas.igual((select count(*) from public.seguimiento where item_plan_id = 'a3a3a3a3-0000-0000-0000-0000000000e2'), 0,
                     'sin control automático no se crea seguimiento del ítem');
select pruebas.igual((select count(*) from public.plan_tratamiento where id = 'a3a3a3a3-0000-0000-0000-0000000000a1'
                        and estado = 'terminado' and terminado_at is not null), 1, 'plan terminado');
select pruebas.igual((select count(*) from public.seguimiento where plan_id = 'a3a3a3a3-0000-0000-0000-0000000000a1'
                        and tipo = 'control' and item_plan_id is null), 1, 'control de los 6 meses al terminar');

-- Regla 5 también si el último pendiente se cancela: el plan termina con su control
select pruebas.como(null);
insert into public.plan_tratamiento (id, clinica_id, paciente_id, odontologo_id, titulo, estado, aceptado_at) values
  ('a3a3a3a3-0000-0000-0000-0000000000a2', 'a3a3a3a3-0000-0000-0000-000000000000', 'a3a3a3a3-0000-0000-0000-0000000000f1',
   'a3000000-0000-0000-0000-00000000000b', 'Operatoria', 'aceptado', now());
insert into public.item_plan (id, clinica_id, plan_id, procedimiento, procedimiento_id, precio_centimos, odontologo_id, estado, orden, pieza) values
  ('a3a3a3a3-0000-0000-0000-0000000000e3', 'a3a3a3a3-0000-0000-0000-000000000000', 'a3a3a3a3-0000-0000-0000-0000000000a2',
   'Resina', 'a3a3a3a3-0000-0000-0000-0000000000d2', 18000, 'a3000000-0000-0000-0000-00000000000b', 'aceptado', 1, 26),
  ('a3a3a3a3-0000-0000-0000-0000000000e4', 'a3a3a3a3-0000-0000-0000-000000000000', 'a3a3a3a3-0000-0000-0000-0000000000a2',
   'Resina', 'a3a3a3a3-0000-0000-0000-0000000000d2', 18000, 'a3000000-0000-0000-0000-00000000000b', 'aceptado', 2, 27);
set role authenticated;
select pruebas.como('a3000000-0000-0000-0000-00000000000b');
insert into public.nota_evolucion (id, clinica_id, paciente_id, odontologo_id, texto) values
  ('a3a3a3a3-0000-0000-0000-000000000093', 'a3a3a3a3-0000-0000-0000-000000000000', 'a3a3a3a3-0000-0000-0000-0000000000f1',
   'a3000000-0000-0000-0000-00000000000b', 'Resina en la 26');
insert into public.evolucion_item (clinica_id, nota_id, item_id, terminado) values
  ('a3a3a3a3-0000-0000-0000-000000000000', 'a3a3a3a3-0000-0000-0000-000000000093', 'a3a3a3a3-0000-0000-0000-0000000000e3', true);
select public.firmar_evolucion('a3a3a3a3-0000-0000-0000-000000000093');
select pruebas.igual((select count(*) from public.plan_tratamiento where id = 'a3a3a3a3-0000-0000-0000-0000000000a2'
                        and estado = 'en_curso'), 1, 'segundo plan en curso');
update public.item_plan set estado = 'cancelado', motivo_cancelacion = 'La paciente decidió no hacerlo'
 where id = 'a3a3a3a3-0000-0000-0000-0000000000e4';
-- El proceso no queda encendido para lo que siga en la transacción
select pruebas.igual((select count(*) where coalesce(current_setting('dental.proceso', true), '') <> 'on'), 1, 'bandera de proceso restaurada');
-- Un seguimiento manual no se vincula a un ítem (bloquearía el control automático)
select pruebas.debe_fallar($$insert into public.seguimiento (clinica_id, paciente_id, plan_id, item_plan_id, tipo, fecha_programada)
  values ('a3a3a3a3-0000-0000-0000-000000000000', 'a3a3a3a3-0000-0000-0000-0000000000f1', 'a3a3a3a3-0000-0000-0000-0000000000a2',
          'a3a3a3a3-0000-0000-0000-0000000000e4', 'control', (now() at time zone 'America/Lima')::date)$$, 'lo crea el sistema');
reset role;
select pruebas.igual((select count(*) from public.plan_tratamiento where id = 'a3a3a3a3-0000-0000-0000-0000000000a2'
                        and estado = 'terminado'), 1, 'plan terminado al cancelar el último pendiente');
select pruebas.igual((select count(*) from public.seguimiento where plan_id = 'a3a3a3a3-0000-0000-0000-0000000000a2'
                        and tipo = 'control'), 1, 'control de los 6 meses del plan cancelado al final');
select pruebas.como(null);
\echo 'seguimiento: todas las aserciones pasaron'
