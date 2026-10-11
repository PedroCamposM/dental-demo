-- Etapa 12 (v2): refrescar las fechas de la demo. Solo en una clínica de demostración;
-- corre todas sus fechas los días transcurridos (y nada de otras clínicas ni la auditoría).
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values ('e9000000-0000-0000-0000-00000000000b');
insert into public.clinica (id, nombre) values
  ('e9e9e9e9-0000-0000-0000-000000000000', 'Clínica Demo Refresco'), ('f9f9f9f9-0000-0000-0000-000000000000', 'Clínica real');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('e9000000-0000-0000-0000-00000000000b', 'e9e9e9e9-0000-0000-0000-000000000000', 'Dentista D', 'odontologo', '9793');
insert into public.paciente (id, clinica_id, dni, nombres, apellidos, fecha_nacimiento) values
  ('e9e9e9e9-0000-0000-0000-0000000000f1', 'e9e9e9e9-0000-0000-0000-000000000000', '69900001', 'Demo', 'Refresco', '1996-03-01'),
  ('f9f9f9f9-0000-0000-0000-0000000000f1', 'f9f9f9f9-0000-0000-0000-000000000000', '69900002', 'Real', 'Paciente', '1990-03-01');
-- Una evolución firmada (sus triggers prohíben editarla: el refresco los apaga un momento)
insert into public.nota_evolucion (id, clinica_id, paciente_id, odontologo_id, texto, fecha) values
  ('e9e9e9e9-0000-0000-0000-000000000091', 'e9e9e9e9-0000-0000-0000-000000000000', 'e9e9e9e9-0000-0000-0000-0000000000f1',
   'e9000000-0000-0000-0000-00000000000b', 'Sesión de demo', '2026-01-15 15:00-05');
insert into public.cierre_caja (clinica_id, fecha, por_metodo, por_profesional, total_centimos, pagos, efectivo_esperado,
                                efectivo_contado, diferencia_centimos, cerrado_por) values
  ('e9e9e9e9-0000-0000-0000-000000000000', '2026-01-14', '{}', '[]', 0, 0, 0, 0, 0, 'e9000000-0000-0000-0000-00000000000b'),
  ('e9e9e9e9-0000-0000-0000-000000000000', '2026-01-15', '{}', '[]', 0, 0, 0, 0, 0, 'e9000000-0000-0000-0000-00000000000b');

-- Solo una clínica de demostración
select pruebas.debe_fallar($$select privado.refrescar_fechas_demo('f9f9f9f9-0000-0000-0000-000000000000')$$, 'demostración');
insert into privado.clinica_demo (clinica_id, referencia)
values ('e9e9e9e9-0000-0000-0000-000000000000', (now() at time zone 'America/Lima')::date - 10);
create temp table antes as select count(*) as n from public.auditoria;
select privado.refrescar_fechas_demo('e9e9e9e9-0000-0000-0000-000000000000');
select pruebas.igual((select count(*) from public.nota_evolucion where id = 'e9e9e9e9-0000-0000-0000-000000000091'
                        and fecha = timestamptz '2026-01-22 15:00-05' and firmada_at = timestamptz '2026-01-22 15:00-05'), 1,
                     'la evolución firmada se corre una semana completa (de 10 días pasados, 7: mismo día de la semana)');
select pruebas.igual((select count(*) from public.paciente where id = 'e9e9e9e9-0000-0000-0000-0000000000f1'
                        and fecha_nacimiento = '1996-03-08'), 1, 'la edad se conserva');
select pruebas.igual((select count(*) from public.cierre_caja where clinica_id = 'e9e9e9e9-0000-0000-0000-000000000000'
                        and fecha in ('2026-01-21', '2026-01-22')), 2, 'cierres consecutivos sin chocar');
select pruebas.igual((select count(*) from public.paciente where id = 'f9f9f9f9-0000-0000-0000-0000000000f1'
                        and fecha_nacimiento = '1990-03-01'), 1, 'otra clínica intacta');
select pruebas.igual((select count(*) from privado.clinica_demo where clinica_id = 'e9e9e9e9-0000-0000-0000-000000000000'
                        and referencia = (now() at time zone 'America/Lima')::date - 3), 1,
                     'la referencia avanza lo corrido; los 3 días que sobran se corren cuando completen una semana');
select pruebas.igual((select count(*) from public.auditoria) - (select n from antes), 0, 'la auditoría no se toca');
-- Las reglas siguen activas después
select pruebas.debe_fallar($$update public.nota_evolucion set texto = 'editada' where id = 'e9e9e9e9-0000-0000-0000-000000000091'$$,
                           'firmada no se edita');
-- Con menos de una semana pendiente, no hace nada
select pruebas.igual((select (privado.refrescar_fechas_demo('e9e9e9e9-0000-0000-0000-000000000000') ->> 'dias')::bigint), 0,
                     'menos de una semana: no corre nada');
-- La app no la puede llamar
set role authenticated;
select pruebas.debe_fallar($$select privado.refrescar_fechas_demo('e9e9e9e9-0000-0000-0000-000000000000')$$, 'permission denied');
reset role;
select pruebas.como(null);
\echo 'refrescar_demo: todas las aserciones pasaron'
