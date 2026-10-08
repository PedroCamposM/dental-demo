-- Etapa 2 (v2): catálogo de procedimientos. Solo el admin lo mantiene; todo el
-- equipo lo consulta; ninguna clínica ve el de otra; no se borra.
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values
  ('e2000000-0000-0000-0000-00000000000a'), ('e2000000-0000-0000-0000-00000000000b'),
  ('e2000000-0000-0000-0000-00000000000c'), ('e2000000-0000-0000-0000-00000000000d'),
  ('f2000000-0000-0000-0000-00000000000a');
insert into public.clinica (id, nombre) values
  ('e2e2e2e2-0000-0000-0000-000000000000', 'Clínica E2'),
  ('f2f2f2f2-0000-0000-0000-000000000000', 'Clínica F2');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('e2000000-0000-0000-0000-00000000000a', 'e2e2e2e2-0000-0000-0000-000000000000', 'Admin E2',      'admin',      '5001'),
  ('e2000000-0000-0000-0000-00000000000b', 'e2e2e2e2-0000-0000-0000-000000000000', 'Odontólogo E2', 'odontologo', '5002'),
  ('e2000000-0000-0000-0000-00000000000c', 'e2e2e2e2-0000-0000-0000-000000000000', 'Asistente E2',  'asistente',  null),
  ('e2000000-0000-0000-0000-00000000000d', 'e2e2e2e2-0000-0000-0000-000000000000', 'Recepción E2',  'recepcion',  null),
  ('f2000000-0000-0000-0000-00000000000a', 'f2f2f2f2-0000-0000-0000-000000000000', 'Admin F2',      'admin',      '6001');

set role authenticated;

-- El admin crea procedimientos
select pruebas.como('e2000000-0000-0000-0000-00000000000a');
insert into public.procedimiento (id, clinica_id, codigo, nombre, especialidad, precio_base_centimos,
                                  duracion_minutos, requiere_consentimiento, control_dias)
values ('e2e2e2e2-0000-0000-0000-0000000000a1', 'e2e2e2e2-0000-0000-0000-000000000000', 'CIR-01',
        'Exodoncia simple', 'cirugia', 12000, 30, true, 7);

-- Validaciones del servidor (no solo del formulario)
select pruebas.debe_fallar($$insert into public.procedimiento (clinica_id, codigo, nombre, especialidad, precio_base_centimos, duracion_minutos)
  values ('e2e2e2e2-0000-0000-0000-000000000000', 'CIR-02', 'Precio negativo', 'cirugia', -1, 30)$$, 'check constraint');
select pruebas.debe_fallar($$insert into public.procedimiento (clinica_id, codigo, nombre, especialidad, precio_base_centimos, duracion_minutos)
  values ('e2e2e2e2-0000-0000-0000-000000000000', 'CIR-03', 'Duración rara', 'cirugia', 100, 7)$$, 'check constraint');
select pruebas.debe_fallar($$insert into public.procedimiento (clinica_id, codigo, nombre, especialidad, precio_base_centimos, duracion_minutos)
  values ('e2e2e2e2-0000-0000-0000-000000000000', 'cir 4', 'Código inválido', 'cirugia', 100, 30)$$, 'check constraint');
select pruebas.debe_fallar($$insert into public.procedimiento (clinica_id, codigo, nombre, especialidad, precio_base_centimos, duracion_minutos)
  values ('e2e2e2e2-0000-0000-0000-000000000000', 'CIR-01', 'Código repetido', 'cirugia', 100, 30)$$, 'duplicate key');
select pruebas.debe_fallar($$insert into public.procedimiento (clinica_id, codigo, nombre, especialidad, precio_base_centimos, duracion_minutos)
  values ('e2e2e2e2-0000-0000-0000-000000000000', 'CIR-05', '  exodoncia SIMPLE ', 'cirugia', 100, 30)$$, 'duplicate key');

-- El admin lo edita y lo desactiva; no se puede borrar
update public.procedimiento set precio_base_centimos = 13000, activo = false
 where id = 'e2e2e2e2-0000-0000-0000-0000000000a1';
select pruebas.igual((select count(*) from public.procedimiento
                      where id = 'e2e2e2e2-0000-0000-0000-0000000000a1' and precio_base_centimos = 13000 and not activo),
                     1, 'admin edita y desactiva');
select pruebas.debe_fallar($$delete from public.procedimiento where id = 'e2e2e2e2-0000-0000-0000-0000000000a1'$$,
                           'permission denied');
select pruebas.debe_fallar($$update public.procedimiento set clinica_id = 'f2f2f2f2-0000-0000-0000-000000000000'
                             where id = 'e2e2e2e2-0000-0000-0000-0000000000a1'$$, 'permission denied');

-- Queda registrado en la auditoría
reset role;
select pruebas.igual((select count(*) from public.auditoria
                      where tabla = 'procedimiento' and registro_id = 'e2e2e2e2-0000-0000-0000-0000000000a1'),
                     2, 'alta y edición auditadas');
set role authenticated;

-- Odontólogo, asistente y recepción lo ven, pero no lo crean ni lo editan
do $$
declare u uuid;
begin
  foreach u in array array['e2000000-0000-0000-0000-00000000000b', 'e2000000-0000-0000-0000-00000000000c',
                           'e2000000-0000-0000-0000-00000000000d']::uuid[] loop
    perform pruebas.como(u);
    perform pruebas.igual((select count(*) from public.procedimiento), 1, 'el equipo ve el catálogo');
    perform pruebas.debe_fallar($q$insert into public.procedimiento (clinica_id, codigo, nombre, especialidad, precio_base_centimos, duracion_minutos)
      values ('e2e2e2e2-0000-0000-0000-000000000000', 'X-01', 'No admin', 'general', 100, 30)$q$, 'row-level security');
    update public.procedimiento set precio_base_centimos = 1 where id = 'e2e2e2e2-0000-0000-0000-0000000000a1';
    perform pruebas.igual((select count(*) from public.procedimiento where precio_base_centimos = 1), 0,
                          'quien no es admin no cambia precios');
  end loop;
end $$;

-- El visitante sin sesión no tiene ningún permiso sobre la tabla
reset role;
set role anon;
select pruebas.debe_fallar('select 1 from public.procedimiento', 'permission denied');
reset role;
set role authenticated;

-- Otra clínica no lo ve ni puede escribir en esta
select pruebas.como('f2000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.procedimiento), 0, 'otra clínica no ve el catálogo');
select pruebas.debe_fallar($$insert into public.procedimiento (clinica_id, codigo, nombre, especialidad, precio_base_centimos, duracion_minutos)
  values ('e2e2e2e2-0000-0000-0000-000000000000', 'X-02', 'Intruso', 'general', 100, 30)$$, 'row-level security');

reset role;
select pruebas.como(null);
select 'catalogo: todas las aserciones pasaron' as resultado;
