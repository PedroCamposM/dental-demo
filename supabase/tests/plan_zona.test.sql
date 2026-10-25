-- Etapa 21 (v2): plan por zona (pedido del odontólogo piloto). Profilaxis y destartraje por
-- cuadrante, arcada o boca completa: un solo ítem sin pieza; la zona se copia a las versiones.
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values
  ('ed000000-0000-0000-0000-00000000000a'), ('ed000000-0000-0000-0000-00000000000b'), ('ed000000-0000-0000-0000-00000000000d');
insert into public.clinica (id, nombre) values ('edededed-0000-0000-0000-000000000000', 'Clínica Zona');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('ed000000-0000-0000-0000-00000000000a', 'edededed-0000-0000-0000-000000000000', 'Admin Z', 'admin', '9831'),
  ('ed000000-0000-0000-0000-00000000000b', 'edededed-0000-0000-0000-000000000000', 'Odontólogo Z', 'odontologo', '9832'),
  ('ed000000-0000-0000-0000-00000000000d', 'edededed-0000-0000-0000-000000000000', 'Recepción Z', 'recepcion', null);
insert into public.paciente (id, clinica_id, dni, nombres, apellidos, fecha_nacimiento) values
  ('edededed-0000-0000-0000-0000000000f1', 'edededed-0000-0000-0000-000000000000', '50000901', 'Zona', 'Paciente', '1980-01-01');
insert into public.procedimiento (id, clinica_id, codigo, nombre, especialidad, precio_base_centimos, duracion_minutos) values
  ('edededed-0000-0000-0000-0000000000c1', 'edededed-0000-0000-0000-000000000000', 'PRV-02', 'Destartraje', 'preventiva', 6000, 30);

set role authenticated;
-- El admin define cómo se cotiza; la recepción no
select pruebas.como('ed000000-0000-0000-0000-00000000000a');
update public.procedimiento set cobro_por = 'arcada' where id = 'edededed-0000-0000-0000-0000000000c1';
select pruebas.igual((select count(*) from public.procedimiento where cobro_por = 'arcada'
                        and id = 'edededed-0000-0000-0000-0000000000c1'), 1, 'cobro por arcada');
select pruebas.debe_fallar($$update public.procedimiento set cobro_por = 'diente' where id = 'edededed-0000-0000-0000-0000000000c1'$$,
                           'check constraint');

-- El odontólogo planifica un destartraje de ambas arcadas: un ítem, sin pieza
select pruebas.como('ed000000-0000-0000-0000-00000000000b');
insert into public.plan_tratamiento (id, clinica_id, paciente_id, odontologo_id, titulo)
values ('edededed-0000-0000-0000-0000000000a1', 'edededed-0000-0000-0000-000000000000', 'edededed-0000-0000-0000-0000000000f1',
        'ed000000-0000-0000-0000-00000000000b', 'Higiene');
insert into public.plan_fase (clinica_id, plan_id, numero, nombre)
values ('edededed-0000-0000-0000-000000000000', 'edededed-0000-0000-0000-0000000000a1', 1, 'Higiene');
insert into public.item_plan (clinica_id, plan_id, odontologo_id, procedimiento_id, procedimiento, precio_centimos, zona, fase, orden)
values ('edededed-0000-0000-0000-000000000000', 'edededed-0000-0000-0000-0000000000a1', 'ed000000-0000-0000-0000-00000000000b',
        'edededed-0000-0000-0000-0000000000c1', 'Destartraje', 12000, 'boca', 1, 1);
select pruebas.debe_fallar($$insert into public.item_plan (clinica_id, plan_id, odontologo_id, procedimiento, precio_centimos, zona, pieza, fase, orden)
  values ('edededed-0000-0000-0000-000000000000', 'edededed-0000-0000-0000-0000000000a1', 'ed000000-0000-0000-0000-00000000000b',
          'Destartraje', 6000, 'arcada_superior', 16, 1, 2)$$, 'item_zona_sin_pieza');
select pruebas.debe_fallar($$insert into public.item_plan (clinica_id, plan_id, odontologo_id, procedimiento, precio_centimos, zona, fase, orden)
  values ('edededed-0000-0000-0000-000000000000', 'edededed-0000-0000-0000-0000000000a1', 'ed000000-0000-0000-0000-00000000000b',
          'Destartraje', 6000, 'media_boca', 1, 2)$$, 'check constraint');
-- La recepción no cambia la zona (es contenido clínico del plan)
select pruebas.como('ed000000-0000-0000-0000-00000000000d');
select pruebas.debe_fallar($$update public.item_plan set zona = 'arcada_superior' where plan_id = 'edededed-0000-0000-0000-0000000000a1'$$,
                           'cirujano dentista');
-- Una versión nueva conserva la zona
select pruebas.como('ed000000-0000-0000-0000-00000000000b');
create temp table v2 as select public.copiar_plan('edededed-0000-0000-0000-0000000000a1', 'version') as id;
grant select on v2 to authenticated;
select pruebas.igual((select count(*) from public.item_plan where plan_id = (select id from v2) and zona = 'boca' and pieza is null), 1,
                     'la versión copia la zona');
reset role;
select pruebas.como(null);
\echo 'plan_zona: todas las aserciones pasaron'
