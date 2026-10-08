-- Etapa 1 (v2): búsqueda de pacientes y posibles duplicados (con RLS por clínica).
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values ('e1000000-0000-0000-0000-00000000000d'), ('f1000000-0000-0000-0000-00000000000a');
insert into public.clinica (id, nombre) values
  ('eeeeeeee-0000-0000-0000-000000000000', 'Clínica E'), ('ffffffff-0000-0000-0000-000000000000', 'Clínica F');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('e1000000-0000-0000-0000-00000000000d', 'eeeeeeee-0000-0000-0000-000000000000', 'Recepción E', 'recepcion', null),
  ('f1000000-0000-0000-0000-00000000000a', 'ffffffff-0000-0000-0000-000000000000', 'Admin F', 'admin', '5001');
insert into public.paciente (clinica_id, numero_documento, nombres, apellidos, telefono, fecha_nacimiento) values
  ('eeeeeeee-0000-0000-0000-000000000000', '45612378', 'José Luis', 'Vásquez Rodríguez', '51987654321', '1990-05-10'),
  ('eeeeeeee-0000-0000-0000-000000000000', '45612399', 'María', 'Núñez Paredes', '51911222333', '1975-01-20'),
  ('ffffffff-0000-0000-0000-000000000000', '45612388', 'José', 'Vásquez Otra Clínica', '51987654322', '1990-05-10');

set role authenticated;
select pruebas.como('e1000000-0000-0000-0000-00000000000d');
select pruebas.igual((select count(*) from public.buscar_pacientes('4561')), 2, 'por documento: solo de su clínica');
select pruebas.igual((select count(*) from public.buscar_pacientes('jose vasquez')), 1, 'por nombre sin tildes');
select pruebas.igual((select count(*) from public.buscar_pacientes('RODRIGUEZ josé')), 1, 'palabras en cualquier orden');
select pruebas.igual((select count(*) from public.buscar_pacientes('987 654 321')), 1, 'por teléfono con espacios');
select pruebas.igual((select count(*) from public.buscar_pacientes('nunez')), 1, 'ñ y tildes');
select pruebas.igual((select count(*) from public.buscar_pacientes('x')), 0, 'texto muy corto no busca');
select pruebas.igual((select count(*) from public.posibles_duplicados('JOSÉ LUIS', 'vasquez  rodriguez', '1990-05-10')), 1,
                     'duplicado: mismo nombre normalizado y fecha');
select pruebas.igual((select count(*) from public.posibles_duplicados('José Luis', 'Vásquez Rodríguez', '1990-05-11')), 0,
                     'otra fecha no es duplicado');
reset role;

set role anon;
select pruebas.debe_fallar($$select * from public.buscar_pacientes('jose')$$, 'permission denied');
reset role;
select pruebas.como(null);

\echo 'busqueda: todas las aserciones pasaron'
