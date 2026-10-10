-- Etapa 11 (v2): exportar la historia clínica. Solo el cirujano dentista, con motivo; cada
-- exportación queda registrada (tabla y auditoría) y no se borra.
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values
  ('e8000000-0000-0000-0000-00000000000b'), ('e8000000-0000-0000-0000-00000000000e'),
  ('e8000000-0000-0000-0000-00000000000d'), ('e8000000-0000-0000-0000-00000000000a'),
  ('f8000000-0000-0000-0000-00000000000b');
insert into public.clinica (id, nombre) values
  ('e8e8e8e8-0000-0000-0000-000000000000', 'Clínica Export'), ('f8f8f8f8-0000-0000-0000-000000000000', 'Otra');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('e8000000-0000-0000-0000-00000000000b', 'e8e8e8e8-0000-0000-0000-000000000000', 'Dentista X', 'odontologo', '9791'),
  ('e8000000-0000-0000-0000-00000000000e', 'e8e8e8e8-0000-0000-0000-000000000000', 'Asistente X', 'asistente', null),
  ('e8000000-0000-0000-0000-00000000000d', 'e8e8e8e8-0000-0000-0000-000000000000', 'Recepción X', 'recepcion', null),
  ('e8000000-0000-0000-0000-00000000000a', 'e8e8e8e8-0000-0000-0000-000000000000', 'Admin X', 'admin', null),
  ('f8000000-0000-0000-0000-00000000000b', 'f8f8f8f8-0000-0000-0000-000000000000', 'Dentista O', 'odontologo', '9792');
insert into public.paciente (id, clinica_id, dni, nombres, apellidos, fecha_nacimiento) values
  ('e8e8e8e8-0000-0000-0000-0000000000f1', 'e8e8e8e8-0000-0000-0000-000000000000', '69800001', 'Ana', 'Exporta', '1990-01-01');

set role authenticated;
-- Asistente y recepción no exportan
select pruebas.como('e8000000-0000-0000-0000-00000000000e');
select pruebas.debe_fallar($$select public.registrar_exportacion('e8e8e8e8-0000-0000-0000-0000000000f1', 'Pedido del paciente')$$,
                           'cirujano dentista');
select pruebas.como('e8000000-0000-0000-0000-00000000000d');
select pruebas.debe_fallar($$select public.registrar_exportacion('e8e8e8e8-0000-0000-0000-0000000000f1', 'Pedido del paciente')$$,
                           'cirujano dentista');
-- El dentista exporta con motivo; queda en la tabla y en la auditoría
select pruebas.como('e8000000-0000-0000-0000-00000000000b');
select pruebas.debe_fallar($$select public.registrar_exportacion('e8e8e8e8-0000-0000-0000-0000000000f1', 'x')$$, 'motivo');
select public.registrar_exportacion('e8e8e8e8-0000-0000-0000-0000000000f1', 'Solicitud escrita del paciente');
select pruebas.igual((select count(*) from public.exportacion_historia where usuario_id = auth.uid()
                        and motivo = 'Solicitud escrita del paciente'), 1, 'exportación registrada');
select pruebas.debe_fallar($$insert into public.exportacion_historia (clinica_id, paciente_id, usuario_id, motivo)
  values ('e8e8e8e8-0000-0000-0000-000000000000', 'e8e8e8e8-0000-0000-0000-0000000000f1', auth.uid(), 'Sin pasar por la función')$$,
  'permission denied');
select pruebas.debe_fallar($$update public.exportacion_historia set motivo = 'Otro motivo'$$, 'permission denied');
select pruebas.debe_fallar($$delete from public.exportacion_historia$$, 'permission denied');
reset role;
select pruebas.igual((select count(*) from public.auditoria where tabla = 'historia_clinica' and accion = 'exportar'
                        and registro_id = 'e8e8e8e8-0000-0000-0000-0000000000f1'
                        and despues ->> 'motivo' = 'Solicitud escrita del paciente'), 1, 'auditoría con el motivo');
set role authenticated;
-- El admin la ve (audita); la asistente no; otra clínica no exporta ni ve
select pruebas.como('e8000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.exportacion_historia), 1, 'el admin ve las exportaciones');
select pruebas.como('e8000000-0000-0000-0000-00000000000e');
select pruebas.igual((select count(*) from public.exportacion_historia), 0, 'la asistente no las ve');
select pruebas.como('f8000000-0000-0000-0000-00000000000b');
select pruebas.igual((select count(*) from public.exportacion_historia), 0, 'otra clínica no las ve');
select pruebas.debe_fallar($$select public.registrar_exportacion('e8e8e8e8-0000-0000-0000-0000000000f1', 'Curiosidad ajena')$$,
                           'no encontrado');
reset role;
select pruebas.como(null);
\echo 'exportacion: todas las aserciones pasaron'
