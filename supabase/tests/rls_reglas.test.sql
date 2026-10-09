-- Pruebas de RLS, permisos y reglas de negocio en la base.
-- Se ejecutan con scripts/test-db.sh (Postgres efímero) y scripts/test-db-supabase.sh (Supabase local).
-- Cada aserción lanza una excepción si falla (ON_ERROR_STOP detiene todo).

\ir _ayudantes.sql

-- ---------------------------------------------------------------------------
-- Datos: dos clínicas. A: admin, odontólogo, recepción. B: admin.
-- ---------------------------------------------------------------------------
insert into auth.users (id) values
  ('a0000000-0000-0000-0000-00000000000a'), ('a0000000-0000-0000-0000-00000000000b'),
  ('a0000000-0000-0000-0000-00000000000c'), ('b0000000-0000-0000-0000-00000000000a');
insert into public.clinica (id, nombre) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Clínica A'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Clínica B');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('a0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'Admin A',      'admin',      '1001'),
  ('a0000000-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000000', 'Odontólogo A', 'odontologo', '1002'),
  ('a0000000-0000-0000-0000-00000000000c', 'aaaaaaaa-0000-0000-0000-000000000000', 'Recepción A',  'recepcion',  null),
  ('b0000000-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-000000000000', 'Admin B',      'admin',      '2001');
insert into public.paciente (id, clinica_id, dni, nombres, apellidos, telefono) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-000000000000', '40000001', 'Ana',  'Ficticia', '51900000001'),
  ('bbbbbbbb-0000-0000-0000-0000000000f1', 'bbbbbbbb-0000-0000-0000-000000000000', '40000002', 'Beto', 'Ficticio', '51900000002');

-- ---------------------------------------------------------------------------
-- anon: sin acceso a nada
-- ---------------------------------------------------------------------------
set role anon;
select pruebas.debe_fallar('select * from public.paciente', 'permission denied');
select pruebas.debe_fallar('select * from public.catalogo_hallazgo', 'permission denied');
select pruebas.debe_fallar('select * from public.v_item_cobro', 'permission denied');
reset role;

-- ---------------------------------------------------------------------------
-- Aislamiento entre clínicas (recepción A)
-- ---------------------------------------------------------------------------
set role authenticated;
select pruebas.como('a0000000-0000-0000-0000-00000000000c');
select pruebas.igual((select count(*) from public.paciente), 1, 'recepción A ve solo sus pacientes');
select pruebas.igual((select count(*) from public.clinica), 1, 'recepción A ve solo su clínica');
select pruebas.igual((select count(*) from public.usuario), 3, 'recepción A ve solo su equipo');
select pruebas.debe_fallar($$insert into public.paciente (clinica_id, nombres, apellidos)
  values ('bbbbbbbb-0000-0000-0000-000000000000', 'X', 'Y')$$, 'row-level security');
select pruebas.debe_fallar($$update public.paciente set clinica_id = 'bbbbbbbb-0000-0000-0000-000000000000'$$,
  'row-level security');
select pruebas.debe_fallar('delete from public.paciente', 'permission denied');
select pruebas.igual((select count(*) from public.catalogo_hallazgo), 38, 'catálogo NTS 188 completo');

-- Recepción no ve datos clínicos ni la auditoría; no edita usuarios
select pruebas.igual((select count(*) from public.odontograma), 0, 'recepción no ve odontogramas');
select pruebas.igual((select count(*) from public.auditoria), 0, 'recepción no ve auditoría');
select pruebas.debe_fallar($$insert into public.odontograma (clinica_id, paciente_id, tipo, odontologo_id)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'inicial',
          'a0000000-0000-0000-0000-00000000000c')$$, 'row-level security');
update public.usuario set nombre = 'hackeado';   -- RLS: 0 filas, sin error
reset role;
select pruebas.igual((select count(*) from public.usuario where nombre = 'hackeado'), 0, 'recepción no edita usuarios');

-- Clínica B no ve nada de A
set role authenticated;
select pruebas.como('b0000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.paciente
                      where clinica_id = 'aaaaaaaa-0000-0000-0000-000000000000'), 0, 'B no ve pacientes de A');
reset role;

-- ---------------------------------------------------------------------------
-- Odontograma NTS 188 (odontólogo A)
-- ---------------------------------------------------------------------------
set role authenticated;
select pruebas.como('a0000000-0000-0000-0000-00000000000b');
insert into public.odontograma (id, clinica_id, paciente_id, tipo, odontologo_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-000000000000',
   'aaaaaaaa-0000-0000-0000-0000000000f1', 'inicial', 'a0000000-0000-0000-0000-00000000000b');

-- Válidos
insert into public.odontograma_hallazgo (clinica_id, odontograma_id, hallazgo_codigo, pieza, superficies, siglas, cie10)
values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'caries', 16,
        '{oclusal,mesial}', '{CD}', 'K02.1');
insert into public.odontograma_hallazgo (clinica_id, odontograma_id, hallazgo_codigo, pieza, siglas, estado)
values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'corona', 26, '{CM}', 'bueno');
insert into public.odontograma_hallazgo (clinica_id, odontograma_id, hallazgo_codigo, pieza, pieza_hasta, estado)
values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'protesis_parcial_fija', 34, 36, 'malo');
select pruebas.igual((select count(*) from public.v_hallazgo where color = 'rojo'), 2, 'caries y prótesis mala en rojo');
select pruebas.igual((select count(*) from public.v_hallazgo where color = 'azul'), 1, 'corona buena en azul');

-- Inválidos
select pruebas.debe_fallar($$insert into public.odontograma_hallazgo (clinica_id, odontograma_id, hallazgo_codigo, pieza, superficies, siglas)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'caries', 16, '{oclusal}', '{XX}')$$,
  'siglas permitidas');
select pruebas.debe_fallar($$insert into public.odontograma_hallazgo (clinica_id, odontograma_id, hallazgo_codigo, pieza, superficies, siglas)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'caries', 16, '{oclusal}', '{}')$$,
  'falta la sigla');
select pruebas.debe_fallar($$insert into public.odontograma_hallazgo (clinica_id, odontograma_id, hallazgo_codigo, pieza, siglas)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'corona', 26, '{CM}')$$,
  'buen o mal estado');
select pruebas.debe_fallar($$insert into public.odontograma_hallazgo (clinica_id, odontograma_id, hallazgo_codigo, pieza, siglas, estado)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'corona_temporal', 26, '{CT}', 'bueno')$$,
  'color fijo');
select pruebas.debe_fallar($$insert into public.odontograma_hallazgo (clinica_id, odontograma_id, hallazgo_codigo, pieza)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'fractura', 19)$$,
  'check constraint');   -- 19 no es pieza FDI
select pruebas.debe_fallar($$insert into public.odontograma_hallazgo (clinica_id, odontograma_id, hallazgo_codigo, pieza, pieza_hasta, estado)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'protesis_parcial_fija', 14, 44, 'bueno')$$,
  'misma arcada');

-- Inalterable: no se edita, solo se anula una vez
select pruebas.debe_fallar($$update public.odontograma_hallazgo set pieza = 17$$, 'permission denied');
select pruebas.debe_fallar('delete from public.odontograma_hallazgo', 'permission denied');
update public.odontograma_hallazgo set anulado_at = now(), anulado_por = auth.uid(), motivo_anulacion = 'Error de registro'
  where hallazgo_codigo = 'corona';
select pruebas.debe_fallar($$update public.odontograma_hallazgo set anulado_at = now(), anulado_por = auth.uid(),
  motivo_anulacion = 'otra vez' where hallazgo_codigo = 'corona'$$, 'ya está anulado');
reset role;
select pruebas.igual((select count(*) from public.auditoria where tabla = 'odontograma_hallazgo' and accion = 'anular'), 1,
  'anulación auditada');

-- ---------------------------------------------------------------------------
-- Plan, ítems y regla 1 (realizado => nota de evolución)
-- ---------------------------------------------------------------------------
set role authenticated;
select pruebas.como('a0000000-0000-0000-0000-00000000000b');
insert into public.plan_tratamiento (id, clinica_id, paciente_id, odontologo_id, titulo) values
  ('aaaaaaaa-0000-0000-0000-0000000000e1', 'aaaaaaaa-0000-0000-0000-000000000000',
   'aaaaaaaa-0000-0000-0000-0000000000f1', 'a0000000-0000-0000-0000-00000000000b', 'Rehabilitación');
insert into public.item_plan (id, clinica_id, plan_id, pieza, procedimiento, precio_centimos, odontologo_id, estado) values
  ('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000e1',
   16, 'Resina', 15000, 'a0000000-0000-0000-0000-00000000000b', 'aceptado'),
  ('aaaaaaaa-0000-0000-0000-0000000000c2', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000e1',
   36, 'Corona', 80000, 'a0000000-0000-0000-0000-00000000000b', 'aceptado');

select pruebas.debe_fallar($$update public.item_plan set estado = 'realizado', realizado_at = now()
  where id = 'aaaaaaaa-0000-0000-0000-0000000000c1'$$, 'evolución firmada');
insert into public.nota_evolucion (id, clinica_id, paciente_id, odontologo_id, texto, cie10) values
  ('aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-000000000000',
   'aaaaaaaa-0000-0000-0000-0000000000f1', 'a0000000-0000-0000-0000-00000000000b', 'Resina oclusal 1.6', 'K02.1');
-- v2 (Etapa 6, cambio intencional): la nota nace en borrador; realizado exige firmarla.
select pruebas.debe_fallar($$update public.item_plan set estado = 'realizado', realizado_at = now(),
  nota_evolucion_id = 'aaaaaaaa-0000-0000-0000-0000000000b1' where id = 'aaaaaaaa-0000-0000-0000-0000000000c1'$$,
  'evolución firmada');
insert into public.evolucion_item (clinica_id, nota_id, item_id, terminado) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000c1', true);
reset role;

-- Recepción no puede marcar realizado (aunque haya nota)
set role authenticated;
select pruebas.como('a0000000-0000-0000-0000-00000000000c');
select pruebas.debe_fallar($$update public.item_plan set estado = 'realizado', realizado_at = now(),
  nota_evolucion_id = 'aaaaaaaa-0000-0000-0000-0000000000b1' where id = 'aaaaaaaa-0000-0000-0000-0000000000c1'$$,
  'cirujano dentista');

-- El dentista firma la evolución: el ítem terminado en esa sesión queda realizado.
select pruebas.como('a0000000-0000-0000-0000-00000000000b');
select public.firmar_evolucion('aaaaaaaa-0000-0000-0000-0000000000b1');
select pruebas.igual((select count(*) from public.item_plan where id = 'aaaaaaaa-0000-0000-0000-0000000000c1'
                        and estado = 'realizado' and nota_evolucion_id = 'aaaaaaaa-0000-0000-0000-0000000000b1'), 1,
                     'realizado al firmar');
select pruebas.debe_fallar($$update public.item_plan set estado = 'aceptado'
  where id = 'aaaaaaaa-0000-0000-0000-0000000000c1'$$, 'no puede cambiar de estado');
reset role;

-- ---------------------------------------------------------------------------
-- Pagos: solo admin y recepción; sin sobreaplicar; inalterables
-- ---------------------------------------------------------------------------
set role authenticated;
select pruebas.como('a0000000-0000-0000-0000-00000000000b');
select pruebas.debe_fallar($$insert into public.pago (clinica_id, plan_id, monto_centimos, metodo, registrado_por)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000e1', 1000, 'yape',
          'a0000000-0000-0000-0000-00000000000b')$$, 'row-level security');

select pruebas.como('a0000000-0000-0000-0000-00000000000c');
-- Pago mixto: 500 en Yape + 300 en efectivo para la corona (aún no realizada: adelanto)
insert into public.pago (id, clinica_id, plan_id, monto_centimos, metodo, registrado_por) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000e1',
   50000, 'yape', 'a0000000-0000-0000-0000-00000000000c'),
  ('aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000e1',
   30000, 'efectivo', 'a0000000-0000-0000-0000-00000000000c');
insert into public.pago_aplicacion (clinica_id, pago_id, item_plan_id, monto_centimos) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000c2', 50000);
select pruebas.igual((select count(*) from public.v_item_cobro where estado_cobro = 'parcial'), 1, 'corona parcial');
select pruebas.debe_fallar($$insert into public.pago_aplicacion (clinica_id, pago_id, item_plan_id, monto_centimos) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000c1', 1)$$,
  'excede el monto del pago');
insert into public.pago_aplicacion (clinica_id, pago_id, item_plan_id, monto_centimos) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-0000000000c2', 30000);
select pruebas.igual((select saldo_centimos from public.v_item_cobro
                      where item_plan_id = 'aaaaaaaa-0000-0000-0000-0000000000c2'), 0, 'corona cobrada');
select pruebas.igual((select count(*) from public.v_item_cobro where estado_cobro = 'cobrado' and estado <> 'realizado'), 1,
  'cobrado sin estar realizado (adelanto)');
select pruebas.debe_fallar($$update public.item_plan set precio_centimos = 70000
  where id = 'aaaaaaaa-0000-0000-0000-0000000000c2'$$, 'menor a lo ya cobrado');

select pruebas.debe_fallar($$update public.pago set monto_centimos = 1 where id = 'aaaaaaaa-0000-0000-0000-0000000000a2'$$,
  'permission denied');
select pruebas.debe_fallar('delete from public.pago', 'permission denied');
-- Anular el pago en efectivo libera ese saldo
update public.pago set anulado_at = now(), anulado_por = auth.uid(), motivo_anulacion = 'Monto equivocado'
  where id = 'aaaaaaaa-0000-0000-0000-0000000000a2';
select pruebas.igual((select saldo_centimos from public.v_item_cobro
                      where item_plan_id = 'aaaaaaaa-0000-0000-0000-0000000000c2'), 30000, 'pago anulado no cuenta');
select pruebas.debe_fallar($$insert into public.pago_aplicacion (clinica_id, pago_id, item_plan_id, monto_centimos) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-0000000000c2', 1)$$,
  'El pago está anulado');
reset role;

-- ---------------------------------------------------------------------------
-- Regla 4 (detenido) y regla 3 (control al terminar)
-- ---------------------------------------------------------------------------
select pruebas.como(null);   -- preparación como sistema, sin usuario
update public.plan_tratamiento set estado = 'en_curso' where id = 'aaaaaaaa-0000-0000-0000-0000000000e1';
set role authenticated;
select pruebas.como('a0000000-0000-0000-0000-00000000000a');
select pruebas.igual((select valor_pendiente_centimos from public.v_plan_detenido), 80000, 'plan detenido: corona pendiente');
-- Cita cargada como dato de preparación (sin horarios en esta clínica de prueba;
-- desde la Etapa 2 la app no deja citar fuera de horario: ver agenda.test.sql).
reset role;
insert into public.cita (id, clinica_id, paciente_id, odontologo_id, inicio, fin) values
  ('aaaaaaaa-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1',
   'a0000000-0000-0000-0000-00000000000b', now() + interval '7 days', now() + interval '7 days 1 hour');
set role authenticated;
insert into public.cita_item (clinica_id, cita_id, item_plan_id) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-0000000000c2');
select pruebas.igual((select count(*) from public.v_plan_detenido), 0, 'con cita en 30 días ya no está detenido');

update public.plan_tratamiento set estado = 'terminado' where id = 'aaaaaaaa-0000-0000-0000-0000000000e1';
select pruebas.igual((select count(*) from public.seguimiento where tipo = 'control'
                        and fecha_programada = ((now() at time zone 'America/Lima')::date + interval '6 months')::date),
  1, 'control a 6 meses creado al terminar');
select pruebas.debe_fallar($$update public.plan_tratamiento set estado = 'rechazado'$$, 'plan_rechazo_con_motivo');

-- Siempre queda un admin activo
select pruebas.debe_fallar($$update public.usuario set activo = false where id = 'a0000000-0000-0000-0000-00000000000a'$$,
  'al menos un administrador');
select pruebas.debe_fallar($$insert into public.usuario (id, clinica_id, nombre, rol)
  values ('a0000000-0000-0000-0000-00000000000c', 'aaaaaaaa-0000-0000-0000-000000000000', 'X', 'recepcion')$$,
  'permission denied');
select pruebas.igual((select (count(*) > 0)::int from public.auditoria), 1, 'admin lee la auditoría');
reset role;

select pruebas.debe_fallar($$insert into public.usuario (id, clinica_id, nombre, rol)
  values ('a0000000-0000-0000-0000-00000000000c', 'bbbbbbbb-0000-0000-0000-000000000000', 'Sin COP', 'odontologo')$$,
  'odontologo_con_cop');

\echo 'rls_reglas: todas las aserciones pasaron'
