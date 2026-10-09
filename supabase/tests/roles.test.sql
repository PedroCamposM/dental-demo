-- Etapa 1 (v2): permisos por rol (admin, odontólogo, asistente, recepción y admin
-- sin COP), filiación del paciente y regla 8 (RLS + clinica_id en toda tabla).
\ir _ayudantes.sql

-- El propio ayudante detecta cuando algo NO falla (antes no lo hacía).
do $$
begin
  perform pruebas.debe_fallar('select 1', 'cualquier cosa');
  raise exception 'debe_fallar no detectó un SQL que no falla';
exception when others then
  if sqlerrm not like 'Se esperaba un error%' then raise; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Datos: clínica C con los cinco perfiles; clínica D con un admin.
-- ---------------------------------------------------------------------------
select pruebas.como(null);
insert into auth.users (id) values
  ('c1000000-0000-0000-0000-00000000000a'), ('c1000000-0000-0000-0000-00000000000b'),
  ('c1000000-0000-0000-0000-00000000000c'), ('c1000000-0000-0000-0000-00000000000d'),
  ('c1000000-0000-0000-0000-00000000000e'), ('d1000000-0000-0000-0000-00000000000a');
insert into public.clinica (id, nombre) values
  ('cccccccc-0000-0000-0000-000000000000', 'Clínica C'),
  ('dddddddd-0000-0000-0000-000000000000', 'Clínica D');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('c1000000-0000-0000-0000-00000000000a', 'cccccccc-0000-0000-0000-000000000000', 'Admin C',          'admin',      '3001'),
  ('c1000000-0000-0000-0000-00000000000b', 'cccccccc-0000-0000-0000-000000000000', 'Odontóloga C',     'odontologo', '3002'),
  ('c1000000-0000-0000-0000-00000000000c', 'cccccccc-0000-0000-0000-000000000000', 'Asistente C',      'asistente',  null),
  ('c1000000-0000-0000-0000-00000000000d', 'cccccccc-0000-0000-0000-000000000000', 'Recepción C',      'recepcion',  null),
  ('c1000000-0000-0000-0000-00000000000e', 'cccccccc-0000-0000-0000-000000000000', 'Gerente sin COP',  'admin',      null),
  ('d1000000-0000-0000-0000-00000000000a', 'dddddddd-0000-0000-0000-000000000000', 'Admin D',          'admin',      '4001');

-- ---------------------------------------------------------------------------
-- Filiación: documento, sincronía con dni y apoderado de menores
-- ---------------------------------------------------------------------------
set role authenticated;
select pruebas.como('c1000000-0000-0000-0000-00000000000d');   -- recepción registra pacientes
insert into public.paciente (id, clinica_id, tipo_documento, numero_documento, nombres, apellidos, telefono,
                             fecha_nacimiento, sexo, ocupacion, direccion,
                             contacto_emergencia_nombre, contacto_emergencia_telefono, contacto_emergencia_parentesco)
values ('cccccccc-0000-0000-0000-0000000000f1', 'cccccccc-0000-0000-0000-000000000000', 'dni', '41000001',
        'Carla', 'Prueba Uno', '51900000011', '1985-03-02', 'femenino', 'Docente', 'Av. España 123, Trujillo',
        'Luis Prueba', '51900000012', 'esposo');
select pruebas.igual((select count(*) from public.paciente where dni = '41000001'), 1, 'dni sincronizado con el documento');

-- Código anterior que solo escribe dni: se completa el documento.
insert into public.paciente (id, clinica_id, dni, nombres, apellidos)
values ('cccccccc-0000-0000-0000-0000000000f2', 'cccccccc-0000-0000-0000-000000000000', '41000002', 'Mario', 'Prueba Dos');
select pruebas.igual((select count(*) from public.paciente
                      where id = 'cccccccc-0000-0000-0000-0000000000f2' and tipo_documento = 'dni'
                        and numero_documento = '41000002'), 1, 'documento completado desde dni');

-- CE en minúsculas se normaliza; el pasaporte no tiene dni.
insert into public.paciente (id, clinica_id, tipo_documento, numero_documento, nombres, apellidos)
values ('cccccccc-0000-0000-0000-0000000000f3', 'cccccccc-0000-0000-0000-000000000000', 'ce', ' 00123456a ', 'Ana', 'Extranjera');
select pruebas.igual((select count(*) from public.paciente
                      where id = 'cccccccc-0000-0000-0000-0000000000f3' and numero_documento = '00123456A' and dni is null),
                     1, 'CE normalizado y sin dni');

select pruebas.debe_fallar($$insert into public.paciente (clinica_id, tipo_documento, numero_documento, nombres, apellidos)
  values ('cccccccc-0000-0000-0000-000000000000', 'dni', '4100001', 'X', 'Y')$$, 'check constraint');
select pruebas.debe_fallar($$insert into public.paciente (clinica_id, tipo_documento, numero_documento, nombres, apellidos)
  values ('cccccccc-0000-0000-0000-000000000000', 'pasaporte', 'AB-123', 'X', 'Y')$$, 'paciente_documento_formato');
select pruebas.debe_fallar($$insert into public.paciente (clinica_id, tipo_documento, numero_documento, nombres, apellidos)
  values ('cccccccc-0000-0000-0000-000000000000', 'dni', '41000001', 'Otra', 'Persona')$$, 'duplicate key');
-- Mismo número con otro tipo de documento sí se permite.
insert into public.paciente (clinica_id, tipo_documento, numero_documento, nombres, apellidos)
values ('cccccccc-0000-0000-0000-000000000000', 'pasaporte', '41000001', 'Homónimo', 'Pasaporte');

select pruebas.debe_fallar($$insert into public.paciente (clinica_id, numero_documento, nombres, apellidos, fecha_nacimiento)
  values ('cccccccc-0000-0000-0000-000000000000', '71000001', 'Niño', 'Sin Apoderado', current_date - interval '8 years')$$,
  'apoderado');
insert into public.paciente (id, clinica_id, numero_documento, nombres, apellidos, fecha_nacimiento,
                             apoderado_nombre, apoderado_dni, apoderado_telefono, apoderado_parentesco)
values ('cccccccc-0000-0000-0000-0000000000f4', 'cccccccc-0000-0000-0000-000000000000', '71000001', 'Niña', 'Con Apoderado',
        current_date - interval '8 years', 'Rosa Apoderada', '10000001', '51900000013', 'madre');
select pruebas.debe_fallar($$update public.paciente set apoderado_telefono = null
  where id = 'cccccccc-0000-0000-0000-0000000000f4'$$, 'apoderado');

-- Anular un paciente: solo admin.
select pruebas.debe_fallar($$update public.paciente set anulado_at = now(), motivo_anulacion = 'x'
  where id = 'cccccccc-0000-0000-0000-0000000000f2'$$, 'Solo el administrador');
select pruebas.como('c1000000-0000-0000-0000-00000000000a');
update public.paciente set anulado_at = now(), anulado_por = auth.uid(), motivo_anulacion = 'Registro de prueba'
  where id = 'cccccccc-0000-0000-0000-0000000000f2';
reset role;

-- ---------------------------------------------------------------------------
-- Registros clínicos: los crea el cirujano dentista; asistente los ve; recepción no.
-- ---------------------------------------------------------------------------
set role authenticated;
select pruebas.como('c1000000-0000-0000-0000-00000000000b');
insert into public.odontograma (id, clinica_id, paciente_id, tipo, odontologo_id) values
  ('cccccccc-0000-0000-0000-0000000000d1', 'cccccccc-0000-0000-0000-000000000000',
   'cccccccc-0000-0000-0000-0000000000f1', 'inicial', 'c1000000-0000-0000-0000-00000000000b');
insert into public.nota_evolucion (id, clinica_id, paciente_id, odontologo_id, texto) values
  ('cccccccc-0000-0000-0000-0000000000b1', 'cccccccc-0000-0000-0000-000000000000',
   'cccccccc-0000-0000-0000-0000000000f1', 'c1000000-0000-0000-0000-00000000000b', 'Evaluación inicial');

select pruebas.como('c1000000-0000-0000-0000-00000000000c');   -- asistente
select pruebas.igual((select count(*) from public.odontograma), 1, 'asistente ve el odontograma');
select pruebas.igual((select count(*) from public.nota_evolucion), 1, 'asistente ve las notas');
select pruebas.debe_fallar($$insert into public.nota_evolucion (clinica_id, paciente_id, odontologo_id, texto)
  values ('cccccccc-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-0000000000f1',
          'c1000000-0000-0000-0000-00000000000c', 'Nota de asistente')$$, 'row-level security');
select pruebas.debe_fallar($$insert into public.odontograma (clinica_id, paciente_id, tipo, odontologo_id)
  values ('cccccccc-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-0000000000f1', 'inicial',
          'c1000000-0000-0000-0000-00000000000c')$$, 'row-level security');
select pruebas.igual((select count(*) from public.auditoria), 0, 'asistente no ve la auditoría');

select pruebas.como('c1000000-0000-0000-0000-00000000000d');   -- recepción
select pruebas.igual((select count(*) from public.odontograma), 0, 'recepción no ve odontogramas');
select pruebas.igual((select count(*) from public.nota_evolucion), 0, 'recepción no ve notas');

select pruebas.como('c1000000-0000-0000-0000-00000000000e');   -- admin sin COP
select pruebas.igual((select count(*) from public.nota_evolucion), 0, 'admin sin COP no ve notas');
select pruebas.igual((select count(*) from public.auditoria where tabla in ('nota_evolucion', 'odontograma')), 0,
                     'admin sin COP tampoco ve el contenido clínico a través de la auditoría');
select pruebas.igual((select (count(*) > 0)::int from public.auditoria where tabla = 'paciente'), 1,
                     'admin sin COP sí ve la auditoría no clínica');
select pruebas.como('c1000000-0000-0000-0000-00000000000a');   -- admin con COP
select pruebas.igual((select count(*) from public.auditoria where tabla = 'nota_evolucion'), 1,
                     'admin con COP ve la auditoría clínica');
reset role;

-- ---------------------------------------------------------------------------
-- Planes e ítems por rol
-- ---------------------------------------------------------------------------
set role authenticated;
select pruebas.como('c1000000-0000-0000-0000-00000000000c');   -- asistente
select pruebas.debe_fallar($$insert into public.plan_tratamiento (clinica_id, paciente_id, odontologo_id, titulo)
  values ('cccccccc-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-0000000000f1',
          'c1000000-0000-0000-0000-00000000000b', 'Plan de asistente')$$, 'row-level security');
select pruebas.como('c1000000-0000-0000-0000-00000000000d');   -- recepción
select pruebas.debe_fallar($$insert into public.plan_tratamiento (clinica_id, paciente_id, odontologo_id, titulo)
  values ('cccccccc-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-0000000000f1',
          'c1000000-0000-0000-0000-00000000000b', 'Plan de recepción')$$, 'row-level security');

select pruebas.como('c1000000-0000-0000-0000-00000000000b');   -- odontóloga crea el plan
insert into public.plan_tratamiento (id, clinica_id, paciente_id, odontologo_id, titulo) values
  ('cccccccc-0000-0000-0000-0000000000e1', 'cccccccc-0000-0000-0000-000000000000',
   'cccccccc-0000-0000-0000-0000000000f1', 'c1000000-0000-0000-0000-00000000000b', 'Operatoria');
insert into public.item_plan (id, clinica_id, plan_id, pieza, procedimiento, cie10, precio_centimos, odontologo_id) values
  ('cccccccc-0000-0000-0000-0000000000c1', 'cccccccc-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-0000000000e1',
   16, 'Resina', 'K02.1', 18000, 'c1000000-0000-0000-0000-00000000000b');

select pruebas.como('c1000000-0000-0000-0000-00000000000d');   -- recepción
select pruebas.igual((select count(*) from public.item_plan where cie10 = 'K02.1'), 1, 'recepción ve procedimiento y CIE-10');
select pruebas.debe_fallar($$update public.item_plan set precio_centimos = 1000
  where id = 'cccccccc-0000-0000-0000-0000000000c1'$$, 'Solo un cirujano dentista');
select pruebas.debe_fallar($$update public.item_plan set estado = 'aceptado', cie10 = 'K02.0'
  where id = 'cccccccc-0000-0000-0000-0000000000c1'$$, 'Solo un cirujano dentista');
select pruebas.debe_fallar($$update public.plan_tratamiento set titulo = 'Otro'
  where id = 'cccccccc-0000-0000-0000-0000000000e1'$$, 'Solo un cirujano dentista');
select pruebas.debe_fallar($$update public.item_plan set estado = 'realizado'
  where id = 'cccccccc-0000-0000-0000-0000000000c1'$$, 'cirujano dentista');
-- El paciente acepta en recepción
update public.plan_tratamiento set estado = 'aceptado', aceptado_at = now()
  where id = 'cccccccc-0000-0000-0000-0000000000e1';
select pruebas.debe_fallar($$update public.plan_tratamiento set estado = 'terminado'
  where id = 'cccccccc-0000-0000-0000-0000000000e1'$$, 'acepta o rechaza');
select pruebas.debe_fallar($$update public.plan_tratamiento set terminado_at = now()
  where id = 'cccccccc-0000-0000-0000-0000000000e1'$$, 'Solo un cirujano dentista');
-- Recepción registra que el paciente acepta el ítem propuesto y luego lo programa
update public.item_plan set estado = 'aceptado' where id = 'cccccccc-0000-0000-0000-0000000000c1';
update public.item_plan set estado = 'programado' where id = 'cccccccc-0000-0000-0000-0000000000c1';
select pruebas.debe_fallar($$update public.item_plan set estado = 'cancelado', motivo_cancelacion = 'x'
  where id = 'cccccccc-0000-0000-0000-0000000000c1'$$, 'aceptar o cancelar ítems propuestos');
select pruebas.igual((select count(*) from public.item_plan where estado = 'programado'), 1, 'recepción programa un ítem');

select pruebas.como('c1000000-0000-0000-0000-00000000000e');   -- admin sin COP: como recepción en lo clínico
select pruebas.debe_fallar($$update public.item_plan set precio_centimos = 1000
  where id = 'cccccccc-0000-0000-0000-0000000000c1'$$, 'Solo un cirujano dentista');

select pruebas.como('c1000000-0000-0000-0000-00000000000c');   -- asistente: RLS no le deja tocar filas
update public.item_plan set estado = 'aceptado' where id = 'cccccccc-0000-0000-0000-0000000000c1';
reset role;
select pruebas.igual((select count(*) from public.item_plan
                      where id = 'cccccccc-0000-0000-0000-0000000000c1' and estado = 'programado'), 1,
                     'asistente no modifica ítems');

-- Odontóloga ajusta el precio (cirujano dentista sí puede)
set role authenticated;
select pruebas.como('c1000000-0000-0000-0000-00000000000b');
update public.item_plan set precio_centimos = 20000 where id = 'cccccccc-0000-0000-0000-0000000000c1';
select pruebas.igual((select precio_centimos from public.item_plan where id = 'cccccccc-0000-0000-0000-0000000000c1'),
                     20000, 'odontóloga ajusta el precio');

-- ---------------------------------------------------------------------------
-- Cuotas y plantillas: admin y recepción
-- ---------------------------------------------------------------------------
select pruebas.debe_fallar($$insert into public.cuota (clinica_id, plan_id, numero, monto_centimos, vence_el)
  values ('cccccccc-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-0000000000e1', 1, 10000, current_date)$$,
  'row-level security');
select pruebas.como('c1000000-0000-0000-0000-00000000000d');
insert into public.cuota (clinica_id, plan_id, numero, monto_centimos, vence_el)
values ('cccccccc-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-0000000000e1', 1, 10000, current_date);
insert into public.plantilla_mensaje (id, clinica_id, tipo, nombre, cuerpo) values
  ('cccccccc-0000-0000-0000-0000000000a1', 'cccccccc-0000-0000-0000-000000000000', 'control', 'Control', 'Hola {{nombre}}');
select pruebas.como('c1000000-0000-0000-0000-00000000000b');
update public.plantilla_mensaje set cuerpo = 'Cambiado por odontóloga';
select pruebas.como('c1000000-0000-0000-0000-00000000000c');
update public.plantilla_mensaje set cuerpo = 'Cambiado por asistente';
reset role;
select pruebas.igual((select count(*) from public.plantilla_mensaje
                      where id = 'cccccccc-0000-0000-0000-0000000000a1' and cuerpo = 'Hola {{nombre}}'), 1,
                     'odontóloga y asistente no editan plantillas');

-- ---------------------------------------------------------------------------
-- Aislamiento: ningún rol de C ve datos de D, y D no ve nada de C
-- ---------------------------------------------------------------------------
select pruebas.como(null);
insert into public.paciente (clinica_id, numero_documento, nombres, apellidos)
values ('dddddddd-0000-0000-0000-000000000000', '42000001', 'Paciente', 'De D');
set role authenticated;
select pruebas.como('c1000000-0000-0000-0000-00000000000c');
select pruebas.igual((select count(*) from public.paciente where clinica_id <> 'cccccccc-0000-0000-0000-000000000000'), 0,
                     'asistente de C no ve pacientes de D');
select pruebas.como('d1000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.paciente where clinica_id = 'cccccccc-0000-0000-0000-000000000000'), 0,
                     'D no ve pacientes de C');
select pruebas.igual((select count(*) from public.odontograma), 0, 'D no ve odontogramas de C');
select pruebas.debe_fallar($$insert into public.paciente (clinica_id, nombres, apellidos)
  values ('cccccccc-0000-0000-0000-000000000000', 'Intruso', 'D')$$, 'row-level security');
reset role;
select pruebas.como(null);

-- ---------------------------------------------------------------------------
-- Regla 8: toda tabla de public tiene RLS y clinica_id (excepto el tenant y el
-- catálogos globales NTS 188 y CIE-10), anon no tiene permisos y nadie puede borrar datos.
-- ---------------------------------------------------------------------------
select pruebas.igual((
  select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 0, 'tablas sin RLS');
select pruebas.igual((
  select count(*) from information_schema.tables t
  where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
    and t.table_name not in ('clinica', 'catalogo_hallazgo', 'catalogo_cie10')
    and not exists (select 1 from information_schema.columns k
                    where k.table_schema = 'public' and k.table_name = t.table_name and k.column_name = 'clinica_id')),
  0, 'tablas sin clinica_id');
select pruebas.igual((
  select count(*) from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon'), 0, 'permisos para anon');
select pruebas.igual((
  select count(*) from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'authenticated' and privilege_type in ('DELETE', 'TRUNCATE')
    and table_name <> 'cita_item'), 0, 'permisos de borrado (solo cita_item puede)');

\echo 'roles: todas las aserciones pasaron'
