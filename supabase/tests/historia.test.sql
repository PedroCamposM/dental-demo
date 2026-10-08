-- Etapa 3 (v2): historia clínica versionada, signos vitales y alertas.
-- Reglas 1 (nada se borra; versiones y anulación), 4 (alertas para todo el equipo)
-- y 9 (la historia solo la ven dentistas y asistente, en RLS).
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values
  ('a8000000-0000-0000-0000-00000000000a'), ('a8000000-0000-0000-0000-00000000000b'),
  ('a8000000-0000-0000-0000-00000000000c'), ('a8000000-0000-0000-0000-00000000000d'),
  ('a8000000-0000-0000-0000-00000000000e'), ('b8000000-0000-0000-0000-00000000000a');
insert into public.clinica (id, nombre) values
  ('a8a8a8a8-0000-0000-0000-000000000000', 'Clínica J'),
  ('b8b8b8b8-0000-0000-0000-000000000000', 'Clínica K');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('a8000000-0000-0000-0000-00000000000a', 'a8a8a8a8-0000-0000-0000-000000000000', 'Admin J',        'admin',      '9001'),
  ('a8000000-0000-0000-0000-00000000000b', 'a8a8a8a8-0000-0000-0000-000000000000', 'Odontóloga J',   'odontologo', '9002'),
  ('a8000000-0000-0000-0000-00000000000c', 'a8a8a8a8-0000-0000-0000-000000000000', 'Asistente J',    'asistente',  null),
  ('a8000000-0000-0000-0000-00000000000d', 'a8a8a8a8-0000-0000-0000-000000000000', 'Recepción J',    'recepcion',  null),
  ('a8000000-0000-0000-0000-00000000000e', 'a8a8a8a8-0000-0000-0000-000000000000', 'Gerente sin COP', 'admin',     null),
  ('b8000000-0000-0000-0000-00000000000a', 'b8b8b8b8-0000-0000-0000-000000000000', 'Admin K',        'admin',      '9101');
insert into public.paciente (id, clinica_id, dni, nombres, apellidos) values
  ('a8a8a8a8-0000-0000-0000-0000000000f1', 'a8a8a8a8-0000-0000-0000-000000000000', '48000001', 'Rosa', 'Historia'),
  ('a8a8a8a8-0000-0000-0000-0000000000f2', 'a8a8a8a8-0000-0000-0000-000000000000', '48000002', 'Rosa', 'Historia Dos');

set role authenticated;

-- ---------------------------------------------------------------------------
-- Cuestionario versionado
-- ---------------------------------------------------------------------------
select pruebas.como('a8000000-0000-0000-0000-00000000000c');   -- el asistente registra la primera versión
insert into public.cuestionario_salud (clinica_id, paciente_id, registrado_por, motivo_consulta, alergias)
values ('a8a8a8a8-0000-0000-0000-000000000000', 'a8a8a8a8-0000-0000-0000-0000000000f1',
        'a8000000-0000-0000-0000-00000000000c', 'Dolor en molar inferior', array['Penicilina']);
select pruebas.debe_fallar($$insert into public.cuestionario_salud (clinica_id, paciente_id, registrado_por, motivo_consulta)
  values ('a8a8a8a8-0000-0000-0000-000000000000', 'a8a8a8a8-0000-0000-0000-0000000000f1',
          'a8000000-0000-0000-0000-00000000000b', 'A nombre de otro')$$, 'row-level security');

select pruebas.como('a8000000-0000-0000-0000-00000000000b');   -- la odontóloga actualiza: versión 2
insert into public.cuestionario_salud (clinica_id, paciente_id, registrado_por, motivo_consulta, alergias, anticoagulado,
                                       anticoagulante, enfermedades, embarazo, semanas_gestacion)
values ('a8a8a8a8-0000-0000-0000-000000000000', 'a8a8a8a8-0000-0000-0000-0000000000f1',
        'a8000000-0000-0000-0000-00000000000b', 'Control', array[' Penicilina ', 'Látex', 'Penicilina', ''],
        true, 'Warfarina 5 mg', array['hipertension'], 'si', 20);
select pruebas.igual((select count(*) from public.cuestionario_salud
                      where paciente_id = 'a8a8a8a8-0000-0000-0000-0000000000f1' and version = 2
                        and alergias = array['Látex', 'Penicilina']), 1, 'versión 2 con alergias normalizadas');
select pruebas.igual((select count(*) from public.cuestionario_salud
                      where paciente_id = 'a8a8a8a8-0000-0000-0000-0000000000f1'), 2, 'la versión anterior se conserva');

-- Validaciones del servidor
select pruebas.debe_fallar($$insert into public.cuestionario_salud (clinica_id, paciente_id, registrado_por, motivo_consulta, anticoagulado)
  values ('a8a8a8a8-0000-0000-0000-000000000000', 'a8a8a8a8-0000-0000-0000-0000000000f1',
          'a8000000-0000-0000-0000-00000000000b', 'Control', true)$$, 'cuestionario_anticoagulante');
select pruebas.debe_fallar($$insert into public.cuestionario_salud (clinica_id, paciente_id, registrado_por, motivo_consulta, embarazo, semanas_gestacion)
  values ('a8a8a8a8-0000-0000-0000-000000000000', 'a8a8a8a8-0000-0000-0000-0000000000f1',
          'a8000000-0000-0000-0000-00000000000b', 'Control', 'no', 12)$$, 'cuestionario_semanas');
select pruebas.debe_fallar($$insert into public.cuestionario_salud (clinica_id, paciente_id, registrado_por, motivo_consulta, enfermedades)
  values ('a8a8a8a8-0000-0000-0000-000000000000', 'a8a8a8a8-0000-0000-0000-0000000000f1',
          'a8000000-0000-0000-0000-00000000000b', 'Control', array['inventada'])$$, 'check constraint');

-- Nada se edita ni se borra (regla 1)
select pruebas.debe_fallar($$update public.cuestionario_salud set motivo_consulta = 'Editado'
                             where paciente_id = 'a8a8a8a8-0000-0000-0000-0000000000f1'$$, 'permission denied');
select pruebas.debe_fallar($$delete from public.cuestionario_salud$$, 'permission denied');

-- ---------------------------------------------------------------------------
-- Recepción: no ve la historia, pero sí las alertas (solo lo registrado)
-- ---------------------------------------------------------------------------
select pruebas.como('a8000000-0000-0000-0000-00000000000d');
select pruebas.igual((select count(*) from public.cuestionario_salud), 0, 'recepción no ve la historia');
select pruebas.debe_fallar($$insert into public.cuestionario_salud (clinica_id, paciente_id, registrado_por, motivo_consulta)
  values ('a8a8a8a8-0000-0000-0000-000000000000', 'a8a8a8a8-0000-0000-0000-0000000000f1',
          'a8000000-0000-0000-0000-00000000000d', 'Intento')$$, 'row-level security');
select pruebas.igual((select count(*) from public.alertas_pacientes(array['a8a8a8a8-0000-0000-0000-0000000000f1']::uuid[])
                      where alergias = array['Látex', 'Penicilina'] and anticoagulante = 'Warfarina 5 mg'
                        and enfermedades = array['hipertension'] and embarazo and semanas_gestacion = 20),
                     1, 'recepción ve las alertas de la versión vigente');
select pruebas.debe_fallar($$select public.registrar_lectura_historia('a8a8a8a8-0000-0000-0000-0000000000f1')$$,
                           'no accede a la historia');

-- ---------------------------------------------------------------------------
-- Signos vitales: el asistente los registra; se anulan con motivo
-- ---------------------------------------------------------------------------
select pruebas.como('a8000000-0000-0000-0000-00000000000c');
insert into public.signos_vitales (id, clinica_id, paciente_id, registrado_por, presion_sistolica, presion_diastolica,
                                   frecuencia_cardiaca, temperatura_c, peso_kg, talla_cm)
values ('a8a8a8a8-0000-0000-0000-0000000000a1', 'a8a8a8a8-0000-0000-0000-000000000000', 'a8a8a8a8-0000-0000-0000-0000000000f1',
        'a8000000-0000-0000-0000-00000000000c', 120, 80, 72, 36.6, 64.5, 158);
select pruebas.debe_fallar($$insert into public.signos_vitales (clinica_id, paciente_id, registrado_por, presion_sistolica, presion_diastolica)
  values ('a8a8a8a8-0000-0000-0000-000000000000', 'a8a8a8a8-0000-0000-0000-0000000000f1',
          'a8000000-0000-0000-0000-00000000000c', 80, 120)$$, 'signos_presion_coherente');
select pruebas.debe_fallar($$insert into public.signos_vitales (clinica_id, paciente_id, registrado_por)
  values ('a8a8a8a8-0000-0000-0000-000000000000', 'a8a8a8a8-0000-0000-0000-0000000000f1',
          'a8000000-0000-0000-0000-00000000000c')$$, 'signos_algun_dato');
select pruebas.debe_fallar($$insert into public.signos_vitales (clinica_id, paciente_id, registrado_por, temperatura_c)
  values ('a8a8a8a8-0000-0000-0000-000000000000', 'a8a8a8a8-0000-0000-0000-0000000000f1',
          'a8000000-0000-0000-0000-00000000000c', 45)$$, 'check constraint');
select pruebas.debe_fallar($$update public.signos_vitales set peso_kg = 70 where id = 'a8a8a8a8-0000-0000-0000-0000000000a1'$$,
                           'permission denied');
update public.signos_vitales set anulado_at = now(), anulado_por = 'a8000000-0000-0000-0000-00000000000c',
       motivo_anulacion = 'Peso mal digitado' where id = 'a8a8a8a8-0000-0000-0000-0000000000a1';
select pruebas.debe_fallar($$update public.signos_vitales set anulado_at = now(), anulado_por = 'a8000000-0000-0000-0000-00000000000c',
       motivo_anulacion = 'Otra vez' where id = 'a8a8a8a8-0000-0000-0000-0000000000a1'$$, 'ya está anulado');
select pruebas.como('a8000000-0000-0000-0000-00000000000d');
select pruebas.igual((select count(*) from public.signos_vitales), 0, 'recepción no ve los signos vitales');

-- ---------------------------------------------------------------------------
-- Lectura de la historia: queda en la auditoría (sin repetir en 10 minutos)
-- ---------------------------------------------------------------------------
select pruebas.como('a8000000-0000-0000-0000-00000000000c');
select public.registrar_lectura_historia('a8a8a8a8-0000-0000-0000-0000000000f1');
select public.registrar_lectura_historia('a8a8a8a8-0000-0000-0000-0000000000f1');
reset role;
select pruebas.igual((select count(*) from public.auditoria where tabla = 'historia_clinica' and accion = 'lectura'
                        and registro_id = 'a8a8a8a8-0000-0000-0000-0000000000f1'
                        and usuario_id = 'a8000000-0000-0000-0000-00000000000c'), 1, 'lectura registrada una vez');
set role authenticated;
select pruebas.como('a8000000-0000-0000-0000-00000000000e');   -- admin sin COP: no ve lo clínico en la auditoría
select pruebas.igual((select count(*) from public.auditoria
                      where tabla in ('cuestionario_salud', 'signos_vitales', 'historia_clinica')), 0,
                     'admin sin COP no ve la auditoría clínica');
select pruebas.como('a8000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.auditoria where tabla = 'historia_clinica'), 1,
                     'admin con COP ve las lecturas de la historia');

-- ---------------------------------------------------------------------------
-- Fusión: la historia del duplicado pasa al que se conserva, en versiones nuevas
-- ---------------------------------------------------------------------------
select pruebas.como('a8000000-0000-0000-0000-00000000000b');
insert into public.cuestionario_salud (clinica_id, paciente_id, registrado_por, motivo_consulta, alergias)
values ('a8a8a8a8-0000-0000-0000-000000000000', 'a8a8a8a8-0000-0000-0000-0000000000f2',
        'a8000000-0000-0000-0000-00000000000b', 'Registro duplicado', array['Ibuprofeno']);
select pruebas.como('a8000000-0000-0000-0000-00000000000a');
select public.fusionar_pacientes('a8a8a8a8-0000-0000-0000-0000000000f2', 'a8a8a8a8-0000-0000-0000-0000000000f1',
                                 'Se registró dos veces');
select pruebas.igual((select count(*) from public.cuestionario_salud
                      where paciente_id = 'a8a8a8a8-0000-0000-0000-0000000000f1' and version = 3
                        and motivo_consulta = 'Registro duplicado'), 1, 'la historia del duplicado pasa como versión 3');
select pruebas.igual((select count(*) from public.alertas_pacientes(array['a8a8a8a8-0000-0000-0000-0000000000f1']::uuid[])
                      where alergias = array['Ibuprofeno']), 1, 'la alerta vigente es la última registrada');
select pruebas.debe_fallar($$insert into public.cuestionario_salud (clinica_id, paciente_id, registrado_por, motivo_consulta)
  values ('a8a8a8a8-0000-0000-0000-000000000000', 'a8a8a8a8-0000-0000-0000-0000000000f2',
          'a8000000-0000-0000-0000-00000000000a', 'En el anulado')$$, 'anulado');

-- ---------------------------------------------------------------------------
-- Otra clínica y visitante sin sesión
-- ---------------------------------------------------------------------------
select pruebas.como('b8000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.cuestionario_salud) + (select count(*) from public.signos_vitales)
                     + (select count(*) from public.alertas_pacientes(array['a8a8a8a8-0000-0000-0000-0000000000f1']::uuid[])),
                     0, 'otra clínica no ve historia, signos ni alertas');
select pruebas.debe_fallar($$select public.registrar_lectura_historia('a8a8a8a8-0000-0000-0000-0000000000f1')$$,
                           'Paciente no encontrado');
reset role;
set role anon;
select pruebas.debe_fallar('select 1 from public.cuestionario_salud', 'permission denied');
select pruebas.debe_fallar($$select * from public.alertas_pacientes(array[gen_random_uuid()])$$, 'permission denied');
reset role;
select pruebas.como(null);
select 'historia: todas las aserciones pasaron' as resultado;
