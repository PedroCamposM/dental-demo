-- Etapa 7.5 (v2): interconsultas internas (tarea para otro dentista) y externas
-- (formato imprimible; se registra el resultado con el documento escaneado).
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values
  ('a2000000-0000-0000-0000-00000000000a'), ('a2000000-0000-0000-0000-00000000000b'),
  ('a2000000-0000-0000-0000-00000000000c'), ('a2000000-0000-0000-0000-00000000000d'),
  ('b2000000-0000-0000-0000-00000000000a');
insert into public.clinica (id, nombre) values
  ('a2a2a2a2-0000-0000-0000-000000000000', 'Clínica X'),
  ('b2b2b2b2-0000-0000-0000-000000000000', 'Clínica Y');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('a2000000-0000-0000-0000-00000000000a', 'a2a2a2a2-0000-0000-0000-000000000000', 'Ortodoncista X', 'admin',      '9831'),
  ('a2000000-0000-0000-0000-00000000000b', 'a2a2a2a2-0000-0000-0000-000000000000', 'Odontóloga X',   'odontologo', '9832'),
  ('a2000000-0000-0000-0000-00000000000c', 'a2a2a2a2-0000-0000-0000-000000000000', 'Asistente X',    'asistente',  null),
  ('a2000000-0000-0000-0000-00000000000d', 'a2a2a2a2-0000-0000-0000-000000000000', 'Recepción X',    'recepcion',  null),
  ('b2000000-0000-0000-0000-00000000000a', 'b2b2b2b2-0000-0000-0000-000000000000', 'Admin Y',        'admin',      '9931');
insert into public.paciente (id, clinica_id, dni, nombres, apellidos, fecha_nacimiento) values
  ('a2a2a2a2-0000-0000-0000-0000000000f1', 'a2a2a2a2-0000-0000-0000-000000000000', '64000001', 'Inés', 'Interconsulta', '1960-01-01');

set role authenticated;
select pruebas.como('a2000000-0000-0000-0000-00000000000b');
-- Interna: a otro dentista activo (no a sí misma ni a la asistente)
select pruebas.debe_fallar($$insert into public.interconsulta (clinica_id, paciente_id, tipo, solicitante_id, destinatario_id, motivo)
  values ('a2a2a2a2-0000-0000-0000-000000000000', 'a2a2a2a2-0000-0000-0000-0000000000f1', 'interna',
          'a2000000-0000-0000-0000-00000000000b', 'a2000000-0000-0000-0000-00000000000b', 'Evaluar maloclusión antes de rehabilitar')$$,
  'otro cirujano dentista');
select pruebas.debe_fallar($$insert into public.interconsulta (clinica_id, paciente_id, tipo, solicitante_id, destinatario_id, motivo)
  values ('a2a2a2a2-0000-0000-0000-000000000000', 'a2a2a2a2-0000-0000-0000-0000000000f1', 'interna',
          'a2000000-0000-0000-0000-00000000000b', 'a2000000-0000-0000-0000-00000000000c', 'Evaluar maloclusión antes de rehabilitar')$$,
  'otro cirujano dentista');
insert into public.interconsulta (id, clinica_id, paciente_id, tipo, solicitante_id, destinatario_id, motivo, datos_clinicos) values
  ('a2a2a2a2-0000-0000-0000-0000000000c1', 'a2a2a2a2-0000-0000-0000-000000000000', 'a2a2a2a2-0000-0000-0000-0000000000f1',
   'interna', 'a2000000-0000-0000-0000-00000000000a', 'a2000000-0000-0000-0000-00000000000a',
   'Evaluar maloclusión antes de rehabilitar', 'Mordida cruzada posterior derecha');
select pruebas.igual((select count(*) from public.interconsulta where id = 'a2a2a2a2-0000-0000-0000-0000000000c1'
                        and solicitante_id = 'a2000000-0000-0000-0000-00000000000b' and estado = 'pendiente'), 1,
                     'la pide quien la registra');
-- Solo la responde el destinatario
select pruebas.debe_fallar($$select public.responder_interconsulta('a2a2a2a2-0000-0000-0000-0000000000c1', 'Respuesta', null, null, null, null)$$,
                           'a quien se dirigió');
select pruebas.debe_fallar($$update public.interconsulta set estado = 'respondida'$$, 'permission denied');
select pruebas.como('a2000000-0000-0000-0000-00000000000a');
select pruebas.debe_fallar($$select public.responder_interconsulta('a2a2a2a2-0000-0000-0000-0000000000c1', 'x', null, null, null, null)$$,
                           'Escribe la respuesta');
select public.responder_interconsulta('a2a2a2a2-0000-0000-0000-0000000000c1', 'Requiere ortodoncia previa: 12 meses.', null, null, null, null);
select pruebas.igual((select count(*) from public.interconsulta where id = 'a2a2a2a2-0000-0000-0000-0000000000c1'
                        and estado = 'respondida' and respondida_por = 'a2000000-0000-0000-0000-00000000000a'), 1, 'respondida');
select pruebas.debe_fallar($$select public.cancelar_interconsulta('a2a2a2a2-0000-0000-0000-0000000000c1', 'Error')$$, 'pendiente');

-- Externa: riesgo quirúrgico; la asistente registra el resultado con el documento
select pruebas.como('a2000000-0000-0000-0000-00000000000b');
select pruebas.debe_fallar($$insert into public.interconsulta (clinica_id, paciente_id, tipo, solicitante_id, motivo)
  values ('a2a2a2a2-0000-0000-0000-000000000000', 'a2a2a2a2-0000-0000-0000-0000000000f1', 'externa',
          'a2000000-0000-0000-0000-00000000000b', 'Riesgo quirúrgico antes de exodoncias múltiples')$$, 'interconsulta_destino');
insert into public.interconsulta (id, clinica_id, paciente_id, tipo, solicitante_id, destino, motivo, datos_clinicos) values
  ('a2a2a2a2-0000-0000-0000-0000000000c2', 'a2a2a2a2-0000-0000-0000-000000000000', 'a2a2a2a2-0000-0000-0000-0000000000f1',
   'externa', 'a2000000-0000-0000-0000-00000000000b', 'Cardiología', 'Riesgo quirúrgico antes de exodoncias múltiples',
   'Paciente anticoagulada con warfarina');
select pruebas.como('a2000000-0000-0000-0000-00000000000c');
insert into storage.objects (bucket_id, name) values
  ('clinico', 'a2a2a2a2-0000-0000-0000-000000000000/a2a2a2a2-0000-0000-0000-0000000000f1/cccccccc-1111-4111-8111-111111111111.pdf');
select public.responder_interconsulta('a2a2a2a2-0000-0000-0000-0000000000c2', 'Riesgo quirúrgico II/IV. Suspender warfarina según indicación del cardiólogo.',
  'a2a2a2a2-0000-0000-0000-000000000000/a2a2a2a2-0000-0000-0000-0000000000f1/cccccccc-1111-4111-8111-111111111111.pdf',
  'application/pdf', 30000, 'riesgo.pdf');
select pruebas.igual((select count(*) from public.interconsulta i join public.archivo_clinico a on a.id = i.archivo_id
                       where i.id = 'a2a2a2a2-0000-0000-0000-0000000000c2' and a.tipo = 'interconsulta'), 1,
                     'resultado con documento adjunto');
-- Cancelar: solo quien la pidió
select pruebas.como('a2000000-0000-0000-0000-00000000000b');
insert into public.interconsulta (id, clinica_id, paciente_id, tipo, solicitante_id, destino, motivo) values
  ('a2a2a2a2-0000-0000-0000-0000000000c3', 'a2a2a2a2-0000-0000-0000-000000000000', 'a2a2a2a2-0000-0000-0000-0000000000f1',
   'externa', 'a2000000-0000-0000-0000-00000000000b', 'Endocrinología', 'Control de glucosa antes de cirugía');
select pruebas.como('a2000000-0000-0000-0000-00000000000a');
select pruebas.debe_fallar($$select public.cancelar_interconsulta('a2a2a2a2-0000-0000-0000-0000000000c3', 'No corresponde')$$,
                           'quien la pidió');
select pruebas.como('a2000000-0000-0000-0000-00000000000b');
select public.cancelar_interconsulta('a2a2a2a2-0000-0000-0000-0000000000c3', 'Pedida por error');

-- Recepción, asistente (no pide), otra clínica, visitante
select pruebas.como('a2000000-0000-0000-0000-00000000000c');
select pruebas.debe_fallar($$insert into public.interconsulta (clinica_id, paciente_id, tipo, solicitante_id, destino, motivo)
  values ('a2a2a2a2-0000-0000-0000-000000000000', 'a2a2a2a2-0000-0000-0000-0000000000f1', 'externa',
          'a2000000-0000-0000-0000-00000000000c', 'Cardiología', 'Riesgo quirúrgico antes de cirugía')$$, 'row-level security');
select pruebas.como('a2000000-0000-0000-0000-00000000000d');
select pruebas.igual((select count(*) from public.interconsulta), 0, 'recepción no ve interconsultas');
select pruebas.como('b2000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.interconsulta), 0, 'otra clínica no ve nada');
select pruebas.debe_fallar($$insert into public.interconsulta (clinica_id, paciente_id, tipo, solicitante_id, destino, motivo)
  values ('a2a2a2a2-0000-0000-0000-000000000000', 'a2a2a2a2-0000-0000-0000-0000000000f1', 'externa',
          'b2000000-0000-0000-0000-00000000000a', 'Cardiología', 'Riesgo quirúrgico antes de cirugía')$$, 'otra clínica');
reset role;
set role anon;
select pruebas.debe_fallar('select 1 from public.interconsulta', 'permission denied');
reset role;
select pruebas.como(null);
\echo 'interconsultas: todas las aserciones pasaron'
