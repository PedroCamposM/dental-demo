-- Etapa 3: filiación según el «Formato de Filiación» de la NTS 139-MINSA/2018/DGAIN
-- (docs/NTS-139-MINSA-2018-DGAIN-historia-clinica.md, formatos especiales, 1).
-- Aditiva: columnas opcionales; los pacientes existentes quedan con NULL.
-- La dirección actual (`direccion`), la ocupación, el teléfono, el documento y el
-- apoderado ya existían desde la 0901. El N° de historia clínica es el documento
-- de identidad (NTS 139, 4.2.23), así que no se agrega una columna aparte.

alter table public.paciente
  add column lugar_nacimiento      text check (char_length(lugar_nacimiento) <= 120),
  add column procedencia           text check (char_length(procedencia) <= 200),
  -- Grupo sanguíneo y factor Rh juntos: A+, O-, AB+…
  add column grupo_sanguineo       text check (grupo_sanguineo ~ '^(A|B|AB|O)[+-]$'),
  add column estado_civil          text check (estado_civil in
    ('soltero', 'conviviente', 'casado', 'separado', 'divorciado', 'viudo', 'otro')),
  add column grado_instruccion     text check (grado_instruccion in
    ('sin_instruccion', 'inicial', 'primaria_incompleta', 'primaria_completa',
     'secundaria_incompleta', 'secundaria_completa', 'superior_incompleta', 'superior_completa')),
  add column seguro                text check (seguro in ('ninguno', 'sis', 'essalud', 'eps', 'soat', 'privado', 'otro')),
  add column seguro_numero         text check (char_length(seguro_numero) <= 30),
  -- La religión es un dato sensible (Ley 29733): siempre opcional.
  add column religion              text check (char_length(religion) <= 60),
  add column apoderado_direccion   text check (char_length(apoderado_direccion) <= 200),
  -- El N° de afiliación pertenece a un seguro: sin seguro (o «ninguno») no hay número.
  add constraint paciente_seguro_numero check (seguro_numero is null or (seguro is not null and seguro <> 'ninguno'));

-- El GRANT de paciente es por tabla (select, insert, update): cubre las columnas nuevas.
