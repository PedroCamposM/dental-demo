-- Etapa 19 (v2): equipo de la clínica. Solo el administrador ve el equipo, incorpora a quien
-- su clínica invitó y desactiva o reactiva usuarios (nunca a sí mismo).
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id, email, raw_app_meta_data, last_sign_in_at) values
  ('c9000000-0000-0000-0000-00000000000a', 'admin-e@clinica.example', '{}', now()),
  ('c9000000-0000-0000-0000-00000000000e', 'asistente-e@clinica.example', '{}', now()),
  ('c9000000-0000-0000-0000-0000000000b1', 'invitada@clinica.example', '{"invitado_clinica": "c9c9c9c9-0000-0000-0000-000000000000"}', null),
  ('c9000000-0000-0000-0000-0000000000b2', 'odonto@clinica.example', '{"invitado_clinica": "c9c9c9c9-0000-0000-0000-000000000000"}', null),
  ('c9000000-0000-0000-0000-0000000000b3', 'de-otra@clinica.example', '{"invitado_clinica": "d9d9d9d9-0000-0000-0000-000000000000"}', null),
  ('d9000000-0000-0000-0000-00000000000a', 'admin-o@clinica.example', '{}', now());
insert into public.clinica (id, nombre) values
  ('c9c9c9c9-0000-0000-0000-000000000000', 'Clínica Equipo'), ('d9d9d9d9-0000-0000-0000-000000000000', 'Otra');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('c9000000-0000-0000-0000-00000000000a', 'c9c9c9c9-0000-0000-0000-000000000000', 'Admin E', 'admin', null),
  ('c9000000-0000-0000-0000-00000000000e', 'c9c9c9c9-0000-0000-0000-000000000000', 'Asistente E', 'asistente', null),
  ('d9000000-0000-0000-0000-00000000000a', 'd9d9d9d9-0000-0000-0000-000000000000', 'Admin O', 'admin', '9899');

set role authenticated;
-- La asistente no ve el equipo ni invita
select pruebas.como('c9000000-0000-0000-0000-00000000000e');
select pruebas.debe_fallar($$select * from public.equipo_clinica()$$, 'Solo el administrador');
select pruebas.debe_fallar($$select public.incorporar_usuario('c9000000-0000-0000-0000-0000000000b1', 'Invitada', 'recepcion', null)$$,
                           'Solo el administrador');

select pruebas.como('c9000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.equipo_clinica() where correo = 'asistente-e@clinica.example'), 1, 'el admin ve su equipo');
-- Solo incorpora a quien invitó su clínica, con datos válidos
select pruebas.debe_fallar($$select public.incorporar_usuario('c9000000-0000-0000-0000-0000000000b3', 'De otra', 'recepcion', null)$$,
                           'Invitación no encontrada');
select pruebas.debe_fallar($$select public.incorporar_usuario('d9000000-0000-0000-0000-00000000000a', 'Admin O', 'recepcion', null)$$,
                           'Invitación no encontrada');
select pruebas.debe_fallar($$select public.incorporar_usuario('c9000000-0000-0000-0000-0000000000b2', 'Odonto', 'odontologo', null)$$,
                           'colegiatura');
select public.incorporar_usuario('c9000000-0000-0000-0000-0000000000b1', 'Recepción Invitada', 'recepcion', '1234');
select public.incorporar_usuario('c9000000-0000-0000-0000-0000000000b2', 'Dr. Invitado', 'odontologo', '9898');
select pruebas.igual((select count(*) from public.usuario where id = 'c9000000-0000-0000-0000-0000000000b1' and rol = 'recepcion'
                        and cop is null), 1, 'recepción sin COP aunque lo escriban');
select pruebas.igual((select count(*) from public.equipo_clinica() where invitacion_pendiente), 2, 'las invitadas aún no ingresan');
select pruebas.debe_fallar($$select public.incorporar_usuario('c9000000-0000-0000-0000-0000000000b1', 'Otra vez', 'recepcion', null)$$,
                           'ya pertenece');
-- Desactivar y reactivar (no a uno mismo)
select pruebas.debe_fallar($$select public.cambiar_estado_usuario('c9000000-0000-0000-0000-00000000000a', false)$$, 'ti mismo');
select pruebas.debe_fallar($$select public.cambiar_estado_usuario('d9000000-0000-0000-0000-00000000000a', false)$$, 'no encontrado');
select public.cambiar_estado_usuario('c9000000-0000-0000-0000-00000000000e', false);
select pruebas.igual((select count(*) from public.usuario where id = 'c9000000-0000-0000-0000-00000000000e' and not activo), 1,
                     'desactivada (no borrada)');
-- Desactivada ya no ve nada de la clínica
select pruebas.como('c9000000-0000-0000-0000-00000000000e');
select pruebas.igual((select count(*) from public.usuario), 0, 'la desactivada no ve a la clínica');
select pruebas.como('c9000000-0000-0000-0000-00000000000a');
select public.cambiar_estado_usuario('c9000000-0000-0000-0000-00000000000e', true);
select pruebas.igual((select count(*) from public.usuario where id = 'c9000000-0000-0000-0000-00000000000e' and activo), 1, 'reactivada');
reset role;

-- Con la clínica vencida no se incorpora a nadie (solo lectura)
update public.clinica set plan = 'prueba', prueba_hasta = (now() at time zone 'America/Lima')::date - 1
 where id = 'c9c9c9c9-0000-0000-0000-000000000000';
insert into auth.users (id, email, raw_app_meta_data) values
  ('c9000000-0000-0000-0000-0000000000b4', 'tarde@clinica.example', '{"invitado_clinica": "c9c9c9c9-0000-0000-0000-000000000000"}');
set role authenticated;
select pruebas.como('c9000000-0000-0000-0000-00000000000a');
select pruebas.debe_fallar($$select public.incorporar_usuario('c9000000-0000-0000-0000-0000000000b4', 'Tarde', 'asistente', null)$$,
                           'solo lectura');
-- …pero sí puede quitarle el acceso a alguien (un exempleado no espera al pago)
select public.cambiar_estado_usuario('c9000000-0000-0000-0000-00000000000e', false);
select pruebas.igual((select count(*) from public.usuario where id = 'c9000000-0000-0000-0000-00000000000e' and not activo), 1,
                     'vencida: desactivar sí');
select pruebas.debe_fallar($$select public.cambiar_estado_usuario('c9000000-0000-0000-0000-00000000000e', true)$$, 'solo lectura');
select pruebas.debe_fallar($$update public.usuario set nombre = 'Otro nombre' where id = 'c9000000-0000-0000-0000-0000000000b1'$$,
                           'solo lectura');
-- Un usuario no puede marcarse como invitado: la marca va en app_metadata (no editable por él)
select pruebas.igual((select count(*) from public.usuario where id = 'c9000000-0000-0000-0000-00000000000a'), 1, 'sigue el admin');
reset role;
-- estado_correo: solo la service role
set role authenticated;
select pruebas.como('c9000000-0000-0000-0000-00000000000a');
select pruebas.debe_fallar($$select public.estado_correo('x@y.pe', 'c9c9c9c9-0000-0000-0000-000000000000')$$, 'permission denied');
reset role;
grant usage on schema pruebas to service_role;
grant execute on all functions in schema pruebas to service_role;
set role service_role;
select pruebas.igual((select count(*) where public.estado_correo('nadie@clinica.example', 'c9c9c9c9-0000-0000-0000-000000000000') = 'libre'), 1, 'libre');
select pruebas.igual((select count(*) where public.estado_correo(' Asistente-E@clinica.example', 'c9c9c9c9-0000-0000-0000-000000000000') = 'en_tu_equipo'), 1,
                     'en tu equipo (sin importar mayúsculas)');
select pruebas.igual((select count(*) where public.estado_correo('admin-o@clinica.example', 'c9c9c9c9-0000-0000-0000-000000000000') = 'en_otra_clinica'), 1,
                     'en otra clínica');
select pruebas.igual((select count(*) where public.estado_correo('de-otra@clinica.example', 'c9c9c9c9-0000-0000-0000-000000000000') = 'con_cuenta'), 1,
                     'con cuenta sin clínica');
reset role;
select pruebas.como(null);
\echo 'equipo: todas las aserciones pasaron'
