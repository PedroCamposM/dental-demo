-- Etapa 5 (v2): plan con fases, dependencias, diagnóstico de origen, alternativas y
-- versiones. Reglas 3 (realizado en orden), 9 (permisos en RLS) y que nada se borra.
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values
  ('ac000000-0000-0000-0000-00000000000a'), ('ac000000-0000-0000-0000-00000000000b'),
  ('ac000000-0000-0000-0000-00000000000c'), ('ac000000-0000-0000-0000-00000000000d'),
  ('bc000000-0000-0000-0000-00000000000a');
insert into public.clinica (id, nombre) values
  ('acacacac-0000-0000-0000-000000000000', 'Clínica N'),
  ('bcbcbcbc-0000-0000-0000-000000000000', 'Clínica O');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('ac000000-0000-0000-0000-00000000000a', 'acacacac-0000-0000-0000-000000000000', 'Admin N',      'admin',      '9401'),
  ('ac000000-0000-0000-0000-00000000000b', 'acacacac-0000-0000-0000-000000000000', 'Odontóloga N', 'odontologo', '9402'),
  ('ac000000-0000-0000-0000-00000000000c', 'acacacac-0000-0000-0000-000000000000', 'Asistente N',  'asistente',  null),
  ('ac000000-0000-0000-0000-00000000000d', 'acacacac-0000-0000-0000-000000000000', 'Recepción N',  'recepcion',  null),
  ('bc000000-0000-0000-0000-00000000000a', 'bcbcbcbc-0000-0000-0000-000000000000', 'Admin O',      'admin',      '9501');
insert into public.paciente (id, clinica_id, dni, nombres, apellidos, fecha_nacimiento) values
  ('acacacac-0000-0000-0000-0000000000f1', 'acacacac-0000-0000-0000-000000000000', '50000001', 'Raúl', 'Plan', '1980-01-01'),
  ('acacacac-0000-0000-0000-0000000000f2', 'acacacac-0000-0000-0000-000000000000', '50000002', 'Otra', 'Persona', '1980-01-01');
insert into public.diagnostico (id, clinica_id, paciente_id, cie10, tipo, pieza, registrado_por) values
  ('acacacac-0000-0000-0000-0000000000d1', 'acacacac-0000-0000-0000-000000000000', 'acacacac-0000-0000-0000-0000000000f1',
   'K04.0', 'definitivo', 36, 'ac000000-0000-0000-0000-00000000000b'),
  ('acacacac-0000-0000-0000-0000000000d2', 'acacacac-0000-0000-0000-000000000000', 'acacacac-0000-0000-0000-0000000000f2',
   'K02.1', 'definitivo', 11, 'ac000000-0000-0000-0000-00000000000b');

set role authenticated;

-- ---------------------------------------------------------------------------
-- La odontóloga arma el plan A con fases, diagnóstico de origen y dependencias
-- ---------------------------------------------------------------------------
select pruebas.como('ac000000-0000-0000-0000-00000000000b');
insert into public.plan_tratamiento (id, clinica_id, paciente_id, odontologo_id, titulo)
values ('acacacac-0000-0000-0000-0000000000a1', 'acacacac-0000-0000-0000-000000000000',
        'acacacac-0000-0000-0000-0000000000f1', 'ac000000-0000-0000-0000-00000000000b', 'Endodoncia y corona 36');
select pruebas.igual((select count(*) from public.plan_tratamiento where id = 'acacacac-0000-0000-0000-0000000000a1'
                        and grupo_id = id), 1, 'un plan nuevo es su propio grupo');
insert into public.plan_fase (clinica_id, plan_id, numero, nombre) values
  ('acacacac-0000-0000-0000-000000000000', 'acacacac-0000-0000-0000-0000000000a1', 1, 'Tratamiento pulpar'),
  ('acacacac-0000-0000-0000-000000000000', 'acacacac-0000-0000-0000-0000000000a1', 2, 'Rehabilitación');
insert into public.item_plan (id, clinica_id, plan_id, pieza, procedimiento, precio_centimos, odontologo_id, fase,
                              diagnostico_id, duracion_minutos, orden) values
  ('acacacac-0000-0000-0000-0000000000e1', 'acacacac-0000-0000-0000-000000000000', 'acacacac-0000-0000-0000-0000000000a1',
   36, 'Endodoncia multirradicular', 75000, 'ac000000-0000-0000-0000-00000000000b', 1,
   'acacacac-0000-0000-0000-0000000000d1', 90, 1),
  ('acacacac-0000-0000-0000-0000000000e2', 'acacacac-0000-0000-0000-000000000000', 'acacacac-0000-0000-0000-0000000000a1',
   36, 'Corona metal-cerámica', 90000, 'ac000000-0000-0000-0000-00000000000b', 2, null, 60, 2);
select pruebas.igual((select count(*) from public.item_plan where id = 'acacacac-0000-0000-0000-0000000000e1'
                        and cie10 = 'K04.0'), 1, 'el CIE-10 del ítem viene del diagnóstico de origen');
select pruebas.debe_fallar($$insert into public.item_plan (clinica_id, plan_id, procedimiento, precio_centimos, odontologo_id, fase)
  values ('acacacac-0000-0000-0000-000000000000', 'acacacac-0000-0000-0000-0000000000a1', 'X', 100,
          'ac000000-0000-0000-0000-00000000000b', 3)$$, 'no existe en este plan');
select pruebas.debe_fallar($$insert into public.item_plan (clinica_id, plan_id, procedimiento, precio_centimos, odontologo_id, diagnostico_id)
  values ('acacacac-0000-0000-0000-000000000000', 'acacacac-0000-0000-0000-0000000000a1', 'X', 100,
          'ac000000-0000-0000-0000-00000000000b', 'acacacac-0000-0000-0000-0000000000d2')$$, 'no es de este paciente');

-- La corona requiere la endodoncia; sin ciclos ni dependencias entre planes
insert into public.item_dependencia (clinica_id, item_id, requiere_id)
values ('acacacac-0000-0000-0000-000000000000', 'acacacac-0000-0000-0000-0000000000e2', 'acacacac-0000-0000-0000-0000000000e1');
select pruebas.debe_fallar($$insert into public.item_dependencia (clinica_id, item_id, requiere_id)
  values ('acacacac-0000-0000-0000-000000000000', 'acacacac-0000-0000-0000-0000000000e1',
          'acacacac-0000-0000-0000-0000000000e2')$$, 'ciclo');
select pruebas.debe_fallar($$delete from public.item_dependencia$$, 'permission denied');
select pruebas.debe_fallar($$delete from public.plan_fase$$, 'permission denied');

-- El asistente ve el plan, pero no lo arma
select pruebas.como('ac000000-0000-0000-0000-00000000000c');
select pruebas.igual((select count(*) from public.plan_fase) + (select count(*) from public.item_dependencia), 3,
                     'el asistente ve fases y dependencias');
select pruebas.debe_fallar($$insert into public.plan_fase (clinica_id, plan_id, numero, nombre)
  values ('acacacac-0000-0000-0000-000000000000', 'acacacac-0000-0000-0000-0000000000a1', 3, 'Otra')$$, 'row-level security');
select pruebas.debe_fallar($$select public.aceptar_plan('acacacac-0000-0000-0000-0000000000a1')$$, 'no registra');

-- ---------------------------------------------------------------------------
-- Alternativa B: la crea la odontóloga; recepción no puede
-- ---------------------------------------------------------------------------
select pruebas.como('ac000000-0000-0000-0000-00000000000d');
select pruebas.debe_fallar($$select public.copiar_plan('acacacac-0000-0000-0000-0000000000a1', 'alternativa')$$, 'cirujano dentista');
select pruebas.como('ac000000-0000-0000-0000-00000000000b');
create temp table ids (clave text primary key, id uuid);
grant all on ids to authenticated;
insert into ids select 'b', public.copiar_plan('acacacac-0000-0000-0000-0000000000a1', 'alternativa');
select pruebas.igual((select count(*) from public.plan_tratamiento p join ids on ids.id = p.id and ids.clave = 'b'
                      where p.alternativa = 'B' and p.version = 1 and p.estado = 'propuesto'
                        and p.grupo_id = 'acacacac-0000-0000-0000-0000000000a1'), 1, 'alternativa B en el mismo grupo');
select pruebas.igual((select count(*) from public.item_plan i join ids on ids.id = i.plan_id and ids.clave = 'b'), 2,
                     'la alternativa copia los ítems');
select pruebas.igual((select count(*) from public.item_dependencia d join public.item_plan i on i.id = d.item_id
                      join ids on ids.id = i.plan_id and ids.clave = 'b'), 1, 'y sus dependencias');
select pruebas.igual((select count(*) from public.plan_fase f join ids on ids.id = f.plan_id and ids.clave = 'b'), 2, 'y sus fases');

-- Recepción registra que el paciente eligió la B: la A queda rechazada con motivo
select pruebas.como('ac000000-0000-0000-0000-00000000000d');
select public.aceptar_plan((select id from ids where clave = 'b'));
select pruebas.igual((select count(*) from public.plan_tratamiento where id = 'acacacac-0000-0000-0000-0000000000a1'
                        and estado = 'rechazado' and motivo_rechazo = 'Se eligió la alternativa B'), 1,
                     'la alternativa no elegida queda rechazada');
select pruebas.igual((select count(*) from public.item_plan where plan_id = 'acacacac-0000-0000-0000-0000000000a1'
                        and estado = 'cancelado'), 2, 'sus ítems quedan cancelados con motivo');
select pruebas.igual((select count(*) from public.plan_tratamiento p join ids on ids.id = p.id and ids.clave = 'b'
                      where p.estado = 'aceptado' and p.aceptado_at is not null), 1, 'la B queda aceptada con fecha');
select pruebas.debe_fallar($$select public.aceptar_plan((select id from ids where clave = 'b'))$$, 'propuesto');

-- ---------------------------------------------------------------------------
-- Regla 3: en orden. La corona no se marca realizada antes que la endodoncia.
-- ---------------------------------------------------------------------------
reset role;
insert into public.nota_evolucion (id, clinica_id, paciente_id, odontologo_id, texto) values
  ('acacacac-0000-0000-0000-0000000000c1', 'acacacac-0000-0000-0000-000000000000', 'acacacac-0000-0000-0000-0000000000f1',
   'ac000000-0000-0000-0000-00000000000b', 'Endodoncia de la 36 en dos sesiones');
set role authenticated;
select pruebas.como('ac000000-0000-0000-0000-00000000000b');
select pruebas.debe_fallar($$update public.item_plan set estado = 'realizado', realizado_at = now(),
                               nota_evolucion_id = 'acacacac-0000-0000-0000-0000000000c1'
                             where plan_id = (select id from ids where clave = 'b') and procedimiento like 'Corona%'$$,
                           'Primero debe realizarse');
update public.item_plan set estado = 'realizado', realizado_at = now(), nota_evolucion_id = 'acacacac-0000-0000-0000-0000000000c1'
 where plan_id = (select id from ids where clave = 'b') and procedimiento like 'Endodoncia%';

-- ---------------------------------------------------------------------------
-- Versión 2 de la B: copia solo lo pendiente; al aceptarla, la B queda reemplazada
-- y lo hecho se conserva.
-- ---------------------------------------------------------------------------
insert into ids select 'b2', public.copiar_plan((select id from ids where clave = 'b'), 'version');
select pruebas.igual((select count(*) from public.plan_tratamiento p join ids on ids.id = p.id and ids.clave = 'b2'
                      where p.version = 2 and p.alternativa = 'B'), 1, 'versión 2 de la alternativa B');
select pruebas.igual((select count(*) from public.item_plan i join ids on ids.id = i.plan_id and ids.clave = 'b2'), 1,
                     'la versión nueva copia solo lo pendiente');
select public.aceptar_plan((select id from ids where clave = 'b2'));
select pruebas.igual((select count(*) from public.plan_tratamiento p join ids on ids.id = p.id and ids.clave = 'b'
                      where p.estado = 'reemplazado'), 1, 'la versión anterior queda reemplazada');
select pruebas.igual((select count(*) from public.item_plan i join ids on ids.id = i.plan_id and ids.clave = 'b'
                      where (i.estado = 'realizado' and i.procedimiento like 'Endodoncia%')
                         or (i.estado = 'cancelado' and i.motivo_cancelacion = 'Reemplazado por la versión 2 (alternativa B)')), 2,
                     'lo hecho se conserva y lo pendiente se cancela con motivo');
-- El grupo no lo elige el cliente: un grupo ajeno se ignora (revisión: alta)
insert into public.plan_tratamiento (id, clinica_id, paciente_id, odontologo_id, titulo, grupo_id, version, alternativa)
values ('acacacac-0000-0000-0000-0000000000a9', 'acacacac-0000-0000-0000-000000000000', 'acacacac-0000-0000-0000-0000000000f2',
        'ac000000-0000-0000-0000-00000000000b', 'Intento de colarse', 'acacacac-0000-0000-0000-0000000000a1', 3, 'A');
select pruebas.igual((select count(*) from public.plan_tratamiento where id = 'acacacac-0000-0000-0000-0000000000a9'
                        and grupo_id = id), 1, 'un grupo_id enviado por el cliente se ignora');
select pruebas.debe_fallar($$update public.plan_tratamiento set grupo_id = 'acacacac-0000-0000-0000-0000000000a1'
                             where id = 'acacacac-0000-0000-0000-0000000000a9'$$, 'no se modifica');
select pruebas.debe_fallar($$insert into public.plan_tratamiento (clinica_id, paciente_id, odontologo_id, titulo, plan_origen_id)
  values ('acacacac-0000-0000-0000-000000000000', 'acacacac-0000-0000-0000-0000000000f2', 'ac000000-0000-0000-0000-00000000000b',
          'Origen ajeno', 'acacacac-0000-0000-0000-0000000000a1')$$, 'no es de este paciente');
-- Una alternativa solo junto a un plan propuesto
select pruebas.debe_fallar($$select public.copiar_plan((select id from ids where clave = 'b2'), 'alternativa')$$, 'propuesto');

-- Aceptación parcial: solo los ítems elegidos; el resto se cancela
insert into ids select 'c', public.copiar_plan((select id from ids where clave = 'b2'), 'version');
insert into public.item_plan (clinica_id, plan_id, procedimiento, precio_centimos, odontologo_id, fase)
select 'acacacac-0000-0000-0000-000000000000', id, 'Profilaxis', 15000, 'ac000000-0000-0000-0000-00000000000b', 1
  from ids where clave = 'c';
select pruebas.debe_fallar($$select public.aceptar_plan((select id from ids where clave = 'c'), array[]::uuid[])$$, 'Elige ítems');
-- Lo aceptado no puede requerir algo no aceptado
insert into public.item_dependencia (clinica_id, item_id, requiere_id)
select 'acacacac-0000-0000-0000-000000000000', p.id, c.id
  from public.item_plan p join public.item_plan c on c.plan_id = p.plan_id and c.procedimiento like 'Corona%'
 where p.plan_id = (select id from ids where clave = 'c') and p.procedimiento = 'Profilaxis';
select pruebas.debe_fallar($$select public.aceptar_plan((select id from ids where clave = 'c'),
  array(select i.id from public.item_plan i join ids on ids.id = i.plan_id and ids.clave = 'c' where i.procedimiento = 'Profilaxis'))$$,
  'después de otro que no se acepta');
-- (se prueba la aceptación parcial con la corona sola)
select public.aceptar_plan((select id from ids where clave = 'c'),
  array(select i.id from public.item_plan i join ids on ids.id = i.plan_id and ids.clave = 'c' where i.procedimiento like 'Corona%'));
select pruebas.igual((select count(*) from public.item_plan i join ids on ids.id = i.plan_id and ids.clave = 'c'
                      where (i.procedimiento like 'Corona%' and i.estado = 'aceptado')
                         or (i.procedimiento = 'Profilaxis' and i.estado = 'cancelado' and i.motivo_cancelacion = 'El paciente no lo aceptó')), 2,
                     'aceptación parcial');
select pruebas.igual((select count(*) from public.plan_tratamiento p join ids on ids.id = p.id and ids.clave = 'b2'
                      where p.estado = 'reemplazado'), 1, 'al aceptar la versión 3, la 2 en marcha queda reemplazada');

-- No se reemplaza un plan con cuotas por cobrar
insert into ids select 'd', public.copiar_plan((select id from ids where clave = 'c'), 'version');
reset role;
insert into public.cuota (clinica_id, plan_id, numero, monto_centimos, vence_el)
select 'acacacac-0000-0000-0000-000000000000', id, 1, 50000, current_date + 30 from ids where clave = 'c';
set role authenticated;
select pruebas.como('ac000000-0000-0000-0000-00000000000d');
select pruebas.debe_fallar($$select public.aceptar_plan((select id from ids where clave = 'd'))$$, 'cuotas por cobrar');
-- El rechazo es atómico: el plan y sus ítems propuestos
select public.rechazar_plan((select id from ids where clave = 'd'), 'Prefiere esperar');
select pruebas.igual((select count(*) from public.plan_tratamiento p join ids on ids.id = p.id and ids.clave = 'd'
                      where p.estado = 'rechazado' and p.motivo_rechazo = 'Prefiere esperar'), 1, 'rechazo con motivo');
select pruebas.igual((select count(*) from public.item_plan i join ids on ids.id = i.plan_id and ids.clave = 'd'
                      where i.estado <> 'cancelado'), 0, 'los ítems del plan rechazado quedan cancelados');
select pruebas.como('ac000000-0000-0000-0000-00000000000c');
select pruebas.debe_fallar($$select public.rechazar_plan('acacacac-0000-0000-0000-0000000000a1', 'x x x')$$, 'no registra');

-- Otra clínica no ve ni acepta
select pruebas.como('bc000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.plan_fase) + (select count(*) from public.item_dependencia), 0,
                     'otra clínica no ve fases ni dependencias');
select pruebas.debe_fallar($$select public.copiar_plan('acacacac-0000-0000-0000-0000000000a1', 'version')$$, 'no encontrado');
reset role;
set role anon;
select pruebas.debe_fallar('select 1 from public.plan_fase', 'permission denied');
select pruebas.debe_fallar($$select public.aceptar_plan('acacacac-0000-0000-0000-0000000000a1')$$, 'permission denied');
reset role;
select pruebas.como(null);
\echo 'plan: todas las aserciones pasaron'
