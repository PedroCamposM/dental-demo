-- Etapa 18 (v2): gestión de clientes. Solo el superadministrador ve el resumen, las fichas
-- (conteos, sin datos clínicos) y las notas; los correos diarios solo los ve la service role.
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id, email, last_sign_in_at) values
  ('c8000000-0000-0000-0000-00000000000a', 'admin-g@clinica.example', now() - interval '20 days'),
  ('c8000000-0000-0000-0000-0000000000aa', 'super-g@plataforma.example', now()),
  ('d8000000-0000-0000-0000-00000000000a', 'admin-v@clinica.example', now() - interval '1 day');
insert into public.clinica (id, nombre, plan, prueba_hasta, activo_hasta) values
  -- En prueba, vence en 5 días y lleva 20 días sin uso
  ('c8c8c8c8-0000-0000-0000-000000000000', 'Clínica Gestión', 'prueba', (now() at time zone 'America/Lima')::date + 5, null),
  -- Pagó y venció anteayer
  ('d8d8d8d8-0000-0000-0000-000000000000', 'Clínica Vencida', 'activo', (now() at time zone 'America/Lima')::date - 40,
   (now() at time zone 'America/Lima')::date - 2);
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('c8000000-0000-0000-0000-00000000000a', 'c8c8c8c8-0000-0000-0000-000000000000', 'Admin G', 'admin', '9881'),
  ('d8000000-0000-0000-0000-00000000000a', 'd8d8d8d8-0000-0000-0000-000000000000', 'Admin V', 'admin', '9882');
insert into public.pago_suscripcion (clinica_id, tarifa, periodo, monto_centimos, metodo, operacion, pagado_el, estado,
                                     reportado_por, revisado_at, plan_hasta) values
  ('d8d8d8d8-0000-0000-0000-000000000000', 'consultorio', 'anual', 99000, 'yape', 'G-ANUAL-1',
   (now() at time zone 'America/Lima')::date - 40, 'confirmado', 'd8000000-0000-0000-0000-00000000000a', now() - interval '40 days',
   (now() at time zone 'America/Lima')::date - 2);
insert into privado.superadmin (usuario_id) values ('c8000000-0000-0000-0000-0000000000aa');
create temp table pago_g as select id from public.pago_suscripcion where operacion = 'G-ANUAL-1';
grant select on pago_g to authenticated;

set role authenticated;
-- Una clínica no ve nada de esto
select pruebas.como('c8000000-0000-0000-0000-00000000000a');
select pruebas.debe_fallar($$select * from public.resumen_plataforma()$$, 'superadministrador');
select pruebas.debe_fallar($$select public.ficha_clinica('c8c8c8c8-0000-0000-0000-000000000000')$$, 'superadministrador');
select pruebas.debe_fallar($$select public.agregar_nota_clinica('c8c8c8c8-0000-0000-0000-000000000000', 'Hola')$$, 'superadministrador');
select pruebas.debe_fallar($$select * from public.contacto_pago(gen_random_uuid())$$, 'superadministrador');
select pruebas.debe_fallar($$select * from public.correos_pendientes()$$, 'permission denied');
select pruebas.debe_fallar($$select public.reservar_correo('c8c8c8c8-0000-0000-0000-000000000000', 'sin_uso', 'x', 'x')$$, 'permission denied');
select pruebas.debe_fallar($$select privado.correo_admin('c8c8c8c8-0000-0000-0000-000000000000')$$, 'permission denied');
select pruebas.debe_fallar($$select * from privado.nota_clinica$$, 'permission denied');

-- El superadministrador
select pruebas.como('c8000000-0000-0000-0000-0000000000aa');
select pruebas.igual((select count(*) from public.resumen_plataforma() where en_prueba >= 1 and vencidas >= 1 and vencen_7 >= 1
                        and vencieron_mes >= 0), 1, 'resumen con pruebas, vencidas y por vencer');
select pruebas.igual((select count(*) from public.clinicas_plataforma() where nombre = 'Clínica Gestión'
                        and correo_admin = 'admin-g@clinica.example'
                        and ultima_actividad < now() - interval '19 days'), 1, 'última actividad y contacto');
select pruebas.igual((select count(*) from public.clinicas_plataforma() where nombre = 'Clínica Vencida' and ultimo_pago_estado = 'confirmado'), 1,
                     'último pago');
select public.agregar_nota_clinica('c8c8c8c8-0000-0000-0000-000000000000', 'Llamé: quiere el plan anual');
select pruebas.debe_fallar($$select public.agregar_nota_clinica('c8c8c8c8-0000-0000-0000-000000000000', ' ')$$, '2 a 1000');
create temp table ficha as select public.ficha_clinica('c8c8c8c8-0000-0000-0000-000000000000') as f;
select pruebas.igual((select jsonb_array_length(f -> 'semanas') from ficha), 8, 'ocho semanas de uso');
select pruebas.igual((select jsonb_array_length(f -> 'notas') from ficha), 1, 'la nota interna');
select pruebas.igual((select count(*) from ficha where f -> 'usuarios' -> 0 ->> 'correo' = 'admin-g@clinica.example'), 1, 'usuarios con correo');
-- Solo conteos: la ficha no trae nombres de pacientes ni textos clínicos
select pruebas.igual((select count(*) from ficha where f::text ~* 'paciente_id|nombres|texto_evolucion|diagnostico'), 0,
                     'sin datos clínicos');
select pruebas.igual((select count(*) from public.contacto_pago((select id from pago_g))
                       where correo = 'admin-v@clinica.example'), 1, 'contacto para avisar del pago');
select pruebas.igual((select count(*) from public.clinicas_plataforma('c8c8c8c8-0000-0000-0000-000000000000')), 1, 'una sola clínica');
reset role;

-- Correos diarios (service role): vence pronto y sin uso para la de prueba; vencido para la otra
grant usage on schema pruebas to service_role;
grant execute on all functions in schema pruebas to service_role;
set role service_role;
select pruebas.igual((select count(*) from public.correos_pendientes() where clinica = 'Clínica Gestión' and tipo = 'vence_pronto'
                        and para = 'admin-g@clinica.example'), 1, 'aviso: vence en 7 días o menos');
select pruebas.igual((select count(*) from public.correos_pendientes() where clinica = 'Clínica Gestión' and tipo = 'sin_uso'), 1,
                     'aviso: 10 días sin uso');
select pruebas.igual((select count(*) from public.correos_pendientes() where clinica = 'Clínica Vencida' and tipo = 'vencido'), 1,
                     'aviso: venció');
select pruebas.igual((select count(*) from public.correos_pendientes() where clinica = 'Clínica Vencida' and tipo = 'sin_uso'), 0,
                     'vencida: no se le avisa de uso');
-- Reserva antes de enviar: la segunda vez ya no se obtiene
select pruebas.igual((select count(*) from public.correos_pendientes() p
                       where p.clinica in ('Clínica Gestión', 'Clínica Vencida')
                         and public.reservar_correo(p.clinica_id, p.tipo, p.referencia, p.para)), 3, 'tres reservas');
select pruebas.igual((select count(*) from public.clinica c where c.id = 'c8c8c8c8-0000-0000-0000-000000000000'
                       and public.reservar_correo(c.id, 'sin_uso', ((now() - interval '20 days') at time zone 'America/Lima')::date::text, 'x')), 0,
                     'una reserva repetida no se obtiene');
select pruebas.igual((select count(*) from public.correos_pendientes() where clinica in ('Clínica Gestión', 'Clínica Vencida')), 0,
                     'cada correo sale una sola vez');
-- Si el envío falla, se libera y vuelve a estar pendiente
select public.liberar_correo('c8c8c8c8-0000-0000-0000-000000000000', 'vence_pronto',
                             ((now() at time zone 'America/Lima')::date + 5)::text);
select pruebas.igual((select count(*) from public.correos_pendientes() where clinica = 'Clínica Gestión' and tipo = 'vence_pronto'), 1,
                     'liberado: se reintenta');
-- Con un pago por confirmar no se le pide pagar
insert into public.pago_suscripcion (clinica_id, tarifa, periodo, monto_centimos, metodo, operacion, pagado_el, reportado_por)
values ('c8c8c8c8-0000-0000-0000-000000000000', 'consultorio', 'mensual', 9900, 'yape', 'G-PEND-1',
        (now() at time zone 'America/Lima')::date, 'c8000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.correos_pendientes() where clinica = 'Clínica Gestión' and tipo = 'vence_pronto'), 0,
                     'con pago por confirmar no se avisa');
reset role;
select pruebas.como(null);
\echo 'gestion_clientes: todas las aserciones pasaron'
