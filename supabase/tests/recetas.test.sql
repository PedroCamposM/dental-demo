-- Etapa 7.3 (v2): recetas, constancias de atención y certificados de descanso.
-- Solo el cirujano dentista emite; nada se edita ni se borra (se anula con motivo).
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values
  ('a1000000-0000-0000-0000-00000000000a'), ('a1000000-0000-0000-0000-00000000000b'),
  ('a1000000-0000-0000-0000-00000000000c'), ('a1000000-0000-0000-0000-00000000000d'),
  ('b1000000-0000-0000-0000-00000000000a');
insert into public.clinica (id, nombre) values
  ('a1a1a1a1-0000-0000-0000-000000000000', 'Clínica V'),
  ('b1b1b1b1-0000-0000-0000-000000000000', 'Clínica W');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('a1000000-0000-0000-0000-00000000000a', 'a1a1a1a1-0000-0000-0000-000000000000', 'Admin V',      'admin',      '9821'),
  ('a1000000-0000-0000-0000-00000000000b', 'a1a1a1a1-0000-0000-0000-000000000000', 'Odontóloga V', 'odontologo', '9822'),
  ('a1000000-0000-0000-0000-00000000000c', 'a1a1a1a1-0000-0000-0000-000000000000', 'Asistente V',  'asistente',  null),
  ('a1000000-0000-0000-0000-00000000000d', 'a1a1a1a1-0000-0000-0000-000000000000', 'Recepción V',  'recepcion',  null),
  ('b1000000-0000-0000-0000-00000000000a', 'b1b1b1b1-0000-0000-0000-000000000000', 'Admin W',      'admin',      '9921');
insert into public.paciente (id, clinica_id, dni, nombres, apellidos, fecha_nacimiento) values
  ('a1a1a1a1-0000-0000-0000-0000000000f1', 'a1a1a1a1-0000-0000-0000-000000000000', '63000001', 'Rita', 'Receta', '1985-01-01'),
  ('a1a1a1a1-0000-0000-0000-0000000000f2', 'a1a1a1a1-0000-0000-0000-000000000000', '63000002', 'Otro', 'Paciente', '1985-01-01');
insert into public.nota_evolucion (id, clinica_id, paciente_id, odontologo_id, texto) values
  ('a1a1a1a1-0000-0000-0000-000000000091', 'a1a1a1a1-0000-0000-0000-000000000000', 'a1a1a1a1-0000-0000-0000-0000000000f2',
   'a1000000-0000-0000-0000-00000000000b', 'Sesión de otro paciente');

set role authenticated;

-- ---------------------------------------------------------------------------
-- Receta: la emite el cirujano dentista, con sus medicamentos, en una sola operación
-- ---------------------------------------------------------------------------
select pruebas.como('a1000000-0000-0000-0000-00000000000c');
select pruebas.debe_fallar($$select public.emitir_receta('a1a1a1a1-0000-0000-0000-0000000000f1', null, null,
  '[{"medicamento":"Amoxicilina","presentacion":"500 mg","dosis":"1 tableta","frecuencia":"cada 8 horas","duracion":"7 días"}]')$$,
  'cirujano dentista');
select pruebas.como('a1000000-0000-0000-0000-00000000000b');
select pruebas.debe_fallar($$select public.emitir_receta('a1a1a1a1-0000-0000-0000-0000000000f1', null, null, '[]')$$,
                           'entre 1 y 20');
select pruebas.debe_fallar($$select public.emitir_receta('a1a1a1a1-0000-0000-0000-0000000000f1', null, null,
  '[{"medicamento":"Ibuprofeno","presentacion":"400 mg","dosis":"","frecuencia":"cada 8 horas","duracion":"3 días"}]')$$,
  'check constraint');
select pruebas.debe_fallar($$select public.emitir_receta('a1a1a1a1-0000-0000-0000-0000000000f1',
  'a1a1a1a1-0000-0000-0000-000000000091', null,
  '[{"medicamento":"Ibuprofeno","presentacion":"400 mg","dosis":"1 tableta","frecuencia":"cada 8 horas","duracion":"3 días"}]')$$,
  'no corresponde');
create temp table ids (clave text primary key, id uuid);
grant all on ids to authenticated;
insert into ids select 'r', public.emitir_receta('a1a1a1a1-0000-0000-0000-0000000000f1', null, 'Dieta blanda',
  '[{"medicamento":"Ibuprofeno","presentacion":"400 mg tabletas","dosis":"1 tableta","frecuencia":"cada 8 horas","duracion":"3 días","indicaciones":"después de comer"},
    {"medicamento":"Clorhexidina","presentacion":"0.12% colutorio","dosis":"15 ml","frecuencia":"cada 12 horas","duracion":"7 días"}]');
select pruebas.igual((select count(*) from public.receta_item i join ids on ids.id = i.receta_id), 2, 'dos medicamentos en orden');
select pruebas.igual((select count(*) from public.receta r join ids on ids.id = r.id
                       where r.profesional_id = 'a1000000-0000-0000-0000-00000000000b'), 1, 'emitida a nombre de quien la firma');
select pruebas.debe_fallar($$insert into public.receta (clinica_id, paciente_id, profesional_id)
  values ('a1a1a1a1-0000-0000-0000-000000000000', 'a1a1a1a1-0000-0000-0000-0000000000f1', 'a1000000-0000-0000-0000-00000000000b')$$,
  'permission denied');
select pruebas.debe_fallar($$update public.receta_item set dosis = '2 tabletas'$$, 'permission denied');
select pruebas.debe_fallar($$update public.receta set indicaciones = 'Otra' where id = (select id from ids where clave = 'r')$$,
                           'permission denied');
select pruebas.debe_fallar($$delete from public.receta$$, 'permission denied');
update public.receta set anulado_at = now(), anulado_por = 'a1000000-0000-0000-0000-00000000000b',
       motivo_anulacion = 'Error en la presentación' where id = (select id from ids where clave = 'r');
select pruebas.igual((select count(*) from public.receta r join ids on ids.id = r.id where r.anulado_at is not null), 1,
                     'receta anulada con motivo');

-- Plantillas: solo las propias
insert into public.plantilla_receta (clinica_id, profesional_id, nombre, items) values
  ('a1a1a1a1-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-00000000000b', 'Postexodoncia',
   '[{"medicamento":"Ibuprofeno","presentacion":"400 mg","dosis":"1 tableta","frecuencia":"cada 8 horas","duracion":"3 días"}]');
select pruebas.como('a1000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.plantilla_receta), 0, 'las plantillas son de cada profesional');

-- ---------------------------------------------------------------------------
-- Constancias y certificados
-- ---------------------------------------------------------------------------
select pruebas.como('a1000000-0000-0000-0000-00000000000b');
insert into public.constancia (id, clinica_id, paciente_id, profesional_id, tipo, fecha_atencion, hora_inicio, hora_fin) values
  ('a1a1a1a1-0000-0000-0000-0000000000c1', 'a1a1a1a1-0000-0000-0000-000000000000', 'a1a1a1a1-0000-0000-0000-0000000000f1',
   'a1000000-0000-0000-0000-00000000000a', 'atencion', (now() at time zone 'America/Lima')::date, '09:00', '10:00');
select pruebas.igual((select count(*) from public.constancia where id = 'a1a1a1a1-0000-0000-0000-0000000000c1'
                       and profesional_id = 'a1000000-0000-0000-0000-00000000000b'), 1, 'firmada por quien la emite');
insert into public.constancia (clinica_id, paciente_id, profesional_id, tipo, fecha_atencion, descanso_desde, descanso_dias, cie10)
values ('a1a1a1a1-0000-0000-0000-000000000000', 'a1a1a1a1-0000-0000-0000-0000000000f1', 'a1000000-0000-0000-0000-00000000000b',
        'descanso', (now() at time zone 'America/Lima')::date, (now() at time zone 'America/Lima')::date, 2, 'K08.1');
select pruebas.debe_fallar($$insert into public.constancia (clinica_id, paciente_id, profesional_id, tipo, fecha_atencion)
  values ('a1a1a1a1-0000-0000-0000-000000000000', 'a1a1a1a1-0000-0000-0000-0000000000f1', 'a1000000-0000-0000-0000-00000000000b',
          'descanso', (now() at time zone 'America/Lima')::date)$$, 'constancia_tipo');
select pruebas.debe_fallar($$insert into public.constancia (clinica_id, paciente_id, profesional_id, tipo, fecha_atencion, descanso_desde, descanso_dias)
  values ('a1a1a1a1-0000-0000-0000-000000000000', 'a1a1a1a1-0000-0000-0000-0000000000f1', 'a1000000-0000-0000-0000-00000000000b',
          'descanso', (now() at time zone 'America/Lima')::date, (now() at time zone 'America/Lima')::date, 45)$$, 'check constraint');
select pruebas.debe_fallar($$insert into public.constancia (clinica_id, paciente_id, profesional_id, tipo, fecha_atencion)
  values ('a1a1a1a1-0000-0000-0000-000000000000', 'a1a1a1a1-0000-0000-0000-0000000000f1', 'a1000000-0000-0000-0000-00000000000b',
          'atencion', (now() at time zone 'America/Lima')::date + 1)$$, 'futura');
select pruebas.debe_fallar($$update public.constancia set observaciones = 'x' where id = 'a1a1a1a1-0000-0000-0000-0000000000c1'$$,
                           'permission denied');
select pruebas.como('a1000000-0000-0000-0000-00000000000c');
select pruebas.debe_fallar($$insert into public.constancia (clinica_id, paciente_id, profesional_id, tipo, fecha_atencion)
  values ('a1a1a1a1-0000-0000-0000-000000000000', 'a1a1a1a1-0000-0000-0000-0000000000f1', 'a1000000-0000-0000-0000-00000000000b',
          'atencion', (now() at time zone 'America/Lima')::date)$$, 'row-level security');
select pruebas.igual((select count(*) from public.constancia), 2, 'la asistente las ve');

-- Recepción, otra clínica y visitante
select pruebas.como('a1000000-0000-0000-0000-00000000000d');
select pruebas.igual((select count(*) from public.receta) + (select count(*) from public.receta_item)
                     + (select count(*) from public.constancia), 0, 'recepción no ve recetas ni constancias');
select pruebas.como('b1000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.receta) + (select count(*) from public.constancia), 0, 'otra clínica no ve nada');
select pruebas.debe_fallar($$select public.emitir_receta('a1a1a1a1-0000-0000-0000-0000000000f1', null, null,
  '[{"medicamento":"Ibuprofeno","presentacion":"400 mg","dosis":"1 tableta","frecuencia":"cada 8 horas","duracion":"3 días"}]')$$,
  'Paciente no encontrado');
reset role;
set role anon;
select pruebas.debe_fallar('select 1 from public.receta', 'permission denied');
select pruebas.debe_fallar($$select public.emitir_receta(null, null, null, '[]')$$, 'permission denied');
reset role;
select pruebas.como(null);
\echo 'recetas: todas las aserciones pasaron'
