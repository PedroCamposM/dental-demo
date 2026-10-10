-- Etapa 10 (v2): órdenes de laboratorio. Vinculadas al ítem del plan; estados por
-- funciones; no se editan ni se borran (regla 1); costo en céntimos (regla 7); RLS por rol.
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values
  ('e7000000-0000-0000-0000-00000000000a'), ('e7000000-0000-0000-0000-00000000000b'),
  ('e7000000-0000-0000-0000-00000000000e'), ('e7000000-0000-0000-0000-00000000000d'),
  ('f7000000-0000-0000-0000-00000000000a');
insert into public.clinica (id, nombre) values
  ('e7e7e7e7-0000-0000-0000-000000000000', 'Clínica Lab'), ('f7f7f7f7-0000-0000-0000-000000000000', 'Otra');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('e7000000-0000-0000-0000-00000000000a', 'e7e7e7e7-0000-0000-0000-000000000000', 'Admin L',     'admin',      '9781'),
  ('e7000000-0000-0000-0000-00000000000b', 'e7e7e7e7-0000-0000-0000-000000000000', 'Rehabilitadora', 'odontologo', '9782'),
  ('e7000000-0000-0000-0000-00000000000e', 'e7e7e7e7-0000-0000-0000-000000000000', 'Asistente L',  'asistente',  null),
  ('e7000000-0000-0000-0000-00000000000d', 'e7e7e7e7-0000-0000-0000-000000000000', 'Recepción L',  'recepcion',  null),
  ('f7000000-0000-0000-0000-00000000000a', 'f7f7f7f7-0000-0000-0000-000000000000', 'Admin O',      'admin',      '9791');
insert into public.paciente (id, clinica_id, dni, nombres, apellidos, fecha_nacimiento) values
  ('e7e7e7e7-0000-0000-0000-0000000000f1', 'e7e7e7e7-0000-0000-0000-000000000000', '69900001', 'Luis', 'Laboratorio', '1965-04-04');
insert into public.plan_tratamiento (id, clinica_id, paciente_id, odontologo_id, titulo, estado, aceptado_at) values
  ('e7e7e7e7-0000-0000-0000-0000000000a1', 'e7e7e7e7-0000-0000-0000-000000000000', 'e7e7e7e7-0000-0000-0000-0000000000f1',
   'e7000000-0000-0000-0000-00000000000b', 'Rehabilitación', 'aceptado', now()),
  ('e7e7e7e7-0000-0000-0000-0000000000a2', 'e7e7e7e7-0000-0000-0000-000000000000', 'e7e7e7e7-0000-0000-0000-0000000000f1',
   'e7000000-0000-0000-0000-00000000000b', 'Propuesto', 'propuesto', null);
insert into public.item_plan (id, clinica_id, plan_id, procedimiento, precio_centimos, odontologo_id, estado, orden, pieza) values
  ('e7e7e7e7-0000-0000-0000-0000000000e1', 'e7e7e7e7-0000-0000-0000-000000000000', 'e7e7e7e7-0000-0000-0000-0000000000a1',
   'Corona metal-cerámica', 80000, 'e7000000-0000-0000-0000-00000000000b', 'aceptado', 1, 36),
  ('e7e7e7e7-0000-0000-0000-0000000000e2', 'e7e7e7e7-0000-0000-0000-000000000000', 'e7e7e7e7-0000-0000-0000-0000000000a2',
   'Corona zirconio', 120000, 'e7000000-0000-0000-0000-00000000000b', 'propuesto', 1, 11);

-- El admin registra los laboratorios; los demás no
set role authenticated;
select pruebas.como('e7000000-0000-0000-0000-00000000000b');
select pruebas.debe_fallar($$insert into public.laboratorio (clinica_id, nombre)
  values ('e7e7e7e7-0000-0000-0000-000000000000', 'Lab ajeno')$$, 'row-level security');
select pruebas.como('e7000000-0000-0000-0000-00000000000a');
insert into public.laboratorio (clinica_id, nombre, telefono, contacto) values
  ('e7e7e7e7-0000-0000-0000-000000000000', 'Laboratorio Dental Norte', '944 000 111', 'Técnico Ramos'),
  ('e7e7e7e7-0000-0000-0000-000000000000', 'Lab inactivo', null, null);
select pruebas.debe_fallar($$insert into public.laboratorio (clinica_id, nombre)
  values ('e7e7e7e7-0000-0000-0000-000000000000', ' laboratorio dental norte ')$$, 'laboratorio_nombre');
update public.laboratorio set activo = false where nombre = 'Lab inactivo';

-- La odontóloga prescribe la orden; paciente y pieza salen del ítem
select pruebas.como('e7000000-0000-0000-0000-00000000000b');
insert into public.orden_laboratorio (clinica_id, item_plan_id, laboratorio_id, tipo_trabajo, color, indicaciones, costo_centimos)
select 'e7e7e7e7-0000-0000-0000-000000000000', 'e7e7e7e7-0000-0000-0000-0000000000e1', id,
       'Corona metal-cerámica', 'A2', 'Hombro vestibular', 25000
  from public.laboratorio where nombre = 'Laboratorio Dental Norte';
select pruebas.igual((select count(*) from public.orden_laboratorio where paciente_id = 'e7e7e7e7-0000-0000-0000-0000000000f1'
                        and pieza = 36 and estado = 'por_enviar'), 1, 'orden por enviar con pieza del ítem');
select pruebas.debe_fallar($$insert into public.orden_laboratorio (clinica_id, item_plan_id, laboratorio_id, tipo_trabajo)
  select 'e7e7e7e7-0000-0000-0000-000000000000', 'e7e7e7e7-0000-0000-0000-0000000000e2', id, 'Corona'
    from public.laboratorio where nombre = 'Laboratorio Dental Norte'$$, 'ítem aceptado');
select pruebas.debe_fallar($$insert into public.orden_laboratorio (clinica_id, item_plan_id, laboratorio_id, tipo_trabajo)
  select 'e7e7e7e7-0000-0000-0000-000000000000', 'e7e7e7e7-0000-0000-0000-0000000000e1', id, 'Corona'
    from public.laboratorio where nombre = 'Lab inactivo'$$, 'laboratorio activo');
select pruebas.debe_fallar($$insert into public.orden_laboratorio (clinica_id, item_plan_id, laboratorio_id, tipo_trabajo, costo_centimos)
  select 'e7e7e7e7-0000-0000-0000-000000000000', 'e7e7e7e7-0000-0000-0000-0000000000e1', id, 'Corona', -5
    from public.laboratorio where nombre = 'Laboratorio Dental Norte'$$, 'check constraint');
-- No se edita ni se borra
select pruebas.debe_fallar($$update public.orden_laboratorio set color = 'A3'$$, 'permission denied');
select pruebas.debe_fallar($$delete from public.orden_laboratorio$$, 'permission denied');

-- La asistente no prescribe, pero registra el envío y la recepción
select pruebas.como('e7000000-0000-0000-0000-00000000000e');
select pruebas.debe_fallar($$insert into public.orden_laboratorio (clinica_id, item_plan_id, laboratorio_id, tipo_trabajo)
  select 'e7e7e7e7-0000-0000-0000-000000000000', 'e7e7e7e7-0000-0000-0000-0000000000e1', id, 'Incrustación'
    from public.laboratorio where nombre = 'Laboratorio Dental Norte'$$, 'row-level security');
create temp table o (id uuid);
grant all on o to authenticated;
insert into o select id from public.orden_laboratorio;
select pruebas.debe_fallar($$select public.recibir_orden_laboratorio((select id from o), (now() at time zone 'America/Lima')::date, null)$$,
                           'enviada');
select pruebas.debe_fallar($$select public.enviar_orden_laboratorio((select id from o), (now() at time zone 'America/Lima')::date + 1,
                                                                   (now() at time zone 'America/Lima')::date + 5)$$, 'futura');
select pruebas.debe_fallar($$select public.enviar_orden_laboratorio((select id from o), (now() at time zone 'America/Lima')::date - 3,
                                                                   (now() at time zone 'America/Lima')::date - 5)$$, 'anterior al envío');
-- Enviada hace 10 días con entrega hace 3: atrasada
select public.enviar_orden_laboratorio((select id from o), (now() at time zone 'America/Lima')::date - 10,
                                       (now() at time zone 'America/Lima')::date - 3);
select pruebas.igual((select count(*) from public.orden_laboratorio where estado = 'en_laboratorio'
                        and fecha_entrega_prevista < (now() at time zone 'America/Lima')::date), 1, 'orden atrasada');
-- El laboratorio avisa otra fecha: solo cambia la entrega prevista
select pruebas.debe_fallar($$select public.enviar_orden_laboratorio((select id from o), (now() at time zone 'America/Lima')::date - 9,
                                                                   (now() at time zone 'America/Lima')::date + 2)$$, 'solo cambia la entrega');
select public.enviar_orden_laboratorio((select id from o), (now() at time zone 'America/Lima')::date - 10,
                                       (now() at time zone 'America/Lima')::date + 2);
select public.recibir_orden_laboratorio((select id from o), (now() at time zone 'America/Lima')::date, 26000);
select pruebas.igual((select count(*) from public.orden_laboratorio where estado = 'recibida' and costo_centimos = 26000
                        and fecha_recepcion = (now() at time zone 'America/Lima')::date), 1, 'recibida con su costo');
select pruebas.debe_fallar($$select public.cancelar_orden_laboratorio((select id from o), 'Ya no se necesita')$$, 'recibida o cancelada');

-- Cancelar exige motivo
select pruebas.como('e7000000-0000-0000-0000-00000000000b');
insert into public.orden_laboratorio (clinica_id, item_plan_id, laboratorio_id, tipo_trabajo)
select 'e7e7e7e7-0000-0000-0000-000000000000', 'e7e7e7e7-0000-0000-0000-0000000000e1', id, 'Provisional acrílico'
  from public.laboratorio where nombre = 'Laboratorio Dental Norte';
select pruebas.debe_fallar($$select public.cancelar_orden_laboratorio((select id from public.orden_laboratorio where estado = 'por_enviar'), 'x')$$,
                           'motivo');
select public.cancelar_orden_laboratorio((select id from public.orden_laboratorio where estado = 'por_enviar'), 'Se hará en el consultorio');
select pruebas.igual((select count(*) from public.orden_laboratorio where estado = 'cancelada'), 1, 'cancelada con motivo');

-- Recepción y otra clínica no ven ni actualizan órdenes
select pruebas.como('e7000000-0000-0000-0000-00000000000d');
select pruebas.igual((select count(*) from public.orden_laboratorio) + (select count(*) from public.laboratorio), 0,
                     'recepción no ve el laboratorio');
select pruebas.debe_fallar($$select public.cancelar_orden_laboratorio((select id from o), 'Desde recepción')$$, 'cirujano dentista o la asistente');
select pruebas.como('f7000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.orden_laboratorio), 0, 'otra clínica no ve las órdenes');
select pruebas.debe_fallar($$select public.recibir_orden_laboratorio((select id from o), (now() at time zone 'America/Lima')::date, null)$$,
                           'no encontrada');
select pruebas.debe_fallar($$insert into public.orden_laboratorio (clinica_id, item_plan_id, laboratorio_id, tipo_trabajo)
  values ('e7e7e7e7-0000-0000-0000-000000000000', 'e7e7e7e7-0000-0000-0000-0000000000e1',
          (select id from o), 'Ajena')$$, 'No autorizado');
reset role;
select pruebas.como(null);
\echo 'laboratorio: todas las aserciones pasaron'
