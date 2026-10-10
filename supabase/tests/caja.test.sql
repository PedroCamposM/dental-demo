-- Etapa 8.2 (v2): registrar pagos (aplicados en la base) y cierre de caja diario.
-- Regla 7: céntimos. Un día cerrado no recibe pagos ni anulaciones: se ajusta con motivo.
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values
  ('a4000000-0000-0000-0000-00000000000a'), ('a4000000-0000-0000-0000-00000000000b'),
  ('a4000000-0000-0000-0000-00000000000d'), ('b4000000-0000-0000-0000-00000000000a');
insert into public.clinica (id, nombre) values
  ('a4a4a4a4-0000-0000-0000-000000000000', 'Clínica Caja'), ('b4b4b4b4-0000-0000-0000-000000000000', 'Otra');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('a4000000-0000-0000-0000-00000000000a', 'a4a4a4a4-0000-0000-0000-000000000000', 'Admin C',     'admin',      '9851'),
  ('a4000000-0000-0000-0000-00000000000b', 'a4a4a4a4-0000-0000-0000-000000000000', 'Odontóloga C', 'odontologo', '9852'),
  ('a4000000-0000-0000-0000-00000000000d', 'a4a4a4a4-0000-0000-0000-000000000000', 'Recepción C',  'recepcion',  null),
  ('b4000000-0000-0000-0000-00000000000a', 'b4b4b4b4-0000-0000-0000-000000000000', 'Admin O',      'admin',      '9951');
insert into public.paciente (id, clinica_id, dni, nombres, apellidos, fecha_nacimiento) values
  ('a4a4a4a4-0000-0000-0000-0000000000f1', 'a4a4a4a4-0000-0000-0000-000000000000', '66000001', 'Caja', 'Uno', '1980-01-01');
insert into public.plan_tratamiento (id, clinica_id, paciente_id, odontologo_id, titulo, estado, aceptado_at) values
  ('a4a4a4a4-0000-0000-0000-0000000000a1', 'a4a4a4a4-0000-0000-0000-000000000000', 'a4a4a4a4-0000-0000-0000-0000000000f1',
   'a4000000-0000-0000-0000-00000000000b', 'Sin cuotas', 'aceptado', now()),
  ('a4a4a4a4-0000-0000-0000-0000000000a2', 'a4a4a4a4-0000-0000-0000-000000000000', 'a4a4a4a4-0000-0000-0000-0000000000f1',
   'a4000000-0000-0000-0000-00000000000b', 'Con cuotas', 'aceptado', now()),
  ('a4a4a4a4-0000-0000-0000-0000000000a3', 'a4a4a4a4-0000-0000-0000-000000000000', 'a4a4a4a4-0000-0000-0000-0000000000f1',
   'a4000000-0000-0000-0000-00000000000b', 'Propuesto', 'propuesto', null);
insert into public.item_plan (id, clinica_id, plan_id, procedimiento, precio_centimos, odontologo_id, estado, orden) values
  ('a4a4a4a4-0000-0000-0000-0000000000e1', 'a4a4a4a4-0000-0000-0000-000000000000', 'a4a4a4a4-0000-0000-0000-0000000000a1',
   'Resina', 20000, 'a4000000-0000-0000-0000-00000000000b', 'aceptado', 1),
  ('a4a4a4a4-0000-0000-0000-0000000000e2', 'a4a4a4a4-0000-0000-0000-000000000000', 'a4a4a4a4-0000-0000-0000-0000000000a1',
   'Profilaxis', 10000, 'a4000000-0000-0000-0000-00000000000b', 'aceptado', 2),
  ('a4a4a4a4-0000-0000-0000-0000000000e3', 'a4a4a4a4-0000-0000-0000-000000000000', 'a4a4a4a4-0000-0000-0000-0000000000a2',
   'Rehabilitación oral', 200000, 'a4000000-0000-0000-0000-00000000000b', 'aceptado', 1);
insert into public.cuota (id, clinica_id, plan_id, numero, monto_centimos, vence_el) values
  ('a4a4a4a4-0000-0000-0000-0000000000c1', 'a4a4a4a4-0000-0000-0000-000000000000', 'a4a4a4a4-0000-0000-0000-0000000000a2', 1, 100000, current_date),
  ('a4a4a4a4-0000-0000-0000-0000000000c2', 'a4a4a4a4-0000-0000-0000-000000000000', 'a4a4a4a4-0000-0000-0000-0000000000a2', 2, 100000, current_date + 30);

set role authenticated;
select pruebas.como('a4000000-0000-0000-0000-00000000000b');
select pruebas.debe_fallar($$select public.registrar_pago('a4a4a4a4-0000-0000-0000-0000000000a1', 1000, 'efectivo', null)$$,
                           'administración o recepción');
select pruebas.como('a4000000-0000-0000-0000-00000000000d');
select pruebas.debe_fallar($$select public.registrar_pago('a4a4a4a4-0000-0000-0000-0000000000a1', 0, 'efectivo', null)$$, 'mayor que cero');
select pruebas.debe_fallar($$select public.registrar_pago('a4a4a4a4-0000-0000-0000-0000000000a3', 1000, 'efectivo', null)$$, 'aceptado');
select pruebas.debe_fallar($$select public.registrar_pago('a4a4a4a4-0000-0000-0000-0000000000a1', 30001, 'yape', null)$$, 'excede el saldo');
-- Sin cuotas: se aplica a los ítems en orden
select public.registrar_pago('a4a4a4a4-0000-0000-0000-0000000000a1', 25000, 'efectivo', null);
select pruebas.igual((select cobrado_centimos from public.v_item_cobro where item_plan_id = 'a4a4a4a4-0000-0000-0000-0000000000e1'), 20000, 'resina cobrada');
select pruebas.igual((select cobrado_centimos from public.v_item_cobro where item_plan_id = 'a4a4a4a4-0000-0000-0000-0000000000e2'), 5000, 'profilaxis parcial');
-- Con cuotas: a la cuota pendiente más antigua
select public.registrar_pago('a4a4a4a4-0000-0000-0000-0000000000a2', 150000, 'yape', 'OP-123');
select pruebas.igual((select pagado_centimos from public.v_cuota_saldo where cuota_id = 'a4a4a4a4-0000-0000-0000-0000000000c1'), 100000, 'cuota 1 pagada');
select pruebas.igual((select pagado_centimos from public.v_cuota_saldo where cuota_id = 'a4a4a4a4-0000-0000-0000-0000000000c2'), 50000, 'cuota 2 a medias');

-- Resumen y cierre del día
select pruebas.igual((select (public.resumen_caja((now() at time zone 'America/Lima')::date) ->> 'total_centimos')::bigint), 175000,
                     'total del día');
select pruebas.igual((select (public.resumen_caja((now() at time zone 'America/Lima')::date) -> 'por_metodo' ->> 'yape')::bigint), 150000,
                     'por método');
select pruebas.debe_fallar($$select public.cerrar_caja((now() at time zone 'America/Lima')::date + 1, 0, null)$$, 'aún no llega');
create temp table cierre (id uuid);
grant all on cierre to authenticated;
insert into cierre select public.cerrar_caja((now() at time zone 'America/Lima')::date, 24000, 'Faltan 10 soles');
select pruebas.igual((select diferencia_centimos from public.cierre_caja c join cierre on cierre.id = c.id), -1000,
                     'diferencia contra el efectivo esperado');
select pruebas.debe_fallar($$select public.cerrar_caja((now() at time zone 'America/Lima')::date, 25000, null)$$, 'ya está cerrada');
-- Día cerrado: ni pagos nuevos ni anulaciones; se ajusta con motivo
select pruebas.debe_fallar($$select public.registrar_pago('a4a4a4a4-0000-0000-0000-0000000000a1', 1000, 'efectivo', null)$$, 'ya se cerró');
select pruebas.debe_fallar($$update public.pago set anulado_at = now(), anulado_por = 'a4000000-0000-0000-0000-00000000000d',
                               motivo_anulacion = 'Error' where plan_id = 'a4a4a4a4-0000-0000-0000-0000000000a1'$$, 'ya se cerró');
insert into public.ajuste_caja (clinica_id, cierre_id, metodo, monto_centimos, motivo, registrado_por)
select 'a4a4a4a4-0000-0000-0000-000000000000', id, 'efectivo', -1000, 'Vuelto mal entregado al paciente',
       'a4000000-0000-0000-0000-00000000000d' from cierre;
select pruebas.debe_fallar($$insert into public.ajuste_caja (clinica_id, cierre_id, metodo, monto_centimos, motivo, registrado_por)
  select 'a4a4a4a4-0000-0000-0000-000000000000', id, 'efectivo', 0, 'Nada que ajustar', 'a4000000-0000-0000-0000-00000000000d'
  from cierre$$, 'check constraint');
select pruebas.debe_fallar($$update public.cierre_caja set efectivo_contado = 25000$$, 'permission denied');
select pruebas.debe_fallar($$delete from public.ajuste_caja$$, 'permission denied');

-- La odontóloga y otra clínica no ven la caja
select pruebas.como('a4000000-0000-0000-0000-00000000000b');
select pruebas.igual((select count(*) from public.cierre_caja) + (select count(*) from public.ajuste_caja), 0, 'odontóloga no ve la caja');
select pruebas.debe_fallar($$select public.resumen_caja(current_date)$$, 'administración y recepción');
select pruebas.como('b4000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.cierre_caja), 0, 'otra clínica no ve el cierre');
select pruebas.igual((select (public.resumen_caja((now() at time zone 'America/Lima')::date) ->> 'pagos')::int), 0,
                     'el resumen es solo de la propia clínica');
reset role;
select pruebas.como(null);
\echo 'caja: todas las aserciones pasaron'
