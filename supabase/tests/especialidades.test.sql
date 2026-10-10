-- Etapa 9.2 (v2): registros por especialidad. Se escriben en la evolución en borrador por
-- su autor, ligados a un ítem trabajado de la especialidad; firmada, no se editan (regla 2);
-- no se borran (regla 1); la cirugía programa el retiro de puntos al firmar (regla 5).
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values
  ('a6000000-0000-0000-0000-00000000000b'), ('a6000000-0000-0000-0000-00000000000c'),
  ('a6000000-0000-0000-0000-00000000000e'), ('a6000000-0000-0000-0000-00000000000d'),
  ('b6000000-0000-0000-0000-00000000000b');
insert into public.clinica (id, nombre) values
  ('a6a6a6a6-0000-0000-0000-000000000000', 'Clínica Especialidades'), ('b6b6b6b6-0000-0000-0000-000000000000', 'Otra');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('a6000000-0000-0000-0000-00000000000b', 'a6a6a6a6-0000-0000-0000-000000000000', 'Dentista autora', 'odontologo', '9871'),
  ('a6000000-0000-0000-0000-00000000000c', 'a6a6a6a6-0000-0000-0000-000000000000', 'Otro dentista',  'odontologo', '9872'),
  ('a6000000-0000-0000-0000-00000000000e', 'a6a6a6a6-0000-0000-0000-000000000000', 'Asistente E',    'asistente',  null),
  ('a6000000-0000-0000-0000-00000000000d', 'a6a6a6a6-0000-0000-0000-000000000000', 'Recepción E',    'recepcion',  null),
  ('b6000000-0000-0000-0000-00000000000b', 'b6b6b6b6-0000-0000-0000-000000000000', 'Dentista O',     'odontologo', '9971');
insert into public.paciente (id, clinica_id, dni, nombres, apellidos, fecha_nacimiento) values
  ('a6a6a6a6-0000-0000-0000-0000000000f1', 'a6a6a6a6-0000-0000-0000-000000000000', '68000001', 'Esteban', 'Especial', '1980-03-03');
insert into public.procedimiento (id, clinica_id, codigo, nombre, especialidad, precio_base_centimos, duracion_minutos, control_dias) values
  ('a6a6a6a6-0000-0000-0000-0000000000d1', 'a6a6a6a6-0000-0000-0000-000000000000', 'END-01', 'Endodoncia molar', 'endodoncia', 60000, 90, null),
  ('a6a6a6a6-0000-0000-0000-0000000000d2', 'a6a6a6a6-0000-0000-0000-000000000000', 'CIR-01', 'Exodoncia simple', 'cirugia', 15000, 45, 10),
  ('a6a6a6a6-0000-0000-0000-0000000000d3', 'a6a6a6a6-0000-0000-0000-000000000000', 'IMP-01', 'Implante', 'implantes', 250000, 90, null);
insert into public.plan_tratamiento (id, clinica_id, paciente_id, odontologo_id, titulo, estado, aceptado_at) values
  ('a6a6a6a6-0000-0000-0000-0000000000a1', 'a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-0000000000f1',
   'a6000000-0000-0000-0000-00000000000b', 'Rehabilitación', 'aceptado', now());
insert into public.item_plan (id, clinica_id, plan_id, procedimiento, procedimiento_id, precio_centimos, odontologo_id, estado, orden, pieza) values
  ('a6a6a6a6-0000-0000-0000-0000000000e1', 'a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-0000000000a1',
   'Endodoncia molar', 'a6a6a6a6-0000-0000-0000-0000000000d1', 60000, 'a6000000-0000-0000-0000-00000000000b', 'aceptado', 1, 46),
  ('a6a6a6a6-0000-0000-0000-0000000000e2', 'a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-0000000000a1',
   'Exodoncia simple', 'a6a6a6a6-0000-0000-0000-0000000000d2', 15000, 'a6000000-0000-0000-0000-00000000000b', 'aceptado', 2, 38),
  ('a6a6a6a6-0000-0000-0000-0000000000e3', 'a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-0000000000a1',
   'Implante', 'a6a6a6a6-0000-0000-0000-0000000000d3', 250000, 'a6000000-0000-0000-0000-00000000000b', 'aceptado', 3, 36);

set role authenticated;
select pruebas.como('a6000000-0000-0000-0000-00000000000b');
insert into public.nota_evolucion (id, clinica_id, paciente_id, odontologo_id, texto) values
  ('a6a6a6a6-0000-0000-0000-000000000091', 'a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-0000000000f1',
   'a6000000-0000-0000-0000-00000000000b', 'Endodoncia, exodoncia e implante');
insert into public.evolucion_item (clinica_id, nota_id, item_id, terminado) values
  ('a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000091', 'a6a6a6a6-0000-0000-0000-0000000000e1', false),
  ('a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000091', 'a6a6a6a6-0000-0000-0000-0000000000e2', true),
  ('a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000091', 'a6a6a6a6-0000-0000-0000-0000000000e3', true);

-- Endodoncia: por conducto
insert into public.endodoncia_conducto (clinica_id, nota_id, item_plan_id, conducto, longitud_trabajo_mm, referencia,
                                        lima_maestra, irrigacion, tecnica_obturacion) values
  ('a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000091', 'a6a6a6a6-0000-0000-0000-0000000000e1',
   'MV', 21.5, 'Cúspide MV', 'K 30', 'NaOCl 2.5 %', 'Condensación lateral');
select pruebas.igual((select count(*) from public.endodoncia_conducto where paciente_id = 'a6a6a6a6-0000-0000-0000-0000000000f1'
                        and registrado_por = 'a6000000-0000-0000-0000-00000000000b'), 1, 'conducto registrado con paciente y autor');
select pruebas.debe_fallar($$insert into public.endodoncia_conducto (clinica_id, nota_id, item_plan_id, conducto, lima_maestra)
  values ('a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000091',
          'a6a6a6a6-0000-0000-0000-0000000000e2', 'D', 'K 25')$$, 'no es un procedimiento de endodoncia');
select pruebas.debe_fallar($$insert into public.endodoncia_conducto (clinica_id, nota_id, item_plan_id, conducto, longitud_trabajo_mm)
  values ('a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000091',
          'a6a6a6a6-0000-0000-0000-0000000000e1', 'D', 60)$$, 'check constraint');
select pruebas.debe_fallar($$insert into public.endodoncia_conducto (clinica_id, nota_id, item_plan_id, conducto)
  values ('a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000091',
          'a6a6a6a6-0000-0000-0000-0000000000e1', 'D')$$, 'endodoncia_con_datos');

-- Implante: la pieza es la del ítem; la colocación queda como primera fase
select pruebas.debe_fallar($$insert into public.implante (clinica_id, nota_id, item_plan_id, pieza, marca, diametro_mm, longitud_mm)
  values ('a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000091',
          'a6a6a6a6-0000-0000-0000-0000000000e3', 46, 'Marca X', 4.1, 10)$$, 'la del ítem');
insert into public.implante (clinica_id, nota_id, item_plan_id, pieza, marca, diametro_mm, longitud_mm, lote, torque_ncm)
values ('a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000091',
        'a6a6a6a6-0000-0000-0000-0000000000e3', 36, 'Marca X', 4.1, 10, 'L-123', 35);
select pruebas.igual((select count(*) from public.implante_fase where implante_id = (select id from public.implante where item_plan_id = 'a6a6a6a6-0000-0000-0000-0000000000e3')
                        and fase = 'colocacion'), 1, 'fase de colocación');
select pruebas.debe_fallar($$insert into public.implante (clinica_id, nota_id, item_plan_id, pieza, marca, diametro_mm, longitud_mm)
  values ('a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000091',
          'a6a6a6a6-0000-0000-0000-0000000000e3', 36, 'Marca Y', 4.1, 10)$$, 'implante_item');

-- Cirugía: técnica, sutura y retiro de puntos
select pruebas.debe_fallar($$insert into public.cirugia_registro (clinica_id, nota_id, item_plan_id, tecnica, retiro_puntos_dias)
  values ('a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000091',
          'a6a6a6a6-0000-0000-0000-0000000000e2', 'Colgajo', 7)$$, 'cirugia_puntos_con_sutura');
insert into public.cirugia_registro (clinica_id, nota_id, item_plan_id, tecnica, sutura, retiro_puntos_dias) values
  ('a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000091', 'a6a6a6a6-0000-0000-0000-0000000000e2',
   'Exodoncia con colgajo', 'Seda 3-0, 2 puntos', 7);

-- Odontopediatría: uno por sesión
insert into public.odontopediatria_registro (clinica_id, nota_id, apoderado_presente, acompanante, conducta_frankl) values
  ('a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000091', true, 'Madre', 3);
select pruebas.debe_fallar($$insert into public.odontopediatria_registro (clinica_id, nota_id, apoderado_presente, conducta)
  values ('a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000091', false, 'Colaboró')$$,
  'odontopediatria_una_por_sesion');

-- Solo el autor de la evolución; la asistente y recepción no escriben
select pruebas.como('a6000000-0000-0000-0000-00000000000c');
select pruebas.debe_fallar($$insert into public.ortodoncia_control (clinica_id, nota_id, item_plan_id, observaciones)
  values ('a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000091',
          'a6a6a6a6-0000-0000-0000-0000000000e1', 'x')$$, 'Solo el autor');
select pruebas.debe_fallar($$update public.endodoncia_conducto set anulado_at = now(), anulado_por = auth.uid(),
  motivo_anulacion = 'No corresponde'$$, 'Solo el autor');
select pruebas.como('a6000000-0000-0000-0000-00000000000e');
select pruebas.igual((select count(*) from public.endodoncia_conducto), 1, 'la asistente lee los registros');
select pruebas.debe_fallar($$insert into public.cirugia_registro (clinica_id, nota_id, item_plan_id, tecnica)
  values ('a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000091',
          'a6a6a6a6-0000-0000-0000-0000000000e2', 'Algo')$$, 'Solo el autor');

-- En borrador: no se edita, se anula con motivo
select pruebas.como('a6000000-0000-0000-0000-00000000000b');
select pruebas.debe_fallar($$update public.endodoncia_conducto set lima_maestra = 'K 35'$$, 'permission denied');
select pruebas.debe_fallar($$delete from public.endodoncia_conducto$$, 'permission denied');
update public.odontopediatria_registro set anulado_at = now(), anulado_por = auth.uid(), motivo_anulacion = 'Era otro paciente'
 where nota_id = 'a6a6a6a6-0000-0000-0000-000000000091';
select pruebas.igual((select count(*) from public.odontopediatria_registro where anulado_at is not null), 1, 'anulado en borrador');

-- Firmar: retiro de puntos a los 7 días indicados (prevalece sobre los 10 del catálogo)
select public.firmar_evolucion('a6a6a6a6-0000-0000-0000-000000000091');
reset role;
select pruebas.igual((select count(*) from public.seguimiento where item_plan_id = 'a6a6a6a6-0000-0000-0000-0000000000e2'
                        and tipo = 'retiro_puntos'
                        and fecha_programada = (now() at time zone 'America/Lima')::date + 7), 1, 'retiro de puntos a 7 días');
select pruebas.igual((select count(*) from public.seguimiento where item_plan_id = 'a6a6a6a6-0000-0000-0000-0000000000e2'), 1,
                     'un solo control para la exodoncia');
set role authenticated;

-- Firmada: ni registros nuevos ni anulaciones (regla 2)
select pruebas.debe_fallar($$insert into public.endodoncia_conducto (clinica_id, nota_id, item_plan_id, conducto, lima_maestra)
  values ('a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000091',
          'a6a6a6a6-0000-0000-0000-0000000000e1', 'DV', 'K 25')$$, 'en borrador');
select pruebas.debe_fallar($$update public.endodoncia_conducto set anulado_at = now(), anulado_por = auth.uid(),
  motivo_anulacion = 'Longitud mal anotada'$$, 'firmada');

-- Fase posterior del implante en otra sesión
insert into public.nota_evolucion (id, clinica_id, paciente_id, odontologo_id, texto) values
  ('a6a6a6a6-0000-0000-0000-000000000092', 'a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-0000000000f1',
   'a6000000-0000-0000-0000-00000000000b', 'Control de oseointegración');
insert into public.implante_fase (clinica_id, nota_id, implante_id, fase, fecha) values
  ('a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000092', (select id from public.implante where item_plan_id = 'a6a6a6a6-0000-0000-0000-0000000000e3'),
   'oseointegracion', (now() at time zone 'America/Lima')::date);
select pruebas.debe_fallar($$insert into public.implante_fase (clinica_id, nota_id, implante_id, fase, fecha)
  values ('a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000092',
          (select id from public.implante where item_plan_id = 'a6a6a6a6-0000-0000-0000-0000000000e3'), 'carga', (now() at time zone 'America/Lima')::date + 1)$$, 'futura');
select pruebas.debe_fallar($$insert into public.implante_fase (clinica_id, nota_id, implante_id, fase, fecha)
  values ('a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000092',
          (select id from public.implante where item_plan_id = 'a6a6a6a6-0000-0000-0000-0000000000e3'), 'colocacion', (now() at time zone 'America/Lima')::date)$$, 'ya está registrada');
-- Un ítem no trabajado en la sesión no recibe registros
select pruebas.debe_fallar($$insert into public.endodoncia_conducto (clinica_id, nota_id, item_plan_id, conducto, lima_maestra)
  values ('a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000092',
          'a6a6a6a6-0000-0000-0000-0000000000e1', 'DV', 'K 25')$$, 'trabajados en esta evolución');

-- Recepción y otra clínica no ven nada
select pruebas.como('a6000000-0000-0000-0000-00000000000d');
select pruebas.igual((select count(*) from public.endodoncia_conducto) + (select count(*) from public.implante)
                     + (select count(*) from public.implante_fase) + (select count(*) from public.cirugia_registro)
                     + (select count(*) from public.odontopediatria_registro), 0, 'recepción no ve registros clínicos');
select pruebas.como('b6000000-0000-0000-0000-00000000000b');
select pruebas.igual((select count(*) from public.implante) + (select count(*) from public.cirugia_registro), 0,
                     'otra clínica no los ve');
select pruebas.debe_fallar($$insert into public.cirugia_registro (clinica_id, nota_id, item_plan_id, tecnica)
  values ('a6a6a6a6-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000092',
          'a6a6a6a6-0000-0000-0000-0000000000e2', 'Ajena')$$, 'Solo el autor');
reset role;
select pruebas.como(null);
\echo 'especialidades: todas las aserciones pasaron'
