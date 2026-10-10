-- Etapa 9.1 (v2): periodontograma. Borrador → firmado por el responsable (regla 2: firmado
-- no se edita); anulación con motivo (regla 1); permisos por rol en RLS (regla 9).
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values
  ('a5000000-0000-0000-0000-00000000000b'), ('a5000000-0000-0000-0000-00000000000c'),
  ('a5000000-0000-0000-0000-00000000000e'), ('a5000000-0000-0000-0000-00000000000d'),
  ('b5000000-0000-0000-0000-00000000000b');
insert into public.clinica (id, nombre) values
  ('a5a5a5a5-0000-0000-0000-000000000000', 'Clínica Perio'), ('b5b5b5b5-0000-0000-0000-000000000000', 'Otra');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('a5000000-0000-0000-0000-00000000000b', 'a5a5a5a5-0000-0000-0000-000000000000', 'Periodoncista', 'odontologo', '9861'),
  ('a5000000-0000-0000-0000-00000000000c', 'a5a5a5a5-0000-0000-0000-000000000000', 'Otro dentista', 'odontologo', '9862'),
  ('a5000000-0000-0000-0000-00000000000e', 'a5a5a5a5-0000-0000-0000-000000000000', 'Asistente P',  'asistente',  null),
  ('a5000000-0000-0000-0000-00000000000d', 'a5a5a5a5-0000-0000-0000-000000000000', 'Recepción P',  'recepcion',  null),
  ('b5000000-0000-0000-0000-00000000000b', 'b5b5b5b5-0000-0000-0000-000000000000', 'Dentista O',   'odontologo', '9961');
insert into public.paciente (id, clinica_id, dni, nombres, apellidos, fecha_nacimiento) values
  ('a5a5a5a5-0000-0000-0000-0000000000f1', 'a5a5a5a5-0000-0000-0000-000000000000', '67000001', 'Pedro', 'Encía', '1970-01-01');

-- La asistente lo registra a nombre del responsable
set role authenticated;
select pruebas.como('a5000000-0000-0000-0000-00000000000e');
create temp table pg1 (id uuid);
grant all on pg1 to authenticated;
select pruebas.debe_fallar($$insert into public.periodontograma (clinica_id, paciente_id, odontologo_id)
  values ('a5a5a5a5-0000-0000-0000-000000000000', 'a5a5a5a5-0000-0000-0000-0000000000f1',
          'a5000000-0000-0000-0000-00000000000e')$$, 'cirujano dentista activo');
with x as (
  insert into public.periodontograma (clinica_id, paciente_id, odontologo_id)
  values ('a5a5a5a5-0000-0000-0000-000000000000', 'a5a5a5a5-0000-0000-0000-0000000000f1',
          'a5000000-0000-0000-0000-00000000000b') returning id)
insert into pg1 select id from x;
select public.guardar_periodontograma((select id from pg1),
  '[{"pieza": 16, "movilidad": 1, "furca": 1, "ps": [3,2,5,4,2,3], "mg": [1,0,2,0,0,-1],
     "sangrado": [false,false,true,true,false,false], "placa": [true,false,false,false,false,false]},
    {"pieza": 18, "ausente": true}]'::jsonb, 'Bolsas en 16', 3::smallint);
select pruebas.igual((select count(*) from public.periodonto_pieza p join pg1 on pg1.id = p.periodontograma_id), 2, 'piezas guardadas');
select pruebas.igual((select ps[3] + mg[3] from public.periodonto_pieza p join pg1 on pg1.id = p.periodontograma_id
                       where pieza = 16), 7, 'NIC = PS + MG');
-- Una pieza vaciada en la grilla se guarda vacía (no quedan los valores anteriores)
select public.guardar_periodontograma((select id from pg1),
  '[{"pieza": 17, "ps": [9,9,9,9,9,9]}]'::jsonb, 'Bolsas en 16', 3::smallint);
select public.guardar_periodontograma((select id from pg1), '[{"pieza": 17}]'::jsonb, 'Bolsas en 16', 3::smallint);
select pruebas.igual((select count(*) from public.periodonto_pieza p join pg1 on pg1.id = p.periodontograma_id
                       where pieza = 17 and 0 <= any (ps)), 0, 'pieza vaciada sin mediciones');
select pruebas.debe_fallar($$select public.guardar_periodontograma((select id from pg1),
  '[{"pieza": 16.4}]'::jsonb, null, null)$$, 'datos inválidos');
select pruebas.debe_fallar($$select public.guardar_periodontograma((select id from pg1),
  '[{"pieza": 16, "ausente": "x"}]'::jsonb, null, null)$$, 'datos inválidos');
-- Validaciones del servidor
select pruebas.debe_fallar($$select public.guardar_periodontograma((select id from pg1),
  '[{"pieza": 16, "ps": [3,2,5]}]'::jsonb, null, null)$$, 'seis sitios');
select pruebas.debe_fallar($$select public.guardar_periodontograma((select id from pg1),
  '[{"pieza": 16, "ps": [3,2,5,4,2.5,3]}]'::jsonb, null, null)$$, 'milímetros enteros');
select pruebas.debe_fallar($$select public.guardar_periodontograma((select id from pg1),
  '[{"pieza": 16, "ps": [3,2,5,4,25,3]}]'::jsonb, null, null)$$, 'check constraint');
select pruebas.debe_fallar($$select public.guardar_periodontograma((select id from pg1),
  '[{"pieza": 55, "ps": [3,2,5,4,2,3]}]'::jsonb, null, null)$$, 'check constraint');
select pruebas.debe_fallar($$select public.guardar_periodontograma((select id from pg1),
  '[{"pieza": 17, "ausente": true, "ps": [3,2,5,4,2,3]}]'::jsonb, null, null)$$, 'pieza_ausente_sin_datos');
-- Las piezas no se escriben directo
select pruebas.debe_fallar($$insert into public.periodonto_pieza (clinica_id, periodontograma_id, pieza)
  select 'a5a5a5a5-0000-0000-0000-000000000000', id, 21 from pg1$$, 'permission denied');
-- La asistente no firma; otro dentista tampoco
select pruebas.debe_fallar($$select public.firmar_periodontograma((select id from pg1))$$, 'responsable firma');
select pruebas.como('a5000000-0000-0000-0000-00000000000c');
select pruebas.debe_fallar($$select public.firmar_periodontograma((select id from pg1))$$, 'responsable firma');
select pruebas.debe_fallar($$select public.guardar_periodontograma((select id from pg1), '[]'::jsonb, 'x', null)$$,
                           'responsable o quien lo registró');
select pruebas.debe_fallar($$update public.periodontograma set observaciones = 'ajeno' where id = (select id from pg1)$$,
                           'responsable o quien lo registró');
-- El responsable firma; se programa el mantenimiento
select pruebas.como('a5000000-0000-0000-0000-00000000000b');
select pruebas.debe_fallar($$update public.periodontograma set firmado_at = now() where id = (select id from pg1)$$,
                           'permission denied');
select public.firmar_periodontograma((select id from pg1));
reset role;
select pruebas.igual((select count(*) from public.seguimiento where paciente_id = 'a5a5a5a5-0000-0000-0000-0000000000f1'
                        and tipo = 'mantenimiento_periodontal'
                        and fecha_programada = ((now() at time zone 'America/Lima')::date + interval '3 months')::date), 1,
                     'mantenimiento a los 3 meses');
set role authenticated;
-- Quien lo registró (la asistente) no anula el firmado: solo su responsable
select pruebas.como('a5000000-0000-0000-0000-00000000000e');
select pruebas.debe_fallar($$update public.periodontograma set anulado_at = now(), anulado_por = auth.uid(),
  motivo_anulacion = 'Lo anula la asistente' where id = (select id from pg1)$$, 'responsable');
select pruebas.como('a5000000-0000-0000-0000-00000000000c');
select pruebas.debe_fallar($$update public.periodontograma set anulado_at = now(), anulado_por = auth.uid(),
  motivo_anulacion = 'Lo anula otro dentista' where id = (select id from pg1)$$, 'responsable');
select pruebas.como('a5000000-0000-0000-0000-00000000000b');
-- Regla 2: firmado no se edita
select pruebas.debe_fallar($$select public.guardar_periodontograma((select id from pg1),
  '[{"pieza": 16, "ps": [1,1,1,1,1,1]}]'::jsonb, null, null)$$, 'en borrador');
select pruebas.debe_fallar($$update public.periodontograma set observaciones = 'cambio' where id = (select id from pg1)$$,
                           'firmado no se edita');
select pruebas.debe_fallar($$select public.firmar_periodontograma((select id from pg1))$$, 'ya está firmado');
-- Regla 1: no se borra; se anula con motivo, a nombre propio y sin cambiar el contenido
select pruebas.debe_fallar($$delete from public.periodontograma$$, 'permission denied');
select pruebas.debe_fallar($$update public.periodontograma set anulado_at = now(), anulado_por = 'a5000000-0000-0000-0000-00000000000c',
  motivo_anulacion = 'Paciente equivocado' where id = (select id from pg1)$$, 'nombre propio');
select pruebas.debe_fallar($$update public.periodontograma set anulado_at = now(), anulado_por = auth.uid(),
  motivo_anulacion = 'Paciente equivocado', observaciones = 'otra' where id = (select id from pg1)$$, 'contenido');
update public.periodontograma set anulado_at = now(), anulado_por = auth.uid(), motivo_anulacion = 'Paciente equivocado'
 where id = (select id from pg1);
select pruebas.igual((select count(*) from public.periodontograma where anulado_at is not null), 1, 'anulado, no borrado');

-- Firmar exige mediciones
create temp table pg2 (id uuid);
grant all on pg2 to authenticated;
with x as (
  insert into public.periodontograma (clinica_id, paciente_id, odontologo_id)
  values ('a5a5a5a5-0000-0000-0000-000000000000', 'a5a5a5a5-0000-0000-0000-0000000000f1',
          'a5000000-0000-0000-0000-00000000000c') returning id)
insert into pg2 select id from x;
select pruebas.igual((select count(*) from public.periodontograma p join pg2 on pg2.id = p.id
                       where p.odontologo_id = 'a5000000-0000-0000-0000-00000000000b'), 1, 'el dentista lo toma a su nombre');
select pruebas.debe_fallar($$select public.firmar_periodontograma((select id from pg2))$$, 'al menos una medición');

-- Recepción y otra clínica no lo ven
select pruebas.como('a5000000-0000-0000-0000-00000000000d');
select pruebas.igual((select count(*) from public.periodontograma) + (select count(*) from public.periodonto_pieza), 0,
                     'recepción no ve el periodontograma');
select pruebas.debe_fallar($$select public.guardar_periodontograma((select id from pg2), '[]'::jsonb, null, null)$$,
                           'cirujano dentista o la asistente');
select pruebas.como('b5000000-0000-0000-0000-00000000000b');
select pruebas.igual((select count(*) from public.periodontograma), 0, 'otra clínica no lo ve');
select pruebas.debe_fallar($$select public.firmar_periodontograma((select id from pg2))$$, 'no encontrado');
reset role;
select pruebas.como(null);
\echo 'periodontograma: todas las aserciones pasaron'
