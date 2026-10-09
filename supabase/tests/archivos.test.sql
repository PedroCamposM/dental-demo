-- Etapa 7.1 (v2): imágenes y archivos clínicos en Storage privado.
-- Regla 1 (no se borran: se anulan), regla 8 (clínica + RLS) y regla 9 (solo personal clínico).
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values
  ('ae000000-0000-0000-0000-00000000000a'), ('ae000000-0000-0000-0000-00000000000b'),
  ('ae000000-0000-0000-0000-00000000000c'), ('ae000000-0000-0000-0000-00000000000d'),
  ('be000000-0000-0000-0000-00000000000a');
insert into public.clinica (id, nombre) values
  ('aeaeaeae-0000-0000-0000-000000000000', 'Clínica R'),
  ('bebebebe-0000-0000-0000-000000000000', 'Clínica S');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('ae000000-0000-0000-0000-00000000000a', 'aeaeaeae-0000-0000-0000-000000000000', 'Admin R',      'admin',      '9801'),
  ('ae000000-0000-0000-0000-00000000000b', 'aeaeaeae-0000-0000-0000-000000000000', 'Odontóloga R', 'odontologo', '9802'),
  ('ae000000-0000-0000-0000-00000000000c', 'aeaeaeae-0000-0000-0000-000000000000', 'Asistente R',  'asistente',  null),
  ('ae000000-0000-0000-0000-00000000000d', 'aeaeaeae-0000-0000-0000-000000000000', 'Recepción R',  'recepcion',  null),
  ('be000000-0000-0000-0000-00000000000a', 'bebebebe-0000-0000-0000-000000000000', 'Admin S',      'admin',      '9901');
insert into public.paciente (id, clinica_id, dni, nombres, apellidos, fecha_nacimiento) values
  ('aeaeaeae-0000-0000-0000-0000000000f1', 'aeaeaeae-0000-0000-0000-000000000000', '61000001', 'Ana', 'Imagen', '1990-01-01'),
  ('aeaeaeae-0000-0000-0000-0000000000f2', 'aeaeaeae-0000-0000-0000-000000000000', '61000002', 'Ana', 'Imagen', '1990-01-01'),
  ('bebebebe-0000-0000-0000-0000000000f1', 'bebebebe-0000-0000-0000-000000000000', '61000003', 'Otra', 'Clínica', '1990-01-01');

set role authenticated;

-- ---------------------------------------------------------------------------
-- Storage: sube el personal clínico, solo a su clínica y a un paciente vigente
-- ---------------------------------------------------------------------------
select pruebas.como('ae000000-0000-0000-0000-00000000000b');
insert into storage.objects (bucket_id, name) values
  ('clinico', 'aeaeaeae-0000-0000-0000-000000000000/aeaeaeae-0000-0000-0000-0000000000f1/11111111-1111-4111-8111-111111111111.jpg');
select pruebas.debe_fallar($$insert into storage.objects (bucket_id, name) values
  ('clinico', 'bebebebe-0000-0000-0000-000000000000/bebebebe-0000-0000-0000-0000000000f1/22222222-2222-4222-8222-222222222222.jpg')$$,
  'row-level security');
select pruebas.debe_fallar($$insert into storage.objects (bucket_id, name) values
  ('clinico', 'aeaeaeae-0000-0000-0000-000000000000/bebebebe-0000-0000-0000-0000000000f1/22222222-2222-4222-8222-222222222222.jpg')$$,
  'row-level security');
select pruebas.como('ae000000-0000-0000-0000-00000000000c');   -- la asistente toma radiografías
insert into storage.objects (bucket_id, name) values
  ('clinico', 'aeaeaeae-0000-0000-0000-000000000000/aeaeaeae-0000-0000-0000-0000000000f1/33333333-3333-4333-8333-333333333333.pdf');
select pruebas.como('ae000000-0000-0000-0000-00000000000d');   -- recepción no sube ni ve
select pruebas.debe_fallar($$insert into storage.objects (bucket_id, name) values
  ('clinico', 'aeaeaeae-0000-0000-0000-000000000000/aeaeaeae-0000-0000-0000-0000000000f1/44444444-4444-4444-8444-444444444444.jpg')$$,
  'row-level security');
select pruebas.igual((select count(*) from storage.objects where bucket_id = 'clinico'), 0, 'recepción no ve archivos');
select pruebas.como('be000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from storage.objects where bucket_id = 'clinico'), 0, 'otra clínica no ve archivos');

-- ---------------------------------------------------------------------------
-- archivo_clinico: solo con el objeto subido, en la ruta del paciente
-- ---------------------------------------------------------------------------
select pruebas.como('ae000000-0000-0000-0000-00000000000b');
select pruebas.debe_fallar($$insert into public.archivo_clinico (clinica_id, paciente_id, tipo, ruta, mime, bytes, tomada_el, subido_por)
  values ('aeaeaeae-0000-0000-0000-000000000000', 'aeaeaeae-0000-0000-0000-0000000000f1', 'radiografia',
          'aeaeaeae-0000-0000-0000-000000000000/aeaeaeae-0000-0000-0000-0000000000f1/55555555-5555-4555-8555-555555555555.jpg',
          'image/jpeg', 1000, current_date, 'ae000000-0000-0000-0000-00000000000b')$$, 'no se terminó de subir');
select pruebas.debe_fallar($$insert into public.archivo_clinico (clinica_id, paciente_id, tipo, ruta, mime, bytes, tomada_el, subido_por)
  values ('aeaeaeae-0000-0000-0000-000000000000', 'aeaeaeae-0000-0000-0000-0000000000f2', 'radiografia',
          'aeaeaeae-0000-0000-0000-000000000000/aeaeaeae-0000-0000-0000-0000000000f1/11111111-1111-4111-8111-111111111111.jpg',
          'image/jpeg', 1000, current_date, 'ae000000-0000-0000-0000-00000000000b')$$, 'Ruta de archivo inválida');
select pruebas.debe_fallar($$insert into public.archivo_clinico (clinica_id, paciente_id, tipo, ruta, mime, bytes, tomada_el, subido_por)
  values ('aeaeaeae-0000-0000-0000-000000000000', 'aeaeaeae-0000-0000-0000-0000000000f1', 'radiografia',
          'aeaeaeae-0000-0000-0000-000000000000/aeaeaeae-0000-0000-0000-0000000000f1/11111111-1111-4111-8111-111111111111.jpg',
          'image/jpeg', 1000, current_date + 2, 'ae000000-0000-0000-0000-00000000000b')$$, 'futura');
select pruebas.debe_fallar($$insert into public.archivo_clinico (clinica_id, paciente_id, tipo, ruta, mime, bytes, tomada_el, subido_por)
  values ('aeaeaeae-0000-0000-0000-000000000000', 'aeaeaeae-0000-0000-0000-0000000000f1', 'consentimiento',
          'aeaeaeae-0000-0000-0000-000000000000/aeaeaeae-0000-0000-0000-0000000000f1/11111111-1111-4111-8111-111111111111.jpg',
          'image/jpeg', 1000, current_date, 'ae000000-0000-0000-0000-00000000000b')$$, 'row-level security');
select pruebas.debe_fallar($$insert into public.archivo_clinico (clinica_id, paciente_id, tipo, ruta, mime, bytes, tomada_el, subido_por)
  values ('aeaeaeae-0000-0000-0000-000000000000', 'aeaeaeae-0000-0000-0000-0000000000f1', 'radiografia',
          'aeaeaeae-0000-0000-0000-000000000000/aeaeaeae-0000-0000-0000-0000000000f1/11111111-1111-4111-8111-111111111111.jpg',
          'image/jpeg', 1000, current_date, 'ae000000-0000-0000-0000-00000000000c')$$, 'row-level security');
insert into public.archivo_clinico (id, clinica_id, paciente_id, tipo, ruta, mime, bytes, tomada_el, pieza, subido_por) values
  ('aeaeaeae-0000-0000-0000-0000000000a1', 'aeaeaeae-0000-0000-0000-000000000000', 'aeaeaeae-0000-0000-0000-0000000000f1',
   'radiografia', 'aeaeaeae-0000-0000-0000-000000000000/aeaeaeae-0000-0000-0000-0000000000f1/11111111-1111-4111-8111-111111111111.jpg',
   'image/jpeg', 120000, current_date, 36, 'ae000000-0000-0000-0000-00000000000b');
select pruebas.debe_fallar($$insert into public.archivo_clinico (clinica_id, paciente_id, tipo, ruta, mime, bytes, tomada_el, pieza, subido_por)
  values ('aeaeaeae-0000-0000-0000-000000000000', 'aeaeaeae-0000-0000-0000-0000000000f1', 'radiografia',
          'aeaeaeae-0000-0000-0000-000000000000/aeaeaeae-0000-0000-0000-0000000000f1/33333333-3333-4333-8333-333333333333.pdf',
          'application/pdf', 1000, current_date, 19, 'ae000000-0000-0000-0000-00000000000b')$$, 'check constraint');

select pruebas.como('ae000000-0000-0000-0000-00000000000c');
insert into public.archivo_clinico (id, clinica_id, paciente_id, tipo, ruta, mime, bytes, tomada_el, subido_por) values
  ('aeaeaeae-0000-0000-0000-0000000000a2', 'aeaeaeae-0000-0000-0000-000000000000', 'aeaeaeae-0000-0000-0000-0000000000f1',
   'documento', 'aeaeaeae-0000-0000-0000-000000000000/aeaeaeae-0000-0000-0000-0000000000f1/33333333-3333-4333-8333-333333333333.pdf',
   'application/pdf', 5000, current_date - 30, 'ae000000-0000-0000-0000-00000000000c');

-- Regla 1: no se edita ni se borra; se anula con motivo
select pruebas.debe_fallar($$update public.archivo_clinico set pieza = 46 where id = 'aeaeaeae-0000-0000-0000-0000000000a2'$$,
                           'permission denied');
select pruebas.debe_fallar($$delete from public.archivo_clinico$$, 'permission denied');
delete from storage.objects;   -- sin política de DELETE: no borra nada
select pruebas.igual((select count(*) from storage.objects where bucket_id = 'clinico'), 2, 'los objetos no se borran');
-- La asistente no anula lo que subió otra persona; sí lo suyo
update public.archivo_clinico set anulado_at = now(), anulado_por = 'ae000000-0000-0000-0000-00000000000c',
       motivo_anulacion = 'Error' where id = 'aeaeaeae-0000-0000-0000-0000000000a1';   -- RLS: 0 filas
select pruebas.igual((select count(*) from public.archivo_clinico where id = 'aeaeaeae-0000-0000-0000-0000000000a1'
                        and anulado_at is null), 1, 'la asistente no anula lo ajeno');
update public.archivo_clinico set anulado_at = now(), anulado_por = 'ae000000-0000-0000-0000-00000000000c',
       motivo_anulacion = 'Documento de otro paciente' where id = 'aeaeaeae-0000-0000-0000-0000000000a2';
select pruebas.igual((select count(*) from public.archivo_clinico where id = 'aeaeaeae-0000-0000-0000-0000000000a2'
                        and anulado_at is not null), 1, 'anulado con motivo');

-- Recepción y otra clínica no ven nada
select pruebas.como('ae000000-0000-0000-0000-00000000000d');
select pruebas.igual((select count(*) from public.archivo_clinico), 0, 'recepción no ve archivos clínicos');
select pruebas.como('be000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.archivo_clinico), 0, 'otra clínica no ve archivos');

-- La fusión lleva los archivos al paciente que se conserva
select pruebas.como('ae000000-0000-0000-0000-00000000000a');
select pruebas.igual((select (public.fusionar_pacientes('aeaeaeae-0000-0000-0000-0000000000f1',
                       'aeaeaeae-0000-0000-0000-0000000000f2', 'Registro duplicado') ->> 'archivos')::int), 2,
                     'la fusión mueve los archivos');
-- Al paciente fusionado (anulado) ya no se le suben archivos
select pruebas.debe_fallar($$insert into storage.objects (bucket_id, name) values
  ('clinico', 'aeaeaeae-0000-0000-0000-000000000000/aeaeaeae-0000-0000-0000-0000000000f1/66666666-6666-4666-8666-666666666666.jpg')$$,
  'row-level security');

reset role;
set role anon;
select pruebas.debe_fallar('select 1 from public.archivo_clinico', 'permission denied');
reset role;
select pruebas.como(null);
\echo 'archivos: todas las aserciones pasaron'
