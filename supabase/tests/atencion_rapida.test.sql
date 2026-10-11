-- Etapa 14 (v2): atención rápida. Deja lo mismo que el flujo completo, en una sola
-- transacción; solo el cirujano dentista; respeta la regla 3 (consentimiento).
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values
  ('c4000000-0000-0000-0000-00000000000b'), ('c4000000-0000-0000-0000-00000000000e'),
  ('c4000000-0000-0000-0000-00000000000d'), ('d4000000-0000-0000-0000-00000000000b');
insert into public.clinica (id, nombre) values
  ('c4c4c4c4-0000-0000-0000-000000000000', 'Clínica Rápida'), ('d4d4d4d4-0000-0000-0000-000000000000', 'Otra');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('c4000000-0000-0000-0000-00000000000b', 'c4c4c4c4-0000-0000-0000-000000000000', 'Dentista R', 'odontologo', '9801'),
  ('c4000000-0000-0000-0000-00000000000e', 'c4c4c4c4-0000-0000-0000-000000000000', 'Asistente R', 'asistente', null),
  ('c4000000-0000-0000-0000-00000000000d', 'c4c4c4c4-0000-0000-0000-000000000000', 'Recepción R', 'recepcion', null),
  ('d4000000-0000-0000-0000-00000000000b', 'd4d4d4d4-0000-0000-0000-000000000000', 'Dentista O', 'odontologo', '9802');
insert into public.paciente (id, clinica_id, dni, nombres, apellidos, fecha_nacimiento) values
  ('c4c4c4c4-0000-0000-0000-0000000000f1', 'c4c4c4c4-0000-0000-0000-000000000000', '69900001', 'Raúl', 'Ocasional', '1985-05-05');
insert into public.procedimiento (id, clinica_id, codigo, nombre, especialidad, precio_base_centimos, duracion_minutos,
                                  requiere_consentimiento, control_dias) values
  ('c4c4c4c4-0000-0000-0000-0000000000a1', 'c4c4c4c4-0000-0000-0000-000000000000', 'OPE-01', 'Restauración con resina',
   'operatoria', 18000, 45, false, null),
  ('c4c4c4c4-0000-0000-0000-0000000000a2', 'c4c4c4c4-0000-0000-0000-000000000000', 'CIR-01', 'Exodoncia simple',
   'cirugia', 12000, 30, true, 7);

create temp table datos_ar (j jsonb);
insert into datos_ar values ($${
  "historia": {"motivo_consulta": "Dolor en molar inferior derecho", "tiempo_enfermedad": "3 días",
               "alergias_preguntadas": true, "alergias": ["Penicilina"], "anticoagulado": false, "embarazo": "no_aplica"},
  "examen": {"observaciones": "Caries profunda oclusal en 46, sin movilidad", "higiene": "regular"},
  "diagnostico": {"cie10": "K02.1", "tipo": "definitivo", "pieza": "46"},
  "items": [{"procedimiento_id": "c4c4c4c4-0000-0000-0000-0000000000a1", "pieza": "46"}],
  "evolucion": {"texto": "Remoción de caries y restauración oclusal con resina en 46.", "anestesia_tipo": "Infiltrativa",
                "anestesia_cantidad": "1 cartucho", "indicaciones": "No comer por 1 hora"}
}$$::jsonb);
grant select on datos_ar to authenticated;

set role authenticated;
-- Solo el cirujano dentista
select pruebas.como('c4000000-0000-0000-0000-00000000000e');
select pruebas.debe_fallar($$select public.registrar_atencion_rapida('c4c4c4c4-0000-0000-0000-0000000000f1', (select j from datos_ar))$$,
                           'Solo el cirujano dentista');
select pruebas.como('c4000000-0000-0000-0000-00000000000d');
select pruebas.debe_fallar($$select public.registrar_atencion_rapida('c4c4c4c4-0000-0000-0000-0000000000f1', (select j from datos_ar))$$,
                           'Solo el cirujano dentista');
-- Otra clínica no atiende a este paciente
select pruebas.como('d4000000-0000-0000-0000-00000000000b');
select pruebas.debe_fallar($$select public.registrar_atencion_rapida('c4c4c4c4-0000-0000-0000-0000000000f1', (select j from datos_ar))$$,
                           'Paciente no encontrado');

select pruebas.como('c4000000-0000-0000-0000-00000000000b');
-- Lo mínimo de la NTS 139 es obligatorio (validado en la base, no solo en el formulario)
select pruebas.debe_fallar($$select public.registrar_atencion_rapida('c4c4c4c4-0000-0000-0000-0000000000f1',
  (select j #- '{historia,alergias_preguntadas}' from datos_ar))$$, 'alergias');
select pruebas.debe_fallar($$select public.registrar_atencion_rapida('c4c4c4c4-0000-0000-0000-0000000000f1',
  (select jsonb_set(j, '{examen,observaciones}', '""') from datos_ar))$$, 'examen');
select pruebas.debe_fallar($$select public.registrar_atencion_rapida('c4c4c4c4-0000-0000-0000-0000000000f1',
  (select j - 'diagnostico' from datos_ar))$$, 'CIE-10');
select pruebas.debe_fallar($$select public.registrar_atencion_rapida('c4c4c4c4-0000-0000-0000-0000000000f1',
  (select jsonb_set(j, '{items}', '[]') from datos_ar))$$, 'tratamiento realizado');

-- Regla 3: un procedimiento que requiere consentimiento no se da por realizado sin él, y no queda nada a medias
select pruebas.debe_fallar($$select public.registrar_atencion_rapida('c4c4c4c4-0000-0000-0000-0000000000f1',
  (select jsonb_set(j, '{items}', '[{"procedimiento_id": "c4c4c4c4-0000-0000-0000-0000000000a2", "pieza": "48"}]') from datos_ar))$$,
  'consentimiento');
select pruebas.igual((select count(*) from public.plan_tratamiento) + (select count(*) from public.nota_evolucion)
                     + (select count(*) from public.cuestionario_salud) + (select count(*) from public.diagnostico), 0,
                     'si algo falla, no queda nada a medias');

-- La atención completa
select public.registrar_atencion_rapida('c4c4c4c4-0000-0000-0000-0000000000f1', (select j from datos_ar));
select pruebas.igual((select count(*) from public.cuestionario_salud where motivo_consulta = 'Dolor en molar inferior derecho'
                        and alergias = array['Penicilina']), 1, 'historia: versión nueva con motivo y alergias');
select pruebas.igual((select count(*) from public.examen_clinico where higiene = 'regular'), 1, 'examen registrado');
select pruebas.igual((select count(*) from public.diagnostico where cie10 = 'K02.1' and pieza = 46 and tipo = 'definitivo'), 1,
                     'diagnóstico CIE-10');
select pruebas.igual((select count(*) from public.plan_tratamiento where estado = 'terminado'), 1, 'plan terminado');
select pruebas.igual((select count(*) from public.item_plan where estado = 'realizado' and pieza = 46 and precio_centimos = 18000
                        and diagnostico_id is not null), 1, 'ítem realizado con su precio y diagnóstico de origen');
select pruebas.igual((select count(*) from public.nota_evolucion where firmada_at is not null and cie10 = 'K02.1'
                        and odontologo_id = auth.uid()), 1, 'evolución firmada por quien atendió');
-- Firmada: ya no se edita (regla 2)
select pruebas.debe_fallar($$update public.nota_evolucion set texto = 'Otra cosa'$$, 'firmada');
-- La asistente lo ve; la recepción no ve la nota clínica
select pruebas.como('c4000000-0000-0000-0000-00000000000e');
select pruebas.igual((select count(*) from public.nota_evolucion), 1, 'la asistente ve la evolución');
select pruebas.como('c4000000-0000-0000-0000-00000000000d');
select pruebas.igual((select count(*) from public.nota_evolucion), 0, 'recepción no ve la evolución');
select pruebas.igual((select count(*) from public.plan_tratamiento), 1, 'recepción ve el plan (para cobrar)');
reset role;
select pruebas.como(null);
\echo 'atencion_rapida: todas las aserciones pasaron'
