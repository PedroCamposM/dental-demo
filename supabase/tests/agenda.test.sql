-- Etapa 2 (v2): sillones, horarios, bloqueos y validación de citas.
-- Regla: no se cita fuera del horario ni sobre un bloqueo, salvo que el admin lo
-- fuerce con motivo (queda registrado). Nunca dos citas activas superpuestas para
-- el mismo profesional ni el mismo sillón.
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values
  ('a7000000-0000-0000-0000-00000000000a'), ('a7000000-0000-0000-0000-00000000000b'),
  ('a7000000-0000-0000-0000-00000000000c'), ('a7000000-0000-0000-0000-00000000000d'),
  ('a7000000-0000-0000-0000-00000000000e'), ('b7000000-0000-0000-0000-00000000000a');
insert into public.clinica (id, nombre) values
  ('a7a7a7a7-0000-0000-0000-000000000000', 'Clínica G'),
  ('b7b7b7b7-0000-0000-0000-000000000000', 'Clínica H');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('a7000000-0000-0000-0000-00000000000a', 'a7a7a7a7-0000-0000-0000-000000000000', 'Admin G',       'admin',      '7001'),
  ('a7000000-0000-0000-0000-00000000000b', 'a7a7a7a7-0000-0000-0000-000000000000', 'Dra. Ortiz',    'odontologo', '7002'),
  ('a7000000-0000-0000-0000-00000000000c', 'a7a7a7a7-0000-0000-0000-000000000000', 'Recepción G',   'recepcion',  null),
  ('a7000000-0000-0000-0000-00000000000d', 'a7a7a7a7-0000-0000-0000-000000000000', 'Asistente G',   'asistente',  null),
  ('a7000000-0000-0000-0000-00000000000e', 'a7a7a7a7-0000-0000-0000-000000000000', 'Dr. Ruiz',      'odontologo', '7003'),
  ('b7000000-0000-0000-0000-00000000000a', 'b7b7b7b7-0000-0000-0000-000000000000', 'Admin H',       'admin',      '8001');
insert into public.paciente (id, clinica_id, dni, nombres, apellidos)
values ('a7a7a7a7-0000-0000-0000-0000000000f1', 'a7a7a7a7-0000-0000-0000-000000000000', '47000001', 'Paola', 'Agenda');

-- Lunes y martes de la próxima semana, en hora de Lima
create view pruebas.dia as
  select date_trunc('week', (now() at time zone 'America/Lima')::date + 7)::date as lunes;
grant select on pruebas.dia to authenticated;
create function pruebas.a(dia_offset int, hora text) returns timestamptz
language sql stable as $$
  select ((select lunes from pruebas.dia) + dia_offset + hora::time) at time zone 'America/Lima'
$$;
grant execute on function pruebas.a(int, text) to authenticated;

set role authenticated;

-- ---------------------------------------------------------------------------
-- Sillones y horarios: solo el admin
-- ---------------------------------------------------------------------------
select pruebas.como('a7000000-0000-0000-0000-00000000000a');
insert into public.sillon (id, clinica_id, nombre) values
  ('a7a7a7a7-0000-0000-0000-0000000000c1', 'a7a7a7a7-0000-0000-0000-000000000000', 'Sillón 1'),
  ('a7a7a7a7-0000-0000-0000-0000000000c2', 'a7a7a7a7-0000-0000-0000-000000000000', 'Sillón 2');
select pruebas.debe_fallar($$insert into public.sillon (clinica_id, nombre)
  values ('a7a7a7a7-0000-0000-0000-000000000000', ' sillón 1 ')$$, 'duplicate key');

insert into public.horario_profesional (id, clinica_id, profesional_id, sillon_id, dia_semana, hora_inicio, hora_fin) values
  ('a7a7a7a7-0000-0000-0000-0000000000d1', 'a7a7a7a7-0000-0000-0000-000000000000', 'a7000000-0000-0000-0000-00000000000b',
   'a7a7a7a7-0000-0000-0000-0000000000c1', 1, '09:00', '13:00'),
  ('a7a7a7a7-0000-0000-0000-0000000000d2', 'a7a7a7a7-0000-0000-0000-000000000000', 'a7000000-0000-0000-0000-00000000000e',
   'a7a7a7a7-0000-0000-0000-0000000000c2', 1, '09:00', '13:00');
-- El sillón 1 ya es de la Dra. Ortiz el lunes por la mañana
select pruebas.debe_fallar($$insert into public.horario_profesional (clinica_id, profesional_id, sillon_id, dia_semana, hora_inicio, hora_fin)
  values ('a7a7a7a7-0000-0000-0000-000000000000', 'a7000000-0000-0000-0000-00000000000e',
          'a7a7a7a7-0000-0000-0000-0000000000c1', 1, '12:00', '15:00')$$, 'ya está asignado a Dra. Ortiz');
-- Solo odontólogos con COP tienen horario
select pruebas.debe_fallar($$insert into public.horario_profesional (clinica_id, profesional_id, sillon_id, dia_semana, hora_inicio, hora_fin)
  values ('a7a7a7a7-0000-0000-0000-000000000000', 'a7000000-0000-0000-0000-00000000000c',
          'a7a7a7a7-0000-0000-0000-0000000000c1', 2, '09:00', '13:00')$$, 'Solo se asignan horarios');
select pruebas.debe_fallar($$insert into public.horario_profesional (clinica_id, profesional_id, sillon_id, dia_semana, hora_inicio, hora_fin)
  values ('a7a7a7a7-0000-0000-0000-000000000000', 'a7000000-0000-0000-0000-00000000000b',
          'a7a7a7a7-0000-0000-0000-0000000000c1', 3, '13:00', '09:00')$$, 'check constraint');

-- Recepción, asistente y odontólogo no configuran
do $$
declare u uuid;
begin
  foreach u in array array['a7000000-0000-0000-0000-00000000000b', 'a7000000-0000-0000-0000-00000000000c',
                           'a7000000-0000-0000-0000-00000000000d']::uuid[] loop
    perform pruebas.como(u);
    perform pruebas.igual((select count(*) from public.horario_profesional), 2, 'el equipo ve los horarios');
    perform pruebas.debe_fallar($q$insert into public.sillon (clinica_id, nombre)
      values ('a7a7a7a7-0000-0000-0000-000000000000', 'Sillón X')$q$, 'row-level security');
    perform pruebas.debe_fallar($q$insert into public.bloqueo_agenda (clinica_id, tipo, motivo, inicio, fin)
      values ('a7a7a7a7-0000-0000-0000-000000000000', 'otro', 'Intento', now() + interval '1 day', now() + interval '2 days')$q$,
      'row-level security');
    update public.horario_profesional set hora_fin = '20:00';
    perform pruebas.igual((select count(*) from public.horario_profesional where hora_fin = '20:00'), 0,
                          'quien no es admin no cambia horarios');
    perform pruebas.debe_fallar('delete from public.horario_profesional', 'permission denied');
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Citas dentro del horario
-- ---------------------------------------------------------------------------
select pruebas.como('a7000000-0000-0000-0000-00000000000c');   -- recepción agenda
insert into public.cita (id, clinica_id, paciente_id, odontologo_id, inicio, fin)
values ('a7a7a7a7-0000-0000-0000-0000000000e1', 'a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-0000-0000-0000-0000000000f1',
        'a7000000-0000-0000-0000-00000000000b', pruebas.a(0, '10:00'), pruebas.a(0, '10:30'));
select pruebas.igual((select count(*) from public.cita where id = 'a7a7a7a7-0000-0000-0000-0000000000e1'
                        and sillon_id = 'a7a7a7a7-0000-0000-0000-0000000000c1' and forzada_por is null),
                     1, 'toma el sillón de su horario');

-- Choques (no se fuerzan)
select pruebas.debe_fallar(format($$insert into public.cita (clinica_id, paciente_id, odontologo_id, inicio, fin)
  values ('a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-0000-0000-0000-0000000000f1',
          'a7000000-0000-0000-0000-00000000000b', %L, %L)$$, pruebas.a(0, '10:15'), pruebas.a(0, '10:45')),
  'Dra. Ortiz ya tiene otra cita');
select pruebas.debe_fallar(format($$insert into public.cita (clinica_id, paciente_id, odontologo_id, sillon_id, inicio, fin)
  values ('a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-0000-0000-0000-0000000000f1',
          'a7000000-0000-0000-0000-00000000000e', 'a7a7a7a7-0000-0000-0000-0000000000c1', %L, %L)$$,
  pruebas.a(0, '10:00'), pruebas.a(0, '10:30')), 'El sillón ya está ocupado');

-- Fuera del horario, otro día, en el pasado o cruzando la medianoche
select pruebas.debe_fallar(format($$insert into public.cita (clinica_id, paciente_id, odontologo_id, inicio, fin)
  values ('a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-0000-0000-0000-0000000000f1',
          'a7000000-0000-0000-0000-00000000000b', %L, %L)$$, pruebas.a(0, '12:45'), pruebas.a(0, '13:15')),
  'Fuera del horario de Dra. Ortiz: los lunes atiende de 09:00 a 13:00');
select pruebas.debe_fallar(format($$insert into public.cita (clinica_id, paciente_id, odontologo_id, inicio, fin)
  values ('a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-0000-0000-0000-0000000000f1',
          'a7000000-0000-0000-0000-00000000000b', %L, %L)$$, pruebas.a(1, '10:00'), pruebas.a(1, '10:30')),
  'Dra. Ortiz no atiende los martes');
select pruebas.debe_fallar(format($$insert into public.cita (clinica_id, paciente_id, odontologo_id, inicio, fin)
  values ('a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-0000-0000-0000-0000000000f1',
          'a7000000-0000-0000-0000-00000000000b', %L, %L)$$, now() - interval '2 days', now() - interval '2 days' + interval '30 minutes'),
  'ya pasó');
select pruebas.debe_fallar(format($$insert into public.cita (clinica_id, paciente_id, odontologo_id, inicio, fin)
  values ('a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-0000-0000-0000-0000000000f1',
          'a7000000-0000-0000-0000-00000000000b', %L, %L)$$, pruebas.a(0, '23:30'), pruebas.a(1, '00:30')),
  'mismo día');

-- Forzar: solo el admin y con motivo
select pruebas.debe_fallar(format($$insert into public.cita (clinica_id, paciente_id, odontologo_id, inicio, fin, forzada_motivo)
  values ('a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-0000-0000-0000-0000000000f1',
          'a7000000-0000-0000-0000-00000000000b', %L, %L, 'Urgencia')$$, pruebas.a(1, '10:00'), pruebas.a(1, '10:30')),
  'Solo el administrador puede agendar fuera del horario');
select pruebas.como('a7000000-0000-0000-0000-00000000000a');
insert into public.cita (id, clinica_id, paciente_id, odontologo_id, inicio, fin, forzada_motivo)
values ('a7a7a7a7-0000-0000-0000-0000000000e2', 'a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-0000-0000-0000-0000000000f1',
        'a7000000-0000-0000-0000-00000000000b', pruebas.a(1, '10:00'), pruebas.a(1, '10:30'), '  Urgencia por dolor  ');
select pruebas.igual((select count(*) from public.cita where id = 'a7a7a7a7-0000-0000-0000-0000000000e2'
                        and forzada_motivo = 'Urgencia por dolor' and forzada_por = 'a7000000-0000-0000-0000-00000000000a'),
                     1, 'cita forzada con motivo y autor');
-- Un motivo sobre una cita que no lo necesita se descarta
insert into public.cita (id, clinica_id, paciente_id, odontologo_id, inicio, fin, forzada_motivo)
values ('a7a7a7a7-0000-0000-0000-0000000000e3', 'a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-0000-0000-0000-0000000000f1',
        'a7000000-0000-0000-0000-00000000000e', pruebas.a(0, '11:00'), pruebas.a(0, '11:30'), 'Sin necesidad');
select pruebas.igual((select count(*) from public.cita where id = 'a7a7a7a7-0000-0000-0000-0000000000e3'
                        and forzada_motivo is null and forzada_por is null), 1, 'sin forzado innecesario');

-- ---------------------------------------------------------------------------
-- Bloqueos: el admin los crea y anula; bloquean la agenda
-- ---------------------------------------------------------------------------
insert into public.bloqueo_agenda (id, clinica_id, profesional_id, tipo, motivo, inicio, fin)
values ('a7a7a7a7-0000-0000-0000-0000000000b1', 'a7a7a7a7-0000-0000-0000-000000000000',
        'a7000000-0000-0000-0000-00000000000b', 'capacitacion', 'Curso de endodoncia', pruebas.a(0, '11:30'), pruebas.a(0, '13:00'));
select pruebas.como('a7000000-0000-0000-0000-00000000000c');
select pruebas.debe_fallar(format($$insert into public.cita (clinica_id, paciente_id, odontologo_id, inicio, fin)
  values ('a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-0000-0000-0000-0000000000f1',
          'a7000000-0000-0000-0000-00000000000b', %L, %L)$$, pruebas.a(0, '12:00'), pruebas.a(0, '12:30')),
  'Agenda bloqueada por capacitación: Curso de endodoncia');
-- El bloqueo de una profesional no afecta a otro
insert into public.cita (clinica_id, paciente_id, odontologo_id, inicio, fin)
values ('a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-0000-0000-0000-0000000000f1',
        'a7000000-0000-0000-0000-00000000000e', pruebas.a(0, '12:00'), pruebas.a(0, '12:30'));

select pruebas.como('a7000000-0000-0000-0000-00000000000a');
select pruebas.debe_fallar($$update public.bloqueo_agenda set motivo = 'Otro' where id = 'a7a7a7a7-0000-0000-0000-0000000000b1'$$,
                           'permission denied');
update public.bloqueo_agenda set anulado_at = now(), anulado_por = 'a7000000-0000-0000-0000-00000000000a',
       motivo_anulacion = 'Se postergó el curso' where id = 'a7a7a7a7-0000-0000-0000-0000000000b1';
select pruebas.como('a7000000-0000-0000-0000-00000000000c');
insert into public.cita (clinica_id, paciente_id, odontologo_id, inicio, fin)
values ('a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-0000-0000-0000-0000000000f1',
        'a7000000-0000-0000-0000-00000000000b', pruebas.a(0, '12:00'), pruebas.a(0, '12:30'));

-- Confirmar no revalida; reactivar una cita cancelada sí
update public.cita set estado = 'confirmada' where id = 'a7a7a7a7-0000-0000-0000-0000000000e2';
select pruebas.igual((select count(*) from public.cita where id = 'a7a7a7a7-0000-0000-0000-0000000000e2' and estado = 'confirmada'),
                     1, 'confirmar una cita forzada no la revalida');
update public.cita set estado = 'cancelada' where id = 'a7a7a7a7-0000-0000-0000-0000000000e1';
insert into public.cita (clinica_id, paciente_id, odontologo_id, inicio, fin)
values ('a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-0000-0000-0000-0000000000f1',
        'a7000000-0000-0000-0000-00000000000b', pruebas.a(0, '10:00'), pruebas.a(0, '10:30'));   -- el hueco quedó libre
select pruebas.debe_fallar($$update public.cita set estado = 'programada' where id = 'a7a7a7a7-0000-0000-0000-0000000000e1'$$,
                           'ya tiene otra cita');

-- ---------------------------------------------------------------------------
-- Guardar la semana de una vez: todo o nada
-- ---------------------------------------------------------------------------
select pruebas.como('a7000000-0000-0000-0000-00000000000a');
select public.guardar_horario_semanal('a7000000-0000-0000-0000-00000000000b', jsonb_build_array(
  jsonb_build_object('dia', 1, 'activo', true, 'sillon_id', 'a7a7a7a7-0000-0000-0000-0000000000c1', 'hora_inicio', '09:00', 'hora_fin', '13:00'),
  jsonb_build_object('dia', 3, 'activo', true, 'sillon_id', 'a7a7a7a7-0000-0000-0000-0000000000c2', 'hora_inicio', '15:00', 'hora_fin', '20:00')));
select pruebas.igual((select count(*) from public.horario_profesional
                      where profesional_id = 'a7000000-0000-0000-0000-00000000000b' and activo), 2, 'semana guardada');
-- Un choque en un día deja todo como estaba
select pruebas.debe_fallar($$select public.guardar_horario_semanal('a7000000-0000-0000-0000-00000000000b', jsonb_build_array(
  jsonb_build_object('dia', 3, 'activo', false),
  jsonb_build_object('dia', 1, 'activo', true, 'sillon_id', 'a7a7a7a7-0000-0000-0000-0000000000c2', 'hora_inicio', '09:00', 'hora_fin', '13:00')))$$,
  'ya está asignado a Dr. Ruiz');
select pruebas.igual((select count(*) from public.horario_profesional
                      where profesional_id = 'a7000000-0000-0000-0000-00000000000b' and dia_semana = 3 and activo), 1,
                     'si algo falla no se guarda nada');
select pruebas.como('a7000000-0000-0000-0000-00000000000c');
select pruebas.debe_fallar($$select public.guardar_horario_semanal('a7000000-0000-0000-0000-00000000000b', '[]')$$,
                           'Solo el administrador');

-- ---------------------------------------------------------------------------
-- Día sin atención (inactivo), auditoría, otra clínica y visitante sin sesión
-- ---------------------------------------------------------------------------
select pruebas.como('a7000000-0000-0000-0000-00000000000a');
update public.horario_profesional set activo = false where id = 'a7a7a7a7-0000-0000-0000-0000000000d2';
select pruebas.como('a7000000-0000-0000-0000-00000000000c');
select pruebas.debe_fallar(format($$insert into public.cita (clinica_id, paciente_id, odontologo_id, inicio, fin)
  values ('a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-0000-0000-0000-0000000000f1',
          'a7000000-0000-0000-0000-00000000000e', %L, %L)$$, pruebas.a(0, '09:00'), pruebas.a(0, '09:30')),
  'Dr. Ruiz no atiende los lunes');
reset role;
select pruebas.igual((select count(*) from public.auditoria
                      where tabla = 'cita' and registro_id = 'a7a7a7a7-0000-0000-0000-0000000000e2' and accion = 'insert'
                        and despues ->> 'forzada_motivo' = 'Urgencia por dolor'), 1, 'la cita forzada queda en la auditoría');
select pruebas.igual((select count(*) from public.auditoria
                      where tabla = 'horario_profesional' and accion = 'update'
                        and registro_id = 'a7a7a7a7-0000-0000-0000-0000000000d2'), 1, 'el día desactivado queda en la auditoría');
select pruebas.igual((select count(*) from public.auditoria
                      where tabla = 'bloqueo_agenda' and accion = 'anular'), 1, 'la anulación del bloqueo queda en la auditoría');

set role authenticated;
select pruebas.como('b7000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.sillon) + (select count(*) from public.horario_profesional)
                     + (select count(*) from public.bloqueo_agenda), 0, 'otra clínica no ve sillones, horarios ni bloqueos');
reset role;
set role anon;
select pruebas.debe_fallar('select 1 from public.horario_profesional', 'permission denied');
select pruebas.debe_fallar('select 1 from public.bloqueo_agenda', 'permission denied');
reset role;
select pruebas.como(null);
select 'agenda: todas las aserciones pasaron' as resultado;
