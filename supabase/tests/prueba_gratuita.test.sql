-- Etapa 16 (v2): prueba gratuita por clínica. Alta de la clínica de quien se registra, solo
-- lectura al vencer (se sigue viendo, nada se borra) y activación manual por el superadmin.
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values
  ('e6000000-0000-0000-0000-00000000000a'),   -- se registra a la prueba
  ('e6000000-0000-0000-0000-0000000000aa'),   -- superadministrador (sin clínica)
  ('f6000000-0000-0000-0000-00000000000a');   -- admin de otra clínica
insert into public.clinica (id, nombre) values ('f6f6f6f6-0000-0000-0000-000000000000', 'Otra clínica');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('f6000000-0000-0000-0000-00000000000a', 'f6f6f6f6-0000-0000-0000-000000000000', 'Admin O', 'admin', '9821');
create temp table nueva (id uuid);
grant all on nueva to authenticated;

set role authenticated;
-- Alta: valida en la base y crea la clínica con su admin, sillón, horario y pacientes de ejemplo
select pruebas.como('e6000000-0000-0000-0000-00000000000a');
select pruebas.debe_fallar($$select public.crear_clinica_prueba('X', 'Dra. Prueba', '9822')$$, 'nombre de la clínica');
select pruebas.debe_fallar($$select public.crear_clinica_prueba('Consultorio Prueba', 'Dra. Prueba', 'abc')$$, 'COP');
insert into nueva select public.crear_clinica_prueba('Consultorio Prueba', 'Dra. Prueba', '9822');
select pruebas.igual((select count(*) from public.clinica c, nueva n where c.id = n.id and c.plan = 'prueba'
                        and c.prueba_hasta = (now() at time zone 'America/Lima')::date + 30), 1, 'prueba de 30 días');
select pruebas.igual((select count(*) from public.usuario where id = auth.uid() and rol = 'admin' and cop = '9822'), 1,
                     'queda como administrador de su clínica');
select pruebas.igual((select count(*) from public.paciente where nombres like '%(ejemplo)'), 3, 'tres pacientes de ejemplo');
select pruebas.igual((select count(*) from public.horario_profesional), 6, 'horario de lunes a sábado');
select pruebas.igual((select count(*) from public.paciente where clinica_id = 'f6f6f6f6-0000-0000-0000-000000000000'), 0,
                     'no ve otra clínica');
select pruebas.debe_fallar($$select public.crear_clinica_prueba('Otra más', 'Dra. Prueba', null)$$, 'ya pertenece');
-- Con la prueba vigente registra normalmente
insert into public.paciente (clinica_id, nombres, apellidos, fecha_nacimiento, telefono, consentimiento_datos_at)
select id, 'Real', 'Uno', '1980-01-01', '51911111111', now() from nueva;
-- No es superadmin
select pruebas.debe_fallar($$select * from public.clinicas_plataforma()$$, 'superadministrador');
select pruebas.debe_fallar($$select public.extender_plan((select id from nueva), 'activo', current_date + 30, 'Me lo regalo')$$,
                           'superadministrador');
reset role;

-- La prueba vence: solo lectura (se ve todo; no se registra, edita ni anula nada)
update public.clinica set prueba_hasta = (now() at time zone 'America/Lima')::date - 1 where id = (select id from nueva);
set role authenticated;
select pruebas.como('e6000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.paciente), 4, 'vencida: sigue viendo a sus pacientes');
select pruebas.debe_fallar($$insert into public.paciente (clinica_id, nombres, apellidos, fecha_nacimiento, telefono, consentimiento_datos_at)
  select id, 'Nuevo', 'Paciente', '1981-01-01', '51911111112', now() from nueva$$, 'solo lectura');
select pruebas.debe_fallar($$update public.paciente set telefono = '51911111113' where nombres = 'Real'$$, 'solo lectura');
select pruebas.debe_fallar($$select public.crear_clinica_prueba('Otra', 'Dra. Prueba', null)$$, 'ya pertenece');
-- Otra clínica (activa) no se ve afectada
select pruebas.como('f6000000-0000-0000-0000-00000000000a');
insert into public.paciente (clinica_id, nombres, apellidos, fecha_nacimiento, telefono, consentimiento_datos_at)
values ('f6f6f6f6-0000-0000-0000-000000000000', 'Activa', 'Sigue', '1982-01-01', '51911111114', now());
reset role;

-- El superadmin (agregado a mano por SQL) ve las clínicas y activa el plan, con motivo y en la auditoría
insert into privado.superadmin (usuario_id) values ('e6000000-0000-0000-0000-0000000000aa');
set role authenticated;
select pruebas.como('e6000000-0000-0000-0000-0000000000aa');
select pruebas.igual((select count(*) from public.clinicas_plataforma() where nombre = 'Consultorio Prueba' and pacientes = 4), 1,
                     'el superadmin ve las clínicas');
select pruebas.debe_fallar($$select public.extender_plan((select id from nueva), 'activo', current_date + 30, '')$$, 'motivo');
select pruebas.debe_fallar($$select public.extender_plan((select id from nueva), 'activo', (now() at time zone 'America/Lima')::date - 1, 'Pago')$$, 'fecha de fin');
select public.extender_plan((select id from nueva), 'activo', (now() at time zone 'America/Lima')::date + 365, 'Pago anual por transferencia');
reset role;
select pruebas.igual((select count(*) from public.auditoria where tabla = 'clinica' and accion = 'update'
                        and despues ->> 'motivo' = 'Pago anual por transferencia'), 1, 'activación en la auditoría');
set role authenticated;
select pruebas.como('e6000000-0000-0000-0000-00000000000a');
insert into public.paciente (clinica_id, nombres, apellidos, fecha_nacimiento, telefono, consentimiento_datos_at)
select id, 'Otra vez', 'Activa', '1983-01-01', '51911111115', now() from nueva;
select pruebas.igual((select count(*) from public.paciente where nombres = 'Otra vez'), 1, 'con el plan activo vuelve a registrar');
reset role;
select pruebas.como(null);
\echo 'prueba_gratuita: todas las aserciones pasaron'
