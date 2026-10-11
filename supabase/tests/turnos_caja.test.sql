-- Etapa 20 (v2): turnos de caja. Abrir con fondo, cobrar, cerrar el turno contando el efectivo
-- (fondo + efectivo del turno) y abrir otro el mismo día. El turno cerrado no se reabre; el
-- cierre del día exige cerrar antes el turno abierto. Solo administración y recepción.
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values
  ('ec000000-0000-0000-0000-00000000000a'), ('ec000000-0000-0000-0000-00000000000b'),
  ('ec000000-0000-0000-0000-00000000000d'), ('fc000000-0000-0000-0000-00000000000a');
insert into public.clinica (id, nombre) values
  ('ecececec-0000-0000-0000-000000000000', 'Clínica Turnos'), ('fcfcfcfc-0000-0000-0000-000000000000', 'Otra');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('ec000000-0000-0000-0000-00000000000a', 'ecececec-0000-0000-0000-000000000000', 'Admin T',     'admin',      '9841'),
  ('ec000000-0000-0000-0000-00000000000b', 'ecececec-0000-0000-0000-000000000000', 'Odontóloga T', 'odontologo', '9842'),
  ('ec000000-0000-0000-0000-00000000000d', 'ecececec-0000-0000-0000-000000000000', 'Recepción T',  'recepcion',  null),
  ('fc000000-0000-0000-0000-00000000000a', 'fcfcfcfc-0000-0000-0000-000000000000', 'Admin O',      'admin',      '9941');
insert into public.paciente (id, clinica_id, dni, nombres, apellidos, fecha_nacimiento) values
  ('ecececec-0000-0000-0000-0000000000f1', 'ecececec-0000-0000-0000-000000000000', '66000101', 'Turno', 'Uno', '1980-01-01');
insert into public.plan_tratamiento (id, clinica_id, paciente_id, odontologo_id, titulo, estado, aceptado_at) values
  ('ecececec-0000-0000-0000-0000000000a1', 'ecececec-0000-0000-0000-000000000000', 'ecececec-0000-0000-0000-0000000000f1',
   'ec000000-0000-0000-0000-00000000000b', 'Plan turnos', 'aceptado', now());
insert into public.item_plan (id, clinica_id, plan_id, procedimiento, precio_centimos, odontologo_id, estado, orden) values
  ('ecececec-0000-0000-0000-0000000000e1', 'ecececec-0000-0000-0000-000000000000', 'ecececec-0000-0000-0000-0000000000a1',
   'Rehabilitación', 500000, 'ec000000-0000-0000-0000-00000000000b', 'aceptado', 1);

set role authenticated;
-- La odontóloga no abre turnos ni los ve
select pruebas.como('ec000000-0000-0000-0000-00000000000b');
select pruebas.debe_fallar($$select public.abrir_turno(10000)$$, 'administración o recepción');
select pruebas.debe_fallar($$select * from public.turno_abierto()$$, 'administración y recepción');

-- Sin turno, los pagos siguen funcionando (los turnos son opcionales)
select pruebas.como('ec000000-0000-0000-0000-00000000000d');
select public.registrar_pago('ecececec-0000-0000-0000-0000000000a1', 1000, 'efectivo', null);
select pruebas.igual((select count(*) from public.pago where turno_id is null), 1, 'pago sin turno');

-- Turno de la mañana: fondo S/ 100, cobra S/ 50 en efectivo y S/ 30 por Yape
select pruebas.debe_fallar($$select public.abrir_turno(-1)$$, 'fondo inicial');
select public.abrir_turno(10000, 'Turno mañana');
select pruebas.debe_fallar($$select public.abrir_turno(0)$$, 'Ya hay un turno abierto');
select public.registrar_pago('ecececec-0000-0000-0000-0000000000a1', 5000, 'efectivo', null);
select public.registrar_pago('ecececec-0000-0000-0000-0000000000a1', 3000, 'yape', 'OP-1');
select pruebas.igual((select (resumen ->> 'total_centimos')::bigint from public.turno_abierto()), 8000, 'lo cobrado en el turno');
-- No se cierra el día con el turno abierto
select pruebas.debe_fallar($$select public.cerrar_caja((now() at time zone 'America/Lima')::date, 0, null)$$, 'turno de caja abierto');
-- Nadie escribe la tabla directo
select pruebas.debe_fallar($$update public.turno_caja set fondo_centimos = 0$$, 'permission denied');
select pruebas.debe_fallar($$insert into public.turno_caja (clinica_id, fecha, fondo_centimos, abierto_por)
  values ('ecececec-0000-0000-0000-000000000000', current_date, 0, 'ec000000-0000-0000-0000-00000000000d')$$, 'permission denied');
select pruebas.debe_fallar($$update public.pago set turno_id = null where monto_centimos = 5000$$, 'permission denied');

-- Cierra la mañana contando S/ 145 (faltan S/ 5)
create temp table manana as select public.cerrar_turno(14500, 'Faltan 5 soles') as id;
grant select on manana to authenticated;
select pruebas.igual((select efectivo_esperado from public.turno_caja where id = (select id from manana)), 15000, 'esperado = fondo + efectivo');
select pruebas.igual((select diferencia_centimos from public.turno_caja where id = (select id from manana)), -500, 'diferencia');
select pruebas.igual((select pagos from public.turno_caja where id = (select id from manana)), 2, 'pagos del turno (no el de antes)');
select pruebas.debe_fallar($$select public.cerrar_turno(0, null)$$, 'No hay un turno abierto');

-- Turno de la tarde (el admin), el mismo día
select pruebas.como('ec000000-0000-0000-0000-00000000000a');
select public.abrir_turno(14500, null);
select public.registrar_pago('ecececec-0000-0000-0000-0000000000a1', 2000, 'efectivo', null);
select public.cerrar_turno(16500, null);
select pruebas.igual((select count(*) from public.turno_caja where cerrado_at is not null and diferencia_centimos = 0), 1, 'tarde cuadra');
select pruebas.igual((select count(*) from public.turno_caja), 2, 'dos turnos en el día');
reset role;
-- Un turno cerrado no se reabre ni se cambia (ni siquiera fuera de la app)
select pruebas.debe_fallar($$update public.turno_caja set cerrado_at = null, cerrado_por = null, efectivo_contado = null,
  diferencia_centimos = null, por_metodo = null where id = (select id from manana)$$, 'no se reabre');

set role authenticated;
-- El cierre del día sigue igual: efectivo de los pagos del día (sin el fondo)
select pruebas.como('ec000000-0000-0000-0000-00000000000d');
create temp table cierre_t as select public.cerrar_caja((now() at time zone 'America/Lima')::date, 8000, null) as id;
grant select on cierre_t to authenticated;
select pruebas.igual((select efectivo_esperado from public.cierre_caja where id = (select id from cierre_t)), 8000,
                     'el día: 10 + 50 + 20 soles en efectivo');
select pruebas.debe_fallar($$select public.abrir_turno(0)$$, 'ya se cerró');

-- Otra clínica no ve los turnos
select pruebas.como('fc000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.turno_caja), 0, 'otra clínica no ve los turnos');
select pruebas.igual((select count(*) from public.turno_abierto()), 0, 'ni el abierto');
reset role;
select pruebas.igual((select count(*) from public.auditoria where tabla = 'turno_caja'
                        and clinica_id = 'ecececec-0000-0000-0000-000000000000'), 4, 'abrir y cerrar quedan en la auditoría');
select pruebas.como(null);
\echo 'turnos_caja: todas las aserciones pasaron'
