-- Etapa 1 (v2): filiación ampliada del paciente.
-- Aditiva: se agregan columnas. `dni` se conserva y se mantiene sincronizado por
-- trigger con tipo_documento/numero_documento (fuente de verdad desde ahora).
-- Verificación: supabase/verificaciones/20261009000901_paciente_filiacion.sql

create type public.tipo_documento as enum ('dni', 'ce', 'pasaporte');
create type public.sexo as enum ('femenino', 'masculino');

alter table public.paciente
  add column tipo_documento                 public.tipo_documento not null default 'dni',
  add column numero_documento               text,
  add column sexo                           public.sexo,
  add column ocupacion                      text,
  add column direccion                      text,
  add column contacto_emergencia_nombre     text,
  add column contacto_emergencia_telefono   text check (contacto_emergencia_telefono ~ '^51\d{9}$'),
  add column contacto_emergencia_parentesco text,
  add column apoderado_parentesco           text;

-- Datos existentes: el DNI pasa a ser el documento (tipo dni).
update public.paciente set numero_documento = dni where dni is not null;

-- DNI: 8 dígitos. CE: 9 a 12 y pasaporte: 6 a 12 caracteres, letras mayúsculas y números.
alter table public.paciente add constraint paciente_documento_formato check (
  numero_documento is null or case tipo_documento
    when 'dni'       then numero_documento ~ '^\d{8}$'
    when 'ce'        then numero_documento ~ '^[A-Z0-9]{9,12}$'
    when 'pasaporte' then numero_documento ~ '^[A-Z0-9]{6,12}$'
  end);
-- No hay dos pacientes con el mismo tipo y número de documento en una clínica.
create unique index paciente_documento_unico
  on public.paciente (clinica_id, tipo_documento, numero_documento);

-- Sincroniza dni <-> documento (el código anterior y el seed solo escriben dni) y
-- exige apoderado completo para menores de edad (fecha de Lima).
create function privado.validar_paciente() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.numero_documento is null and new.dni is not null then
    new.tipo_documento := 'dni';
    new.numero_documento := new.dni;
  end if;
  new.numero_documento := upper(nullif(btrim(new.numero_documento), ''));
  new.dni := case when new.tipo_documento = 'dni' then new.numero_documento end;

  if new.fecha_nacimiento is not null
     and new.fecha_nacimiento > ((now() at time zone 'America/Lima')::date - interval '18 years')::date
     and (nullif(btrim(new.apoderado_nombre), '') is null
          or new.apoderado_dni is null or new.apoderado_telefono is null) then
    raise exception 'Paciente menor de edad: el apoderado (nombre, DNI y teléfono) es obligatorio';
  end if;
  return new;
end $$;
create trigger validar before insert or update on public.paciente
  for each row execute function privado.validar_paciente();

-- Las columnas nuevas se pueden escribir: el GRANT de paciente ya es por tabla
-- (select, insert, update), así que no hace falta GRANT adicional.
