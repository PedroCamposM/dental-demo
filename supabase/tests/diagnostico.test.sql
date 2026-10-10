-- Etapa 4 (v2): examen clínico, diagnóstico CIE-10 con adendas y dentición del
-- odontograma. Reglas 1 (nada se borra), 2 (diagnóstico registrado no se edita:
-- solo adendas) y 9 (lo ven dentistas y asistente; lo registra el dentista, en RLS).
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values
  ('a9000000-0000-0000-0000-00000000000a'), ('a9000000-0000-0000-0000-00000000000b'),
  ('a9000000-0000-0000-0000-00000000000c'), ('a9000000-0000-0000-0000-00000000000d'),
  ('a9000000-0000-0000-0000-00000000000e'), ('b9000000-0000-0000-0000-00000000000a');
insert into public.clinica (id, nombre) values
  ('a9a9a9a9-0000-0000-0000-000000000000', 'Clínica L'),
  ('b9b9b9b9-0000-0000-0000-000000000000', 'Clínica M');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('a9000000-0000-0000-0000-00000000000a', 'a9a9a9a9-0000-0000-0000-000000000000', 'Admin L',         'admin',      '9201'),
  ('a9000000-0000-0000-0000-00000000000b', 'a9a9a9a9-0000-0000-0000-000000000000', 'Odontóloga L',    'odontologo', '9202'),
  ('a9000000-0000-0000-0000-00000000000c', 'a9a9a9a9-0000-0000-0000-000000000000', 'Asistente L',     'asistente',  null),
  ('a9000000-0000-0000-0000-00000000000d', 'a9a9a9a9-0000-0000-0000-000000000000', 'Recepción L',     'recepcion',  null),
  ('a9000000-0000-0000-0000-00000000000e', 'a9a9a9a9-0000-0000-0000-000000000000', 'Gerente sin COP', 'admin',      null),
  ('b9000000-0000-0000-0000-00000000000a', 'b9b9b9b9-0000-0000-0000-000000000000', 'Admin M',         'admin',      '9301');
insert into public.paciente (id, clinica_id, dni, nombres, apellidos, fecha_nacimiento) values
  ('a9a9a9a9-0000-0000-0000-0000000000f1', 'a9a9a9a9-0000-0000-0000-000000000000', '49000001', 'Luis', 'Diagnóstico', '1985-03-01'),
  ('a9a9a9a9-0000-0000-0000-0000000000f2', 'a9a9a9a9-0000-0000-0000-000000000000', '49000002', 'Luis', 'Diagnóstico Dos', '1985-03-01');
insert into public.paciente (id, clinica_id, dni, nombres, apellidos, fecha_nacimiento,
                             apoderado_nombre, apoderado_dni, apoderado_telefono) values
  ('a9a9a9a9-0000-0000-0000-0000000000f3', 'a9a9a9a9-0000-0000-0000-000000000000', '49000003', 'Ana', 'Niña',
   (now() at time zone 'America/Lima')::date - interval '4 years', 'Rosa Niña', '49000004', '51911222333');
-- Odontograma inicial con una caries en la 36 (y otro de otro paciente)
insert into public.odontograma (id, clinica_id, paciente_id, tipo, odontologo_id) values
  ('a9a9a9a9-0000-0000-0000-0000000000d1', 'a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1',
   'inicial', 'a9000000-0000-0000-0000-00000000000b'),
  ('a9a9a9a9-0000-0000-0000-0000000000d3', 'a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f3',
   'inicial', 'a9000000-0000-0000-0000-00000000000b');
insert into public.odontograma_hallazgo (id, clinica_id, odontograma_id, hallazgo_codigo, pieza, superficies, siglas, cie10) values
  ('a9a9a9a9-0000-0000-0000-0000000000e1', 'a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000d1',
   'caries', 36, array['oclusal'], array['CD'], 'K02.1'),
  ('a9a9a9a9-0000-0000-0000-0000000000e3', 'a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000d3',
   'caries', 74, array['oclusal'], array['CE'], 'K02.0');

-- Dentición: sin indicarla, se completa según la edad (niña de 4 años: temporal; adulto: permanente)
select pruebas.igual((select count(*) from public.odontograma
                      where (id = 'a9a9a9a9-0000-0000-0000-0000000000d1' and denticion = 'permanente')
                         or (id = 'a9a9a9a9-0000-0000-0000-0000000000d3' and denticion = 'temporal')), 2,
                     'la dentición se completa según la edad');
select pruebas.debe_fallar($$insert into public.odontograma (clinica_id, paciente_id, tipo, odontologo_id, denticion)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1', 'inicial',
          'a9000000-0000-0000-0000-00000000000b', 'adulta')$$, 'check constraint');

-- NTS 188: piezas vecinas entre piezas; transposición en el mismo cuadrante; sigla del defecto de esmalte
select pruebas.debe_fallar($$insert into public.odontograma_hallazgo (clinica_id, odontograma_id, hallazgo_codigo, pieza, pieza_hasta)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000d1', 'diastema', 11, 13)$$, 'vecinas');
insert into public.odontograma_hallazgo (clinica_id, odontograma_id, hallazgo_codigo, pieza, pieza_hasta)
values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000d1', 'diastema', 11, 21);
select pruebas.debe_fallar($$insert into public.odontograma_hallazgo (clinica_id, odontograma_id, hallazgo_codigo, pieza, pieza_hasta)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000d1', 'transposicion', 11, 21)$$, 'mismo cuadrante');
insert into public.odontograma_hallazgo (clinica_id, odontograma_id, hallazgo_codigo, pieza, pieza_hasta)
values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000d1', 'transposicion', 13, 14);
select pruebas.debe_fallar($$insert into public.odontograma_hallazgo (clinica_id, odontograma_id, hallazgo_codigo, pieza, superficies)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000d1', 'defecto_desarrollo_esmalte', 11,
          array['vestibular'])$$, 'falta la sigla');
insert into public.odontograma (clinica_id, paciente_id, tipo, odontologo_id)
values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1', 'alta', 'a9000000-0000-0000-0000-00000000000b');

set role authenticated;

-- ---------------------------------------------------------------------------
-- Examen clínico: lo registra el cirujano dentista; el asistente lo ve
-- ---------------------------------------------------------------------------
select pruebas.como('a9000000-0000-0000-0000-00000000000b');
insert into public.examen_clinico (id, clinica_id, paciente_id, registrado_por, atm, encia, higiene, oclusion)
values ('a9a9a9a9-0000-0000-0000-0000000000c1', 'a9a9a9a9-0000-0000-0000-000000000000',
        'a9a9a9a9-0000-0000-0000-0000000000f1', 'a9000000-0000-0000-0000-00000000000b',
        'Sin alteraciones', 'Inflamada en sector anteroinferior', 'regular', 'Clase I de Angle');
select pruebas.debe_fallar($$insert into public.examen_clinico (clinica_id, paciente_id, registrado_por)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1',
          'a9000000-0000-0000-0000-00000000000b')$$, 'examen_algun_dato');
select pruebas.debe_fallar($$insert into public.examen_clinico (clinica_id, paciente_id, registrado_por, higiene)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1',
          'a9000000-0000-0000-0000-00000000000b', 'excelente')$$, 'check constraint');
select pruebas.debe_fallar($$update public.examen_clinico set encia = 'Editada'
                             where id = 'a9a9a9a9-0000-0000-0000-0000000000c1'$$, 'permission denied');
select pruebas.debe_fallar($$delete from public.examen_clinico$$, 'permission denied');

select pruebas.como('a9000000-0000-0000-0000-00000000000c');   -- asistente
select pruebas.igual((select count(*) from public.examen_clinico), 1, 'el asistente ve el examen');
select pruebas.debe_fallar($$insert into public.examen_clinico (clinica_id, paciente_id, registrado_por, atm)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1',
          'a9000000-0000-0000-0000-00000000000c', 'Normal')$$, 'row-level security');
select pruebas.como('a9000000-0000-0000-0000-00000000000e');   -- admin sin COP
select pruebas.debe_fallar($$insert into public.examen_clinico (clinica_id, paciente_id, registrado_por, atm)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1',
          'a9000000-0000-0000-0000-00000000000e', 'Normal')$$, 'row-level security');
select pruebas.igual((select count(*) from public.examen_clinico), 0, 'admin sin COP no ve el examen');

-- ---------------------------------------------------------------------------
-- Diagnóstico CIE-10
-- ---------------------------------------------------------------------------
select pruebas.como('a9000000-0000-0000-0000-00000000000b');
-- Desde el hallazgo del odontograma: presuntivo en la 36, cara oclusal
insert into public.diagnostico (id, clinica_id, paciente_id, cie10, tipo, pieza, superficies, hallazgo_id, examen_id, registrado_por)
values ('a9a9a9a9-0000-0000-0000-0000000000b1', 'a9a9a9a9-0000-0000-0000-000000000000',
        'a9a9a9a9-0000-0000-0000-0000000000f1', 'K02.1', 'presuntivo', 36, array['oclusal'],
        'a9a9a9a9-0000-0000-0000-0000000000e1', 'a9a9a9a9-0000-0000-0000-0000000000c1',
        'a9000000-0000-0000-0000-00000000000b');
-- Se confirma como definitivo
insert into public.diagnostico (id, clinica_id, paciente_id, cie10, tipo, pieza, confirma_id, registrado_por)
values ('a9a9a9a9-0000-0000-0000-0000000000b2', 'a9a9a9a9-0000-0000-0000-000000000000',
        'a9a9a9a9-0000-0000-0000-0000000000f1', 'K02.1', 'definitivo', 36,
        'a9a9a9a9-0000-0000-0000-0000000000b1', 'a9000000-0000-0000-0000-00000000000b');
-- Sin pieza (diagnóstico general de la boca)
insert into public.diagnostico (clinica_id, paciente_id, cie10, tipo, registrado_por)
values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1', 'K05.1', 'definitivo',
        'a9000000-0000-0000-0000-00000000000b');
select pruebas.igual((select count(*) from public.diagnostico), 3, 'tres diagnósticos');

-- Validaciones del servidor
select pruebas.debe_fallar($$insert into public.diagnostico (clinica_id, paciente_id, cie10, tipo, registrado_por)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1', 'K02', 'definitivo',
          'a9000000-0000-0000-0000-00000000000b')$$, 'subcódigo');
select pruebas.debe_fallar($$insert into public.diagnostico (clinica_id, paciente_id, cie10, tipo, registrado_por)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1', 'K99.9', 'definitivo',
          'a9000000-0000-0000-0000-00000000000b')$$, 'foreign key');
select pruebas.debe_fallar($$insert into public.diagnostico (clinica_id, paciente_id, cie10, tipo, registrado_por)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1', 'K02.1', 'probable',
          'a9000000-0000-0000-0000-00000000000b')$$, 'check constraint');
select pruebas.debe_fallar($$insert into public.diagnostico (clinica_id, paciente_id, cie10, tipo, pieza, registrado_por)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1', 'K02.1', 'definitivo', 19,
          'a9000000-0000-0000-0000-00000000000b')$$, 'check constraint');
select pruebas.debe_fallar($$insert into public.diagnostico (clinica_id, paciente_id, cie10, tipo, superficies, registrado_por)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1', 'K02.1', 'definitivo',
          array['oclusal'], 'a9000000-0000-0000-0000-00000000000b')$$, 'diagnostico_superficie_con_pieza');
select pruebas.debe_fallar($$insert into public.diagnostico (clinica_id, paciente_id, cie10, tipo, hallazgo_id, registrado_por)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1', 'K02.0', 'definitivo',
          'a9a9a9a9-0000-0000-0000-0000000000e3', 'a9000000-0000-0000-0000-00000000000b')$$, 'no corresponde');
select pruebas.debe_fallar($$insert into public.diagnostico (clinica_id, paciente_id, cie10, tipo, confirma_id, registrado_por)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1', 'K02.1', 'definitivo',
          'a9a9a9a9-0000-0000-0000-0000000000b2', 'a9000000-0000-0000-0000-00000000000b')$$, 'presuntivo vigente');
select pruebas.debe_fallar($$insert into public.diagnostico (clinica_id, paciente_id, cie10, tipo, registrado_por)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1', 'K02.1', 'definitivo',
          'a9000000-0000-0000-0000-00000000000a')$$, 'row-level security');

-- Regla 2: no se edita ni se borra; solo adendas
select pruebas.debe_fallar($$update public.diagnostico set cie10 = 'K02.0'
                             where id = 'a9a9a9a9-0000-0000-0000-0000000000b2'$$, 'permission denied');
select pruebas.debe_fallar($$delete from public.diagnostico$$, 'permission denied');
insert into public.diagnostico_adenda (clinica_id, diagnostico_id, texto, registrado_por)
values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000b2',
        'Radiografía confirma compromiso dentinario', 'a9000000-0000-0000-0000-00000000000b');
select pruebas.debe_fallar($$update public.diagnostico_adenda set texto = 'Otro'$$, 'permission denied');
select pruebas.debe_fallar($$delete from public.diagnostico_adenda$$, 'permission denied');
select pruebas.debe_fallar($$insert into public.diagnostico_adenda (clinica_id, diagnostico_id, texto, registrado_por)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000b2', 'ok',
          'a9000000-0000-0000-0000-00000000000b')$$, 'check constraint');

-- Anulación con motivo, a nombre propio, con hora del servidor
update public.diagnostico set anulado_at = now() - interval '3 days', anulado_por = 'a9000000-0000-0000-0000-00000000000b',
                              motivo_anulacion = 'Registrado en el paciente equivocado'
 where id = 'a9a9a9a9-0000-0000-0000-0000000000b1';
select pruebas.igual((select count(*) from public.diagnostico where id = 'a9a9a9a9-0000-0000-0000-0000000000b1'
                        and anulado_at > now() - interval '1 minute'), 1, 'la anulación lleva la hora del servidor');
select pruebas.debe_fallar($$update public.diagnostico set anulado_at = now(), anulado_por = 'a9000000-0000-0000-0000-00000000000b',
                             motivo_anulacion = 'x' where id = 'a9a9a9a9-0000-0000-0000-0000000000b2'$$, 'check constraint');

-- El asistente ve, pero no diagnostica ni agrega adendas
select pruebas.como('a9000000-0000-0000-0000-00000000000c');
select pruebas.igual((select count(*) from public.diagnostico), 3, 'el asistente ve los diagnósticos');
select pruebas.igual((select count(*) from public.diagnostico_adenda), 1, 'el asistente ve las adendas');
select pruebas.debe_fallar($$insert into public.diagnostico (clinica_id, paciente_id, cie10, tipo, registrado_por)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1', 'K02.1', 'definitivo',
          'a9000000-0000-0000-0000-00000000000c')$$, 'row-level security');
select pruebas.debe_fallar($$insert into public.diagnostico_adenda (clinica_id, diagnostico_id, texto, registrado_por)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000b2', 'Adenda del asistente',
          'a9000000-0000-0000-0000-00000000000c')$$, 'row-level security');

-- Recepción no ve nada clínico, pero sí el catálogo CIE-10
select pruebas.como('a9000000-0000-0000-0000-00000000000d');
select pruebas.igual((select count(*) from public.examen_clinico) + (select count(*) from public.diagnostico)
                     + (select count(*) from public.diagnostico_adenda), 0, 'recepción no ve examen ni diagnósticos');
select pruebas.igual((select count(*) from public.catalogo_cie10 where codigo = 'K02.1'), 1, 'el catálogo CIE-10 es legible');
select pruebas.debe_fallar($$insert into public.catalogo_cie10 values ('K99.1', 'Inventado', false)$$, 'permission denied');

-- ---------------------------------------------------------------------------
-- Fusión: exámenes y diagnósticos del duplicado pasan al que se conserva
-- ---------------------------------------------------------------------------
select pruebas.como('a9000000-0000-0000-0000-00000000000b');
insert into public.diagnostico (clinica_id, paciente_id, cie10, tipo, registrado_por)
values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f2', 'K04.0', 'presuntivo',
        'a9000000-0000-0000-0000-00000000000b');
select pruebas.como('a9000000-0000-0000-0000-00000000000a');
select public.fusionar_pacientes('a9a9a9a9-0000-0000-0000-0000000000f2', 'a9a9a9a9-0000-0000-0000-0000000000f1',
                                 'Se registró dos veces');
select pruebas.igual((select count(*) from public.diagnostico where paciente_id = 'a9a9a9a9-0000-0000-0000-0000000000f1'),
                     4, 'el diagnóstico del duplicado pasa al que se conserva');
select pruebas.debe_fallar($$insert into public.diagnostico (clinica_id, paciente_id, cie10, tipo, registrado_por)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f2', 'K02.1', 'definitivo',
          'a9000000-0000-0000-0000-00000000000a')$$, 'anulado');

-- ---------------------------------------------------------------------------
-- Correcciones de la revisión: coherencia, doble confirmación, autoría, auditoría
-- ---------------------------------------------------------------------------
select pruebas.como('a9000000-0000-0000-0000-00000000000b');
-- El diagnóstico desde un hallazgo va en la misma pieza
select pruebas.debe_fallar($$insert into public.diagnostico (clinica_id, paciente_id, cie10, tipo, pieza, hallazgo_id, registrado_por)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1', 'K02.1', 'definitivo', 11,
          'a9a9a9a9-0000-0000-0000-0000000000e1', 'a9000000-0000-0000-0000-00000000000b')$$, 'a esta pieza');
-- Superficies imposibles
select pruebas.debe_fallar($$insert into public.diagnostico (clinica_id, paciente_id, cie10, tipo, pieza, superficies, registrado_por)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1', 'K02.1', 'definitivo', 46,
          array['palatino'], 'a9000000-0000-0000-0000-00000000000b')$$, 'Superficie imposible');
select pruebas.debe_fallar($$insert into public.diagnostico (clinica_id, paciente_id, cie10, tipo, pieza, superficies, registrado_por)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1', 'K02.1', 'definitivo', 11,
          array['oclusal'], 'a9000000-0000-0000-0000-00000000000b')$$, 'Superficie imposible');
-- Un presuntivo se confirma una sola vez
insert into public.diagnostico (id, clinica_id, paciente_id, cie10, tipo, registrado_por)
values ('a9a9a9a9-0000-0000-0000-0000000000b5', 'a9a9a9a9-0000-0000-0000-000000000000',
        'a9a9a9a9-0000-0000-0000-0000000000f1', 'K04.0', 'presuntivo', 'a9000000-0000-0000-0000-00000000000b');
insert into public.diagnostico (clinica_id, paciente_id, cie10, tipo, confirma_id, registrado_por)
values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1', 'K04.0', 'definitivo',
        'a9a9a9a9-0000-0000-0000-0000000000b5', 'a9000000-0000-0000-0000-00000000000b');
select pruebas.debe_fallar($$insert into public.diagnostico (clinica_id, paciente_id, cie10, tipo, confirma_id, registrado_por)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1', 'K04.0', 'definitivo',
          'a9a9a9a9-0000-0000-0000-0000000000b5', 'a9000000-0000-0000-0000-00000000000b')$$, 'diagnostico_confirma_unico');
-- La pieza debe existir en la dentición del odontograma (el d1 es permanente)
select pruebas.debe_fallar($$insert into public.odontograma_hallazgo (clinica_id, odontograma_id, hallazgo_codigo, pieza, siglas)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000d1', 'remanente_radicular', 55,
          array['RR'])$$, 'dentición');
-- Solo quien firmó el odontograma anula sus hallazgos (NTS 188, 5.6)
select pruebas.como('a9000000-0000-0000-0000-00000000000a');   -- admin con COP, no firmó d1
update public.odontograma_hallazgo set anulado_at = now(), anulado_por = 'a9000000-0000-0000-0000-00000000000a',
                                       motivo_anulacion = 'Intento de otro dentista'
 where id = 'a9a9a9a9-0000-0000-0000-0000000000e1';
select pruebas.igual((select count(*) from public.odontograma_hallazgo
                      where id = 'a9a9a9a9-0000-0000-0000-0000000000e1' and anulado_at is null), 1,
                     'otro dentista no anula los hallazgos de un odontograma ajeno');
reset role;
select pruebas.igual((select count(*) from public.auditoria where tabla = 'diagnostico_adenda'
                        and clinica_id = 'a9a9a9a9-0000-0000-0000-000000000000'), 1,
                     'la adenda queda en la auditoría');
set role authenticated;

-- ---------------------------------------------------------------------------
-- Otra clínica y visitante sin sesión
-- ---------------------------------------------------------------------------
select pruebas.como('b9000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.examen_clinico) + (select count(*) from public.diagnostico)
                     + (select count(*) from public.diagnostico_adenda), 0, 'otra clínica no ve examen ni diagnósticos');
select pruebas.debe_fallar($$insert into public.diagnostico (clinica_id, paciente_id, cie10, tipo, registrado_por)
  values ('a9a9a9a9-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-0000000000f1', 'K02.1', 'definitivo',
          'b9000000-0000-0000-0000-00000000000a')$$, 'row-level security');
reset role;
set role anon;
select pruebas.debe_fallar('select 1 from public.diagnostico', 'permission denied');
select pruebas.debe_fallar('select 1 from public.catalogo_cie10', 'permission denied');
reset role;
select pruebas.como(null);
\echo 'diagnostico: todas las aserciones pasaron'
