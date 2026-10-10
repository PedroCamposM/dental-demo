-- Etapa 7.2 (v2): consentimiento informado (firmado a mano y escaneado) y uso de imagen.
-- Regla 3 completa: realizado = evolución firmada + consentimiento firmado si se requiere.
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values
  ('af000000-0000-0000-0000-00000000000a'), ('af000000-0000-0000-0000-00000000000b'),
  ('af000000-0000-0000-0000-00000000000c'), ('af000000-0000-0000-0000-00000000000d'),
  ('bf000000-0000-0000-0000-00000000000a');
insert into public.clinica (id, nombre) values
  ('afafafaf-0000-0000-0000-000000000000', 'Clínica T'),
  ('bfbfbfbf-0000-0000-0000-000000000000', 'Clínica U');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('af000000-0000-0000-0000-00000000000a', 'afafafaf-0000-0000-0000-000000000000', 'Admin T',      'admin',      '9811'),
  ('af000000-0000-0000-0000-00000000000b', 'afafafaf-0000-0000-0000-000000000000', 'Odontóloga T', 'odontologo', '9812'),
  ('af000000-0000-0000-0000-00000000000c', 'afafafaf-0000-0000-0000-000000000000', 'Asistente T',  'asistente',  null),
  ('af000000-0000-0000-0000-00000000000d', 'afafafaf-0000-0000-0000-000000000000', 'Recepción T',  'recepcion',  null),
  ('bf000000-0000-0000-0000-00000000000a', 'bfbfbfbf-0000-0000-0000-000000000000', 'Admin U',      'admin',      '9911');
insert into public.paciente (id, clinica_id, dni, nombres, apellidos, fecha_nacimiento,
                             apoderado_nombre, apoderado_dni, apoderado_telefono, apoderado_parentesco) values
  ('afafafaf-0000-0000-0000-0000000000f1', 'afafafaf-0000-0000-0000-000000000000', '62000001', 'Luis', 'Adulto', '1980-01-01',
   null, null, null, null),
  ('afafafaf-0000-0000-0000-0000000000f2', 'afafafaf-0000-0000-0000-000000000000', '62000002', 'Niño', 'Menor', current_date - 3000,
   'Rosa Menor', '62000003', '51944000000', 'madre');
insert into public.procedimiento (id, clinica_id, codigo, nombre, especialidad, precio_base_centimos, duracion_minutos,
                                  requiere_consentimiento) values
  ('afafafaf-0000-0000-0000-0000000000d1', 'afafafaf-0000-0000-0000-000000000000', 'CIR-01', 'Exodoncia simple', 'cirugia',
   12000, 30, true),
  ('afafafaf-0000-0000-0000-0000000000d2', 'afafafaf-0000-0000-0000-000000000000', 'PRE-01', 'Profilaxis', 'preventiva',
   8000, 45, false);
insert into public.plan_tratamiento (id, clinica_id, paciente_id, odontologo_id, titulo, estado, aceptado_at) values
  ('afafafaf-0000-0000-0000-0000000000a1', 'afafafaf-0000-0000-0000-000000000000', 'afafafaf-0000-0000-0000-0000000000f1',
   'af000000-0000-0000-0000-00000000000b', 'Plan', 'aceptado', now()),
  ('afafafaf-0000-0000-0000-0000000000a2', 'afafafaf-0000-0000-0000-000000000000', 'afafafaf-0000-0000-0000-0000000000f2',
   'af000000-0000-0000-0000-00000000000b', 'Plan niño', 'aceptado', now());
insert into public.item_plan (id, clinica_id, plan_id, pieza, procedimiento, procedimiento_id, precio_centimos, odontologo_id, estado, orden) values
  ('afafafaf-0000-0000-0000-0000000000e1', 'afafafaf-0000-0000-0000-000000000000', 'afafafaf-0000-0000-0000-0000000000a1',
   48, 'Exodoncia simple', 'afafafaf-0000-0000-0000-0000000000d1', 12000, 'af000000-0000-0000-0000-00000000000b', 'aceptado', 1),
  ('afafafaf-0000-0000-0000-0000000000e2', 'afafafaf-0000-0000-0000-000000000000', 'afafafaf-0000-0000-0000-0000000000a1',
   null, 'Profilaxis', 'afafafaf-0000-0000-0000-0000000000d2', 8000, 'af000000-0000-0000-0000-00000000000b', 'aceptado', 2),
  ('afafafaf-0000-0000-0000-0000000000e3', 'afafafaf-0000-0000-0000-000000000000', 'afafafaf-0000-0000-0000-0000000000a2',
   75, 'Exodoncia simple', 'afafafaf-0000-0000-0000-0000000000d1', 12000, 'af000000-0000-0000-0000-00000000000b', 'aceptado', 1);

set role authenticated;

-- ---------------------------------------------------------------------------
-- Plantillas: las mantiene el administrador
-- ---------------------------------------------------------------------------
select pruebas.como('af000000-0000-0000-0000-00000000000b');
select pruebas.debe_fallar($$insert into public.plantilla_consentimiento (clinica_id, tipo, nombre, descripcion, riesgos)
  values ('afafafaf-0000-0000-0000-000000000000', 'procedimiento', 'Exodoncia', 'Extracción de la pieza dentaria.',
          'Dolor, sangrado e inflamación.')$$, 'row-level security');
select pruebas.como('af000000-0000-0000-0000-00000000000a');
insert into public.plantilla_consentimiento (id, clinica_id, tipo, nombre, descripcion, riesgos, efectos_adversos, pronostico) values
  ('afafafaf-0000-0000-0000-0000000000b1', 'afafafaf-0000-0000-0000-000000000000', 'procedimiento', 'Exodoncia',
   'Extracción de la pieza dentaria.', 'Dolor, sangrado e inflamación.', 'Reacción a la anestesia local.', 'Favorable.'),
  ('afafafaf-0000-0000-0000-0000000000b2', 'afafafaf-0000-0000-0000-000000000000', 'uso_imagen', 'Uso de imagen',
   'Uso de fotografías clínicas con fines académicos o de difusión.', 'Posible identificación del paciente.', null, null);
update public.procedimiento set consentimiento_plantilla_id = 'afafafaf-0000-0000-0000-0000000000b1'
 where id = 'afafafaf-0000-0000-0000-0000000000d1';
select pruebas.debe_fallar($$update public.procedimiento set consentimiento_plantilla_id = 'afafafaf-0000-0000-0000-0000000000b2'
  where id = 'afafafaf-0000-0000-0000-0000000000d2'$$, 'plantilla de consentimiento de procedimiento');
select pruebas.como('af000000-0000-0000-0000-00000000000d');
select pruebas.igual((select count(*) from public.plantilla_consentimiento), 0, 'recepción no ve plantillas');

-- ---------------------------------------------------------------------------
-- Generar: el texto sale de la plantilla; el representante, del apoderado
-- ---------------------------------------------------------------------------
select pruebas.como('af000000-0000-0000-0000-00000000000c');
select pruebas.debe_fallar($$insert into public.consentimiento (clinica_id, paciente_id, tipo, plantilla_id, item_plan_id, profesional_id)
  values ('afafafaf-0000-0000-0000-000000000000', 'afafafaf-0000-0000-0000-0000000000f1', 'procedimiento',
          'afafafaf-0000-0000-0000-0000000000b1', 'afafafaf-0000-0000-0000-0000000000e1', 'af000000-0000-0000-0000-00000000000b')$$,
  'cirujano dentista');
select pruebas.como('af000000-0000-0000-0000-00000000000b');
select pruebas.debe_fallar($$update public.consentimiento set estado = 'firmado'$$, 'permission denied');
insert into public.consentimiento (id, clinica_id, paciente_id, tipo, plantilla_id, item_plan_id, profesional_id) values
  ('afafafaf-0000-0000-0000-0000000000c1', 'afafafaf-0000-0000-0000-000000000000', 'afafafaf-0000-0000-0000-0000000000f1',
   'procedimiento', 'afafafaf-0000-0000-0000-0000000000b1', 'afafafaf-0000-0000-0000-0000000000e1',
   'af000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.consentimiento where id = 'afafafaf-0000-0000-0000-0000000000c1'
                        and titulo = 'Exodoncia — Exodoncia simple (pieza 48)' and riesgos = 'Dolor, sangrado e inflamación.'
                        and profesional_id = 'af000000-0000-0000-0000-00000000000b' and estado = 'pendiente'
                        and representante_nombre is null), 1, 'texto copiado y responsable = quien lo genera');
select pruebas.debe_fallar($$insert into public.consentimiento (clinica_id, paciente_id, tipo, plantilla_id, item_plan_id, profesional_id)
  values ('afafafaf-0000-0000-0000-000000000000', 'afafafaf-0000-0000-0000-0000000000f1', 'procedimiento',
          'afafafaf-0000-0000-0000-0000000000b1', 'afafafaf-0000-0000-0000-0000000000e1', 'af000000-0000-0000-0000-00000000000b')$$,
  'consentimiento_item_vigente');
select pruebas.debe_fallar($$insert into public.consentimiento (clinica_id, paciente_id, tipo, plantilla_id, item_plan_id, profesional_id)
  values ('afafafaf-0000-0000-0000-000000000000', 'afafafaf-0000-0000-0000-0000000000f1', 'procedimiento',
          'afafafaf-0000-0000-0000-0000000000b1', 'afafafaf-0000-0000-0000-0000000000e3', 'af000000-0000-0000-0000-00000000000b')$$,
  'no corresponde');
insert into public.consentimiento (id, clinica_id, paciente_id, tipo, plantilla_id, item_plan_id, profesional_id) values
  ('afafafaf-0000-0000-0000-0000000000c2', 'afafafaf-0000-0000-0000-000000000000', 'afafafaf-0000-0000-0000-0000000000f2',
   'procedimiento', 'afafafaf-0000-0000-0000-0000000000b1', 'afafafaf-0000-0000-0000-0000000000e3',
   'af000000-0000-0000-0000-00000000000b');
select pruebas.igual((select count(*) from public.consentimiento where id = 'afafafaf-0000-0000-0000-0000000000c2'
                        and representante_nombre = 'Rosa Menor' and representante_parentesco = 'madre'), 1,
                     'menor: firma su apoderado');

-- ---------------------------------------------------------------------------
-- Regla 3: sin consentimiento firmado, la exodoncia no se realiza (la profilaxis sí)
-- ---------------------------------------------------------------------------
insert into public.nota_evolucion (id, clinica_id, paciente_id, odontologo_id, texto) values
  ('afafafaf-0000-0000-0000-000000000091', 'afafafaf-0000-0000-0000-000000000000', 'afafafaf-0000-0000-0000-0000000000f1',
   'af000000-0000-0000-0000-00000000000b', 'Exodoncia de la 48');
insert into public.evolucion_item (clinica_id, nota_id, item_id, terminado) values
  ('afafafaf-0000-0000-0000-000000000000', 'afafafaf-0000-0000-0000-000000000091', 'afafafaf-0000-0000-0000-0000000000e1', true);
select pruebas.debe_fallar($$select public.firmar_evolucion('afafafaf-0000-0000-0000-000000000091')$$,
                           'requiere el consentimiento informado firmado');

-- ---------------------------------------------------------------------------
-- Registrar la firma: con el escaneo subido; la asistente puede registrarlo
-- ---------------------------------------------------------------------------
select pruebas.como('af000000-0000-0000-0000-00000000000c');
select pruebas.debe_fallar($$select public.registrar_consentimiento('afafafaf-0000-0000-0000-0000000000c1', 'firmado', (now() at time zone 'America/Lima')::date,
  'afafafaf-0000-0000-0000-000000000000/afafafaf-0000-0000-0000-0000000000f1/77777777-7777-4777-8777-777777777777.pdf',
  'application/pdf', 20000, 'consentimiento.pdf')$$, 'no se terminó de subir');
insert into storage.objects (bucket_id, name) values
  ('clinico', 'afafafaf-0000-0000-0000-000000000000/afafafaf-0000-0000-0000-0000000000f1/77777777-7777-4777-8777-777777777777.pdf');
select pruebas.debe_fallar($$select public.registrar_consentimiento('afafafaf-0000-0000-0000-0000000000c1', 'firmado', (now() at time zone 'America/Lima')::date + 1,
  'afafafaf-0000-0000-0000-000000000000/afafafaf-0000-0000-0000-0000000000f1/77777777-7777-4777-8777-777777777777.pdf',
  'application/pdf', 20000, 'consentimiento.pdf')$$, 'fecha de firma');
select pruebas.debe_fallar($$select public.registrar_consentimiento('afafafaf-0000-0000-0000-0000000000c1', 'firmado', (now() at time zone 'America/Lima')::date,
  'afafafaf-0000-0000-0000-000000000000/afafafaf-0000-0000-0000-0000000000f2/77777777-7777-4777-8777-777777777777.pdf',
  'application/pdf', 20000, 'consentimiento.pdf')$$, 'Ruta de archivo inválida');
select public.registrar_consentimiento('afafafaf-0000-0000-0000-0000000000c1', 'firmado', (now() at time zone 'America/Lima')::date,
  'afafafaf-0000-0000-0000-000000000000/afafafaf-0000-0000-0000-0000000000f1/77777777-7777-4777-8777-777777777777.pdf',
  'application/pdf', 20000, 'consentimiento.pdf');
select pruebas.igual((select count(*) from public.consentimiento c join public.archivo_clinico a on a.id = c.archivo_id
                       where c.id = 'afafafaf-0000-0000-0000-0000000000c1' and c.estado = 'firmado' and a.tipo = 'consentimiento'
                         and c.registrado_por = 'af000000-0000-0000-0000-00000000000c'), 1, 'firmado con su escaneo');
select pruebas.debe_fallar($$select public.registrar_consentimiento('afafafaf-0000-0000-0000-0000000000c1', 'negado', (now() at time zone 'America/Lima')::date,
  'x', 'application/pdf', 1, 'x')$$, 'ya fue registrado');

-- Con el consentimiento firmado, la firma de la evolución realiza la exodoncia
select pruebas.como('af000000-0000-0000-0000-00000000000b');
select public.firmar_evolucion('afafafaf-0000-0000-0000-000000000091');
select pruebas.igual((select count(*) from public.item_plan where id = 'afafafaf-0000-0000-0000-0000000000e1'
                        and estado = 'realizado'), 1, 'realizado con evolución y consentimiento firmados');

-- ---------------------------------------------------------------------------
-- Negativa, revocación y anulación
-- ---------------------------------------------------------------------------
-- El menor: se anula el formato generado por error y se registra la negativa en otro
select pruebas.como('af000000-0000-0000-0000-00000000000c');
select pruebas.debe_fallar($$select public.anular_consentimiento('afafafaf-0000-0000-0000-0000000000c2', 'Error')$$,
                           'cirujano dentista');
select pruebas.como('af000000-0000-0000-0000-00000000000b');
select public.anular_consentimiento('afafafaf-0000-0000-0000-0000000000c2', 'Se imprimió con la plantilla equivocada');
insert into public.consentimiento (id, clinica_id, paciente_id, tipo, plantilla_id, item_plan_id, profesional_id) values
  ('afafafaf-0000-0000-0000-0000000000c3', 'afafafaf-0000-0000-0000-000000000000', 'afafafaf-0000-0000-0000-0000000000f2',
   'procedimiento', 'afafafaf-0000-0000-0000-0000000000b1', 'afafafaf-0000-0000-0000-0000000000e3',
   'af000000-0000-0000-0000-00000000000b');
insert into storage.objects (bucket_id, name) values
  ('clinico', 'afafafaf-0000-0000-0000-000000000000/afafafaf-0000-0000-0000-0000000000f2/88888888-8888-4888-8888-888888888888.jpg');
select public.registrar_consentimiento('afafafaf-0000-0000-0000-0000000000c3', 'negado', (now() at time zone 'America/Lima')::date,
  'afafafaf-0000-0000-0000-000000000000/afafafaf-0000-0000-0000-0000000000f2/88888888-8888-4888-8888-888888888888.jpg',
  'image/jpeg', 30000, 'negativa.jpg');
select pruebas.debe_fallar($$select public.revocar_consentimiento('afafafaf-0000-0000-0000-0000000000c3', 'Cambió de opinión')$$,
                           'Solo se revoca un consentimiento firmado');

-- Uso de imagen: uno vigente por paciente; se revoca con motivo
insert into storage.objects (bucket_id, name) values
  ('clinico', 'afafafaf-0000-0000-0000-000000000000/afafafaf-0000-0000-0000-0000000000f1/99999999-9999-4999-8999-999999999999.pdf');
insert into public.consentimiento (id, clinica_id, paciente_id, tipo, plantilla_id, fines, profesional_id) values
  ('afafafaf-0000-0000-0000-0000000000c4', 'afafafaf-0000-0000-0000-000000000000', 'afafafaf-0000-0000-0000-0000000000f1',
   'uso_imagen', 'afafafaf-0000-0000-0000-0000000000b2', array['academico'], 'af000000-0000-0000-0000-00000000000b');
select pruebas.debe_fallar($$insert into public.consentimiento (clinica_id, paciente_id, tipo, plantilla_id, fines, profesional_id)
  values ('afafafaf-0000-0000-0000-000000000000', 'afafafaf-0000-0000-0000-0000000000f1', 'uso_imagen',
          'afafafaf-0000-0000-0000-0000000000b2', array['difusion'], 'af000000-0000-0000-0000-00000000000b')$$,
  'consentimiento_imagen_vigente');
select pruebas.debe_fallar($$insert into public.consentimiento (clinica_id, paciente_id, tipo, plantilla_id, fines, profesional_id)
  values ('afafafaf-0000-0000-0000-000000000000', 'afafafaf-0000-0000-0000-0000000000f2', 'uso_imagen',
          'afafafaf-0000-0000-0000-0000000000b1', array['difusion'], 'af000000-0000-0000-0000-00000000000b')$$,
  'tipo correcto');
select public.registrar_consentimiento('afafafaf-0000-0000-0000-0000000000c4', 'firmado', (now() at time zone 'America/Lima')::date,
  'afafafaf-0000-0000-0000-000000000000/afafafaf-0000-0000-0000-0000000000f1/99999999-9999-4999-8999-999999999999.pdf',
  'application/pdf', 20000, 'uso-imagen.pdf');
select public.revocar_consentimiento('afafafaf-0000-0000-0000-0000000000c4', 'El paciente ya no autoriza la difusión');
select pruebas.igual((select count(*) from public.consentimiento where id = 'afafafaf-0000-0000-0000-0000000000c4'
                        and estado = 'revocado' and revocado_por = 'af000000-0000-0000-0000-00000000000b'), 1, 'revocado');

-- ---------------------------------------------------------------------------
-- Correcciones de la revisión
-- ---------------------------------------------------------------------------
-- El procedimiento de un ítem aceptado no cambia (no se esquiva la regla 3)
select pruebas.debe_fallar($$update public.item_plan set procedimiento_id = null
                             where id = 'afafafaf-0000-0000-0000-0000000000e2'$$, 'no cambian');
-- El ítem de origen no se fija a mano (no se «presta» el consentimiento de otro paciente)
select pruebas.debe_fallar($$insert into public.item_plan (clinica_id, plan_id, procedimiento, procedimiento_id, precio_centimos,
                               odontologo_id, estado, orden, item_origen_id)
  values ('afafafaf-0000-0000-0000-000000000000', 'afafafaf-0000-0000-0000-0000000000a1', 'Exodoncia simple',
          'afafafaf-0000-0000-0000-0000000000d1', 12000, 'af000000-0000-0000-0000-00000000000b', 'propuesto', 9,
          'afafafaf-0000-0000-0000-0000000000e3')$$, 'del plan del que se copió');
select pruebas.debe_fallar($$update public.item_plan set item_origen_id = id where id = 'afafafaf-0000-0000-0000-0000000000e2'$$,
                           'no cambia');
-- Si el catálogo asigna una plantilla al procedimiento, se usa esa
select pruebas.como('af000000-0000-0000-0000-00000000000a');
insert into public.plantilla_consentimiento (id, clinica_id, tipo, nombre, descripcion, riesgos) values
  ('afafafaf-0000-0000-0000-0000000000b3', 'afafafaf-0000-0000-0000-000000000000', 'procedimiento', 'Blanqueamiento',
   'Aclarar el color de los dientes.', 'Sensibilidad pasajera.');
select pruebas.como('af000000-0000-0000-0000-00000000000b');
select pruebas.debe_fallar($$insert into public.consentimiento (clinica_id, paciente_id, tipo, plantilla_id, item_plan_id, profesional_id)
  values ('afafafaf-0000-0000-0000-000000000000', 'afafafaf-0000-0000-0000-0000000000f2', 'procedimiento',
          'afafafaf-0000-0000-0000-0000000000b3', 'afafafaf-0000-0000-0000-0000000000e3', 'af000000-0000-0000-0000-00000000000b')$$,
  'la del catálogo');
-- Una plantilla que usa el catálogo no se desactiva
select pruebas.como('af000000-0000-0000-0000-00000000000a');
select pruebas.debe_fallar($$update public.plantilla_consentimiento set activa = false
                             where id = 'afafafaf-0000-0000-0000-0000000000b1'$$, 'La usan estos procedimientos');
select pruebas.como('af000000-0000-0000-0000-00000000000b');
-- El consentimiento firmado sigue valiendo en una versión nueva del plan
insert into public.consentimiento (id, clinica_id, paciente_id, tipo, plantilla_id, item_plan_id, profesional_id) values
  ('afafafaf-0000-0000-0000-0000000000c5', 'afafafaf-0000-0000-0000-000000000000', 'afafafaf-0000-0000-0000-0000000000f2',
   'procedimiento', 'afafafaf-0000-0000-0000-0000000000b1', 'afafafaf-0000-0000-0000-0000000000e3',
   'af000000-0000-0000-0000-00000000000b');
insert into storage.objects (bucket_id, name) values
  ('clinico', 'afafafaf-0000-0000-0000-000000000000/afafafaf-0000-0000-0000-0000000000f2/aaaaaaaa-1111-4111-8111-111111111111.pdf');
select public.registrar_consentimiento('afafafaf-0000-0000-0000-0000000000c5', 'firmado', (now() at time zone 'America/Lima')::date,
  'afafafaf-0000-0000-0000-000000000000/afafafaf-0000-0000-0000-0000000000f2/aaaaaaaa-1111-4111-8111-111111111111.pdf',
  'application/pdf', 20000, 'firmado.pdf');
create temp table v2 (id uuid);
grant all on v2 to authenticated;
insert into v2 select public.copiar_plan('afafafaf-0000-0000-0000-0000000000a2', 'version');
-- El escaneo de un consentimiento no se anula desde «Imágenes y archivos»
update public.archivo_clinico set anulado_at = now(), anulado_por = 'af000000-0000-0000-0000-00000000000b',
       motivo_anulacion = 'Prueba' where tipo = 'consentimiento';
select pruebas.igual((select count(*) from public.archivo_clinico where tipo = 'consentimiento' and anulado_at is not null), 0,
                     'el escaneo del consentimiento no se anula');
reset role;
select pruebas.igual((select count(*)::int from public.item_plan i join v2 on v2.id = i.plan_id
                       where i.item_origen_id = 'afafafaf-0000-0000-0000-0000000000e3'
                         and privado.tiene_consentimiento(i.id)), 1, 'la versión nueva hereda el consentimiento firmado');
set role authenticated;

-- Recepción, otra clínica y visitante no ven consentimientos
select pruebas.como('af000000-0000-0000-0000-00000000000d');
select pruebas.igual((select count(*) from public.consentimiento), 0, 'recepción no ve consentimientos');
select pruebas.debe_fallar($$select public.registrar_consentimiento('afafafaf-0000-0000-0000-0000000000c1', 'firmado', (now() at time zone 'America/Lima')::date,
  'x', 'application/pdf', 1, 'x')$$, 'personal clínico');
select pruebas.como('bf000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from public.consentimiento) + (select count(*) from public.plantilla_consentimiento), 0,
                     'otra clínica no ve nada');
select pruebas.debe_fallar($$select public.revocar_consentimiento('afafafaf-0000-0000-0000-0000000000c1', 'Prueba')$$,
                           'Solo se revoca');
-- Fusión: se conserva el consentimiento de uso de imagen firmado, no el pendiente
select pruebas.como('af000000-0000-0000-0000-00000000000b');
insert into public.consentimiento (id, clinica_id, paciente_id, tipo, plantilla_id, fines, profesional_id) values
  ('afafafaf-0000-0000-0000-0000000000c6', 'afafafaf-0000-0000-0000-000000000000', 'afafafaf-0000-0000-0000-0000000000f2',
   'uso_imagen', 'afafafaf-0000-0000-0000-0000000000b2', array['academico'], 'af000000-0000-0000-0000-00000000000b'),
  ('afafafaf-0000-0000-0000-0000000000c7', 'afafafaf-0000-0000-0000-000000000000', 'afafafaf-0000-0000-0000-0000000000f1',
   'uso_imagen', 'afafafaf-0000-0000-0000-0000000000b2', array['difusion'], 'af000000-0000-0000-0000-00000000000b');
insert into storage.objects (bucket_id, name) values
  ('clinico', 'afafafaf-0000-0000-0000-000000000000/afafafaf-0000-0000-0000-0000000000f1/bbbbbbbb-1111-4111-8111-111111111111.pdf');
select public.registrar_consentimiento('afafafaf-0000-0000-0000-0000000000c7', 'firmado', (now() at time zone 'America/Lima')::date,
  'afafafaf-0000-0000-0000-000000000000/afafafaf-0000-0000-0000-0000000000f1/bbbbbbbb-1111-4111-8111-111111111111.pdf',
  'application/pdf', 20000, 'uso.pdf');
select pruebas.como('af000000-0000-0000-0000-00000000000a');
select public.fusionar_pacientes('afafafaf-0000-0000-0000-0000000000f1', 'afafafaf-0000-0000-0000-0000000000f2', 'Registro duplicado');
select pruebas.igual((select count(*) from public.consentimiento where id = 'afafafaf-0000-0000-0000-0000000000c7'
                        and estado = 'firmado' and paciente_id = 'afafafaf-0000-0000-0000-0000000000f2'), 1, 'queda el firmado');
select pruebas.igual((select count(*) from public.consentimiento where id = 'afafafaf-0000-0000-0000-0000000000c6'
                        and anulado_at is not null), 1, 'el pendiente sobrante se anula');
reset role;
set role anon;
select pruebas.debe_fallar('select 1 from public.consentimiento', 'permission denied');
reset role;
select pruebas.como(null);
\echo 'consentimientos: todas las aserciones pasaron'
