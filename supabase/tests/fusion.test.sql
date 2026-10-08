-- Etapa 1 (v2): fusión de pacientes (solo admin, auditada, sin borrar nada).
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values
  ('91000000-0000-0000-0000-00000000000a'), ('91000000-0000-0000-0000-00000000000b'),
  ('91000000-0000-0000-0000-00000000000d'), ('92000000-0000-0000-0000-00000000000a'),
  ('91000000-0000-0000-0000-00000000000e');
insert into public.clinica (id, nombre) values
  ('99999999-0000-0000-0000-000000000001', 'Clínica G'), ('99999999-0000-0000-0000-000000000002', 'Clínica H');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('91000000-0000-0000-0000-00000000000a', '99999999-0000-0000-0000-000000000001', 'Admin G', 'admin', '6001'),
  ('91000000-0000-0000-0000-00000000000b', '99999999-0000-0000-0000-000000000001', 'Odontólogo G', 'odontologo', '6002'),
  ('91000000-0000-0000-0000-00000000000d', '99999999-0000-0000-0000-000000000001', 'Recepción G', 'recepcion', null),
  ('91000000-0000-0000-0000-00000000000e', '99999999-0000-0000-0000-000000000001', 'Gerente G sin COP', 'admin', null),
  ('92000000-0000-0000-0000-00000000000a', '99999999-0000-0000-0000-000000000002', 'Admin H', 'admin', '7001');
insert into public.paciente (id, clinica_id, numero_documento, nombres, apellidos, telefono, fecha_nacimiento) values
  ('99999999-0000-0000-0000-0000000000a1', '99999999-0000-0000-0000-000000000001', '43000001', 'Rosa', 'Duplicada', null, '1980-01-01'),
  ('99999999-0000-0000-0000-0000000000a2', '99999999-0000-0000-0000-000000000001', null, 'Rosa', 'Duplicada', '51955555555', '1980-01-01');

set role authenticated;
select pruebas.como('91000000-0000-0000-0000-00000000000b');
insert into public.nota_evolucion (clinica_id, paciente_id, odontologo_id, texto) values
  ('99999999-0000-0000-0000-000000000001', '99999999-0000-0000-0000-0000000000a2', '91000000-0000-0000-0000-00000000000b', 'Nota en el duplicado');
insert into public.odontograma (clinica_id, paciente_id, tipo, odontologo_id) values
  ('99999999-0000-0000-0000-000000000001', '99999999-0000-0000-0000-0000000000a2', 'inicial', '91000000-0000-0000-0000-00000000000b');
insert into public.cita (clinica_id, paciente_id, odontologo_id, inicio, fin) values
  ('99999999-0000-0000-0000-000000000001', '99999999-0000-0000-0000-0000000000a2', '91000000-0000-0000-0000-00000000000b',
   now() + interval '1 day', now() + interval '1 day 1 hour');
-- Plan con ítems en el duplicado: la fusión la hará un admin SIN COP (no es cirujano
-- dentista), que no puede editar planes pero sí fusionar.
insert into public.plan_tratamiento (id, clinica_id, paciente_id, odontologo_id, titulo) values
  ('99999999-0000-0000-0000-0000000000e1', '99999999-0000-0000-0000-000000000001', '99999999-0000-0000-0000-0000000000a2',
   '91000000-0000-0000-0000-00000000000b', 'Plan del duplicado');
insert into public.item_plan (clinica_id, plan_id, pieza, procedimiento, precio_centimos, odontologo_id) values
  ('99999999-0000-0000-0000-000000000001', '99999999-0000-0000-0000-0000000000e1', 16, 'Resina', 18000,
   '91000000-0000-0000-0000-00000000000b');

-- Nadie puede mover registros clínicos de paciente por fuera de la fusión, aunque
-- active la marca de fusión en su sesión: el GRANT por columnas lo impide, y el
-- trigger solo hace la excepción dentro de la función (no como "authenticated").
select set_config('dental.fusion', 'on', false);
select pruebas.debe_fallar($$update public.nota_evolucion set paciente_id = '99999999-0000-0000-0000-0000000000a1'$$,
  'permission denied');
-- La guarda en sí: con la marca activada por un usuario (rol authenticated),
-- privado.en_fusion() sigue siendo falsa; solo es verdadera dentro de la función.
select pruebas.igual((select privado.en_fusion()::int), 0, 'la marca de fusión no sirve fuera de la función');
select set_config('dental.fusion', '', false);

select pruebas.como('91000000-0000-0000-0000-00000000000d');   -- recepción
select pruebas.debe_fallar($$select public.fusionar_pacientes('99999999-0000-0000-0000-0000000000a2',
  '99999999-0000-0000-0000-0000000000a1', 'Registro doble')$$, 'Solo el administrador');
select pruebas.como('92000000-0000-0000-0000-00000000000a');   -- admin de otra clínica
select pruebas.debe_fallar($$select public.fusionar_pacientes('99999999-0000-0000-0000-0000000000a2',
  '99999999-0000-0000-0000-0000000000a1', 'Registro doble')$$, 'no encontrado');

select pruebas.como('91000000-0000-0000-0000-00000000000e');   -- admin G sin COP
select pruebas.debe_fallar($$select public.fusionar_pacientes('99999999-0000-0000-0000-0000000000a2',
  '99999999-0000-0000-0000-0000000000a1', '')$$, 'motivo');
select pruebas.debe_fallar($$select public.fusionar_pacientes('99999999-0000-0000-0000-0000000000a1',
  '99999999-0000-0000-0000-0000000000a1', 'Mismo paciente')$$, 'distintos');
-- El conservado (a1) tiene documento y el duplicado (a2) no; probamos también el caso inverso más abajo.
select pruebas.igual((select (public.fusionar_pacientes('99999999-0000-0000-0000-0000000000a2',
  '99999999-0000-0000-0000-0000000000a1', 'Se registró dos veces en recepción') ->> 'notas')::bigint), 1, 'nota movida');
select pruebas.igual((select count(*) from public.plan_tratamiento where paciente_id = '99999999-0000-0000-0000-0000000000a1'), 1,
  'el plan (con ítems) pasó al conservado aunque quien fusiona no es dentista');
select pruebas.como('91000000-0000-0000-0000-00000000000a');   -- el admin con COP verifica lo clínico

select pruebas.igual((select count(*) from public.nota_evolucion where paciente_id = '99999999-0000-0000-0000-0000000000a1'), 1,
  'la nota está en el paciente que se conserva');
select pruebas.igual((select count(*) from public.odontograma where paciente_id = '99999999-0000-0000-0000-0000000000a1'), 1,
  'el odontograma está en el paciente que se conserva');
select pruebas.igual((select count(*) from public.cita where paciente_id = '99999999-0000-0000-0000-0000000000a1'), 1,
  'la cita está en el paciente que se conserva');
select pruebas.igual((select count(*) from public.paciente where id = '99999999-0000-0000-0000-0000000000a2'
                        and anulado_at is not null and fusionado_en = '99999999-0000-0000-0000-0000000000a1'), 1,
  'el duplicado queda anulado (no borrado) y apunta al que se conserva');
select pruebas.igual((select count(*) from public.paciente where id = '99999999-0000-0000-0000-0000000000a1'
                        and telefono = '51955555555'), 1, 'el celular del duplicado pasa al que se conserva');
select pruebas.igual((select count(*) from public.auditoria where accion = 'fusion'
                        and registro_id = '99999999-0000-0000-0000-0000000000a2'
                        and usuario_id = '91000000-0000-0000-0000-00000000000e'), 1, 'fusión en la auditoría, a nombre de quien fusionó');
select pruebas.debe_fallar($$select public.fusionar_pacientes('99999999-0000-0000-0000-0000000000a2',
  '99999999-0000-0000-0000-0000000000a1', 'Otra vez')$$, 'anulado');

-- El duplicado anulado no se reescribe ni se "desanula", ni siquiera por un admin
select pruebas.debe_fallar($$update public.paciente set anulado_at = null, anulado_por = null, motivo_anulacion = null
  where id = '99999999-0000-0000-0000-0000000000a2'$$, 'anulado');
select pruebas.como('91000000-0000-0000-0000-00000000000d');   -- recepción
select pruebas.debe_fallar($$update public.paciente set motivo_anulacion = 'Error de tipeo', fusionado_en = null
  where id = '99999999-0000-0000-0000-0000000000a2'$$, 'anulado');
select pruebas.debe_fallar($$update public.paciente set fusionado_en = '99999999-0000-0000-0000-0000000000a2'
  where id = '99999999-0000-0000-0000-0000000000a1'$$, 'Solo el administrador');
select pruebas.como('91000000-0000-0000-0000-00000000000a');   -- ni el admin lo hace a mano
select pruebas.debe_fallar($$update public.paciente set fusionado_en = '99999999-0000-0000-0000-0000000000a2'
  where id = '99999999-0000-0000-0000-0000000000a1'$$, 'Fusionar');
select pruebas.como('91000000-0000-0000-0000-00000000000d');
select pruebas.debe_fallar($$update public.paciente set ocupacion = 'Editada' where id = '99999999-0000-0000-0000-0000000000a2'$$,
  'anulado');
-- Nada nuevo a nombre del paciente fusionado
select pruebas.debe_fallar($$insert into public.cita (clinica_id, paciente_id, odontologo_id, inicio, fin)
  values ('99999999-0000-0000-0000-000000000001', '99999999-0000-0000-0000-0000000000a2', '91000000-0000-0000-0000-00000000000b',
          now() + interval '2 days', now() + interval '2 days 1 hour')$$, 'anulado');

-- Caso inverso: el duplicado tiene el documento y el conservado no; el documento se mueve
reset role;
select pruebas.como(null);
insert into public.paciente (id, clinica_id, numero_documento, nombres, apellidos, fecha_nacimiento) values
  ('99999999-0000-0000-0000-0000000000b1', '99999999-0000-0000-0000-000000000001', null, 'Luis', 'Sin Documento', '1975-03-03'),
  ('99999999-0000-0000-0000-0000000000b2', '99999999-0000-0000-0000-000000000001', '43000099', 'Luis', 'Sin Documento', '1975-03-03');
set role authenticated;
select pruebas.como('91000000-0000-0000-0000-00000000000a');
select public.fusionar_pacientes('99999999-0000-0000-0000-0000000000b2', '99999999-0000-0000-0000-0000000000b1', 'Doble registro');
select pruebas.igual((select count(*) from public.paciente where id = '99999999-0000-0000-0000-0000000000b1'
                        and numero_documento = '43000099' and dni = '43000099'), 1, 'el documento pasó al conservado');
reset role;

set role anon;
select pruebas.debe_fallar($$select public.fusionar_pacientes('99999999-0000-0000-0000-0000000000a2',
  '99999999-0000-0000-0000-0000000000a1', 'anon')$$, 'permission denied');
reset role;
select pruebas.como(null);

\echo 'fusion: todas las aserciones pasaron'
