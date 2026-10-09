-- Etapa 6 (v2): evolución por sesión, firmada y con adendas, conectada a la cita.
-- Reglas 2 (firmada no se edita: adendas), 3 (realizado = evolución firmada) y 9.
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values
  ('ad000000-0000-0000-0000-00000000000a'), ('ad000000-0000-0000-0000-00000000000b'),
  ('ad000000-0000-0000-0000-00000000000c'), ('ad000000-0000-0000-0000-00000000000d'),
  ('bd000000-0000-0000-0000-00000000000a');
insert into public.clinica (id, nombre) values
  ('adadadad-0000-0000-0000-000000000000', 'Clínica P'),
  ('bdbdbdbd-0000-0000-0000-000000000000', 'Clínica Q');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('ad000000-0000-0000-0000-00000000000a', 'adadadad-0000-0000-0000-000000000000', 'Admin P',      'admin',      '9601'),
  ('ad000000-0000-0000-0000-00000000000b', 'adadadad-0000-0000-0000-000000000000', 'Odontóloga P', 'odontologo', '9602'),
  ('ad000000-0000-0000-0000-00000000000c', 'adadadad-0000-0000-0000-000000000000', 'Asistente P',  'asistente',  null),
  ('ad000000-0000-0000-0000-00000000000d', 'adadadad-0000-0000-0000-000000000000', 'Recepción P',  'recepcion',  null),
  ('bd000000-0000-0000-0000-00000000000a', 'bdbdbdbd-0000-0000-0000-000000000000', 'Admin Q',      'admin',      '9701');
insert into public.paciente (id, clinica_id, dni, nombres, apellidos, fecha_nacimiento) values
  ('adadadad-0000-0000-0000-0000000000f1', 'adadadad-0000-0000-0000-000000000000', '60000001', 'Eva', 'Sesión', '1990-01-01'),
  ('adadadad-0000-0000-0000-0000000000f2', 'adadadad-0000-0000-0000-000000000000', '60000002', 'Otro', 'Paciente', '1990-01-01');
insert into public.plan_tratamiento (id, clinica_id, paciente_id, odontologo_id, titulo, estado, aceptado_at) values
  ('adadadad-0000-0000-0000-0000000000a1', 'adadadad-0000-0000-0000-000000000000', 'adadadad-0000-0000-0000-0000000000f1',
   'ad000000-0000-0000-0000-00000000000b', 'Endodoncia y corona', 'aceptado', now()),
  ('adadadad-0000-0000-0000-0000000000a2', 'adadadad-0000-0000-0000-000000000000', 'adadadad-0000-0000-0000-0000000000f2',
   'ad000000-0000-0000-0000-00000000000b', 'Otro plan', 'aceptado', now());
insert into public.item_plan (id, clinica_id, plan_id, pieza, procedimiento, precio_centimos, odontologo_id, estado, orden) values
  ('adadadad-0000-0000-0000-0000000000e1', 'adadadad-0000-0000-0000-000000000000', 'adadadad-0000-0000-0000-0000000000a1',
   36, 'Endodoncia', 75000, 'ad000000-0000-0000-0000-00000000000b', 'aceptado', 1),
  ('adadadad-0000-0000-0000-0000000000e2', 'adadadad-0000-0000-0000-000000000000', 'adadadad-0000-0000-0000-0000000000a1',
   36, 'Corona', 90000, 'ad000000-0000-0000-0000-00000000000b', 'aceptado', 2),
  ('adadadad-0000-0000-0000-0000000000e9', 'adadadad-0000-0000-0000-000000000000', 'adadadad-0000-0000-0000-0000000000a2',
   11, 'Resina', 18000, 'ad000000-0000-0000-0000-00000000000b', 'aceptado', 1);
insert into public.item_dependencia (clinica_id, item_id, requiere_id) values
  ('adadadad-0000-0000-0000-000000000000', 'adadadad-0000-0000-0000-0000000000e2', 'adadadad-0000-0000-0000-0000000000e1');
-- Cita de hoy (empezó hace 10 minutos) y una de mañana (el sistema no pasa por la agenda)
insert into public.cita (id, clinica_id, paciente_id, odontologo_id, inicio, fin, estado) values
  ('adadadad-0000-0000-0000-0000000000c1', 'adadadad-0000-0000-0000-000000000000', 'adadadad-0000-0000-0000-0000000000f1',
   'ad000000-0000-0000-0000-00000000000b', now() - interval '10 minutes', now() + interval '30 minutes', 'confirmada'),
  ('adadadad-0000-0000-0000-0000000000c2', 'adadadad-0000-0000-0000-000000000000', 'adadadad-0000-0000-0000-0000000000f1',
   'ad000000-0000-0000-0000-00000000000b', now() + interval '1 day', now() + interval '1 day 30 minutes', 'programada');

set role authenticated;

-- ---------------------------------------------------------------------------
-- Recepción marca «en sala»; solo el día de la cita
-- ---------------------------------------------------------------------------
select pruebas.como('ad000000-0000-0000-0000-00000000000d');
select pruebas.debe_fallar($$update public.cita set estado = 'en_sala' where id = 'adadadad-0000-0000-0000-0000000000c2'$$,
                           'el día de la cita');
update public.cita set estado = 'en_sala' where id = 'adadadad-0000-0000-0000-0000000000c1';
select pruebas.igual((select count(*) from public.cita where id = 'adadadad-0000-0000-0000-0000000000c1' and estado = 'en_sala'),
                     1, 'cita en sala');
select pruebas.debe_fallar($$select public.abrir_evolucion('adadadad-0000-0000-0000-0000000000c1')$$, 'cirujano dentista');

-- ---------------------------------------------------------------------------
-- La odontóloga atiende: se abre la evolución en borrador, a su nombre
-- ---------------------------------------------------------------------------
select pruebas.como('ad000000-0000-0000-0000-00000000000b');
create temp table ids (clave text primary key, id uuid);
grant all on ids to authenticated;
insert into ids select 'n', public.abrir_evolucion('adadadad-0000-0000-0000-0000000000c1');
select pruebas.igual((select count(*) from public.nota_evolucion n join ids on ids.id = n.id and ids.clave = 'n'
                      where n.firmada_at is null and n.odontologo_id = 'ad000000-0000-0000-0000-00000000000b'
                        and n.cita_id = 'adadadad-0000-0000-0000-0000000000c1'), 1, 'evolución abierta en borrador');
select pruebas.igual((select count(*) from ids where id = public.abrir_evolucion('adadadad-0000-0000-0000-0000000000c1')), 1,
                     'abrir otra vez devuelve la misma evolución');
select pruebas.debe_fallar($$select public.abrir_evolucion('adadadad-0000-0000-0000-0000000000c2')$$, 'otro día');

-- El autor edita el borrador
update public.nota_evolucion set texto = 'Apertura cameral y conductometría de la 36', anestesia_tipo = 'Lidocaína 2% con epinefrina',
       anestesia_cantidad = '1 cartucho (1.8 ml)', indicaciones = 'Analgésico según indicación médica previa'
 where id = (select id from ids where clave = 'n');
-- Ítems trabajados: la endodoncia terminada; la corona trabajada pero no terminada
insert into public.evolucion_item (clinica_id, nota_id, item_id, terminado) values
  ('adadadad-0000-0000-0000-000000000000', (select id from ids where clave = 'n'), 'adadadad-0000-0000-0000-0000000000e1', true),
  ('adadadad-0000-0000-0000-000000000000', (select id from ids where clave = 'n'), 'adadadad-0000-0000-0000-0000000000e2', false);
select pruebas.debe_fallar($$insert into public.evolucion_item (clinica_id, nota_id, item_id)
  values ('adadadad-0000-0000-0000-000000000000', (select id from ids where clave = 'n'), 'adadadad-0000-0000-0000-0000000000e9')$$,
  'mismo paciente');
select pruebas.debe_fallar($$delete from public.evolucion_item$$, 'permission denied');
select pruebas.debe_fallar($$update public.nota_evolucion set firmada_at = now() where id = (select id from ids where clave = 'n')$$,
                           'permission denied');

-- Otro dentista no edita ni firma el borrador ajeno; asistente y recepción tampoco
select pruebas.como('ad000000-0000-0000-0000-00000000000a');
select pruebas.debe_fallar($$update public.nota_evolucion set texto = 'Otro texto' where id = (select id from ids where clave = 'n')$$,
                           'autor');
select pruebas.debe_fallar($$select public.firmar_evolucion((select id from ids where clave = 'n'))$$, 'autor');
select pruebas.como('ad000000-0000-0000-0000-00000000000c');
select pruebas.igual((select count(*) from public.nota_evolucion n join ids on ids.id = n.id), 1, 'la asistente ve la evolución');
select pruebas.debe_fallar($$insert into public.nota_evolucion (clinica_id, paciente_id, odontologo_id, texto)
  values ('adadadad-0000-0000-0000-000000000000', 'adadadad-0000-0000-0000-0000000000f1', 'ad000000-0000-0000-0000-00000000000c', 'x')$$,
  'row-level security');
select pruebas.como('ad000000-0000-0000-0000-00000000000d');
select pruebas.igual((select count(*) from public.nota_evolucion) + (select count(*) from public.evolucion_item), 0,
                     'recepción no ve evoluciones');

-- ---------------------------------------------------------------------------
-- Firmar y cerrar: los ítems terminados pasan a realizado; la cita queda atendida
-- ---------------------------------------------------------------------------
select pruebas.como('ad000000-0000-0000-0000-00000000000b');
select public.firmar_evolucion((select id from ids where clave = 'n'));
select pruebas.igual((select count(*) from public.item_plan where id = 'adadadad-0000-0000-0000-0000000000e1' and estado = 'realizado'
                        and nota_evolucion_id = (select id from ids where clave = 'n')), 1, 'el ítem terminado queda realizado');
select pruebas.igual((select count(*) from public.item_plan where id = 'adadadad-0000-0000-0000-0000000000e2' and estado = 'aceptado'),
                     1, 'el ítem trabajado pero no terminado sigue pendiente');
select pruebas.igual((select count(*) from public.cita where id = 'adadadad-0000-0000-0000-0000000000c1' and estado = 'atendida'),
                     1, 'la cita queda atendida');
select pruebas.debe_fallar($$select public.firmar_evolucion((select id from ids where clave = 'n'))$$, 'ya está firmada');

-- Regla 2: firmada no se edita; solo adendas
select pruebas.debe_fallar($$update public.nota_evolucion set texto = 'Corregido' where id = (select id from ids where clave = 'n')$$,
                           'adenda');
select pruebas.debe_fallar($$update public.evolucion_item set terminado = true where item_id = 'adadadad-0000-0000-0000-0000000000e2'$$,
                           'borrador');
-- Regla 3: no se anula una evolución que respalda ítems realizados
select pruebas.debe_fallar($$update public.nota_evolucion set anulado_at = now(), anulado_por = 'ad000000-0000-0000-0000-00000000000b',
                               motivo_anulacion = 'Error' where id = (select id from ids where clave = 'n')$$, 'respalda ítems realizados');
select pruebas.como('ad000000-0000-0000-0000-00000000000a');   -- otro dentista agrega la adenda
insert into public.evolucion_adenda (clinica_id, nota_id, texto, registrado_por)
values ('adadadad-0000-0000-0000-000000000000', (select id from ids where clave = 'n'),
        'Radiografía de control: obturación a 1 mm del ápice', 'ad000000-0000-0000-0000-00000000000a');
select pruebas.debe_fallar($$update public.evolucion_adenda set texto = 'Otro'$$, 'permission denied');
select pruebas.debe_fallar($$delete from public.evolucion_adenda$$, 'permission denied');

-- ---------------------------------------------------------------------------
-- Evolución sin cita y orden del plan: la corona no se termina antes que la endodoncia
-- ---------------------------------------------------------------------------
reset role;
update public.item_plan set estado = 'aceptado' where id = 'adadadad-0000-0000-0000-0000000000e1' and false;  -- (sin cambios)
insert into public.item_plan (id, clinica_id, plan_id, pieza, procedimiento, precio_centimos, odontologo_id, estado, orden) values
  ('adadadad-0000-0000-0000-0000000000e3', 'adadadad-0000-0000-0000-000000000000', 'adadadad-0000-0000-0000-0000000000a1',
   46, 'Profilaxis previa', 15000, 'ad000000-0000-0000-0000-00000000000b', 'aceptado', 3),
  ('adadadad-0000-0000-0000-0000000000e4', 'adadadad-0000-0000-0000-000000000000', 'adadadad-0000-0000-0000-0000000000a1',
   46, 'Resina', 18000, 'ad000000-0000-0000-0000-00000000000b', 'aceptado', 4);
insert into public.item_dependencia (clinica_id, item_id, requiere_id) values
  ('adadadad-0000-0000-0000-000000000000', 'adadadad-0000-0000-0000-0000000000e4', 'adadadad-0000-0000-0000-0000000000e3');
set role authenticated;
select pruebas.como('ad000000-0000-0000-0000-00000000000b');
insert into public.nota_evolucion (id, clinica_id, paciente_id, odontologo_id, texto) values
  ('adadadad-0000-0000-0000-0000000000b2', 'adadadad-0000-0000-0000-000000000000', 'adadadad-0000-0000-0000-0000000000f1',
   'ad000000-0000-0000-0000-00000000000b', 'Resina de la 46');
select pruebas.igual((select count(*) from public.nota_evolucion where id = 'adadadad-0000-0000-0000-0000000000b2'
                        and firmada_at is null), 1, 'lo que escribe la app nace en borrador');
insert into public.evolucion_item (clinica_id, nota_id, item_id, terminado) values
  ('adadadad-0000-0000-0000-000000000000', 'adadadad-0000-0000-0000-0000000000b2', 'adadadad-0000-0000-0000-0000000000e4', true);
select pruebas.debe_fallar($$select public.firmar_evolucion('adadadad-0000-0000-0000-0000000000b2')$$, 'Primero debe realizarse');
select pruebas.igual((select count(*) from public.nota_evolucion where id = 'adadadad-0000-0000-0000-0000000000b2'
                        and firmada_at is null), 1, 'si falla, nada se firma');
-- El borrador se puede descartar (anular con motivo)
update public.nota_evolucion set anulado_at = now(), anulado_por = 'ad000000-0000-0000-0000-00000000000b',
       motivo_anulacion = 'Se registra en otra sesión' where id = 'adadadad-0000-0000-0000-0000000000b2';

-- Otra clínica y visitante
select pruebas.como('bd000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.nota_evolucion) + (select count(*) from public.evolucion_adenda)
                     + (select count(*) from public.evolucion_item), 0, 'otra clínica no ve nada');
select pruebas.debe_fallar($$select public.abrir_evolucion('adadadad-0000-0000-0000-0000000000c1')$$, 'no encontrada');
reset role;
set role anon;
select pruebas.debe_fallar('select 1 from public.evolucion_adenda', 'permission denied');
select pruebas.debe_fallar($$select public.firmar_evolucion('adadadad-0000-0000-0000-0000000000b2')$$, 'permission denied');
reset role;
select pruebas.como(null);
\echo 'evolucion: todas las aserciones pasaron'
