-- =============================================================================
-- PROPUESTA de esquema inicial (v2) — NO APLICAR hasta aprobación.
-- Este archivo vive en docs/ (no en supabase/migrations/) a propósito, para que
-- `supabase db push` no lo ejecute. Una vez aprobado se partirá en migraciones.
--
-- Principios:
--   * clinica = tenant. Toda tabla de datos lleva clinica_id y tiene RLS.
--     Única excepción: catalogo_hallazgo (catálogo oficial NTS 188, igual para
--     todas las clínicas, solo lectura; también con RLS activado).
--   * FKs compuestas (clinica_id, id) impiden mezclar filas de dos clínicas.
--   * Montos en céntimos (integer). Fechas de agenda en timestamptz; las fechas
--     de negocio ("hoy", "vencido") se calculan en America/Lima.
--   * Datos clínicos y pagos no se borran ni se editan: no hay GRANT DELETE y el
--     UPDATE solo alcanza las columnas de anulación. La auditoría lo registra.
--   * anon no recibe ningún permiso. authenticated recibe GRANTs explícitos y
--     RLS filtra por clínica y rol.
--
-- Cambios v2:
--   * Odontograma según NTS 188-MINSA/DGIESP-2022 (catálogo de 38 hallazgos,
--     siglas oficiales, solo azul/rojo, hallazgos inalterables — numeral 5.6).
--   * Cobro desacoplado del estado clínico: un ítem puede estar cobrado (total o
--     parcialmente) sin estar realizado. "cobrado" deja de ser un estado del ítem
--     y se calcula desde pago_aplicacion.
--   * pago_aplicacion: un pago (un método) se reparte entre ítems y/o cuotas;
--     un mismo ítem puede pagarse con varios pagos de distintos métodos.
--   * Usuarios: solo se crean desde el servidor (invitación); siempre queda al
--     menos un admin activo; el registro clínico exige número COP.
-- =============================================================================

create schema if not exists privado;   -- no expuesto por la Data API
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.rol_usuario        as enum ('admin', 'odontologo', 'recepcion');
create type public.tipo_odontograma   as enum ('inicial', 'evolucion');
create type public.estado_hallazgo    as enum ('bueno', 'malo');   -- azul / rojo (5.12, 5.13)
create type public.estado_plan        as enum ('propuesto', 'aceptado', 'en_curso', 'detenido', 'terminado', 'rechazado');
create type public.estado_item        as enum ('propuesto', 'aceptado', 'programado', 'realizado', 'cancelado');
create type public.estado_cita        as enum ('programada', 'confirmada', 'atendida', 'no_asistio', 'cancelada');
create type public.metodo_pago        as enum ('efectivo', 'yape', 'plin', 'tarjeta', 'transferencia');
create type public.tipo_seguimiento   as enum ('presupuesto', 'tratamiento_detenido', 'cuota_vencida', 'control');
create type public.resultado_seguimiento as enum ('pendiente', 'mensaje_enviado', 'contactado', 'no_contesta', 'agendo_cita', 'rechazo', 'pago');

-- ---------------------------------------------------------------------------
-- Tenant y usuarios
-- ---------------------------------------------------------------------------
create table public.clinica (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  ruc          text check (ruc ~ '^\d{11}$'),
  zona_horaria text not null default 'America/Lima',
  created_at   timestamptz not null default now()
);

create table public.usuario (
  id          uuid primary key references auth.users (id),
  clinica_id  uuid not null references public.clinica (id),
  nombre      text not null,
  rol         public.rol_usuario not null,
  cop         text check (cop ~ '^\d{1,6}$'),   -- Colegio Odontológico del Perú; habilita el registro clínico
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (clinica_id, id),
  constraint odontologo_con_cop check (rol <> 'odontologo' or cop is not null)
);

-- Helpers para RLS. SECURITY DEFINER para no recursar en las políticas de usuario.
create function privado.clinica_actual() returns uuid
language sql stable security definer set search_path = '' as $$
  select clinica_id from public.usuario where id = auth.uid() and activo
$$;

create function privado.rol_actual() returns public.rol_usuario
language sql stable security definer set search_path = '' as $$
  select rol from public.usuario where id = auth.uid() and activo
$$;

-- Cirujano dentista = admin u odontólogo con COP (firma el registro clínico, 5.3)
create function privado.es_dentista() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select rol in ('admin', 'odontologo') and cop is not null
                   from public.usuario where id = auth.uid() and activo), false)
$$;

-- Siempre debe quedar al menos un admin activo en la clínica.
create function privado.validar_admin_restante() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.rol = 'admin' and old.activo and (new.rol <> 'admin' or not new.activo) then
    perform 1 from public.usuario where clinica_id = old.clinica_id for update;
    if not exists (select 1 from public.usuario
                   where clinica_id = old.clinica_id and id <> old.id
                     and rol = 'admin' and activo) then
      raise exception 'La clínica debe conservar al menos un administrador activo';
    end if;
  end if;
  return new;
end $$;
create trigger admin_restante before update of rol, activo on public.usuario
  for each row execute function privado.validar_admin_restante();

-- ---------------------------------------------------------------------------
-- Pacientes
-- ---------------------------------------------------------------------------
create table public.paciente (
  id                      uuid primary key default gen_random_uuid(),
  clinica_id              uuid not null references public.clinica (id),
  dni                     text check (dni ~ '^\d{8}$'),
  nombres                 text not null,
  apellidos               text not null,
  telefono                text check (telefono ~ '^51\d{9}$'),   -- E.164 sin '+', listo para wa.me
  fecha_nacimiento        date,
  apoderado_nombre        text,
  apoderado_dni           text check (apoderado_dni ~ '^\d{8}$'),
  apoderado_telefono      text check (apoderado_telefono ~ '^51\d{9}$'),
  consentimiento_datos_at timestamptz,   -- Ley 29733
  anulado_at              timestamptz,
  anulado_por             uuid references public.usuario (id),
  motivo_anulacion        text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (clinica_id, id),
  unique (clinica_id, dni),
  constraint paciente_anulacion_completa check ((anulado_at is null) = (motivo_anulacion is null))
);
-- "Menor de edad => apoderado obligatorio" se valida en la lógica (Vitest):
-- un CHECK con current_date no es inmutable y rompería dumps/restores.

-- ---------------------------------------------------------------------------
-- Odontograma — NTS 188-MINSA/DGIESP-2022
--   5.4  numeración FDI (dígito dos)            -> check de pieza
--   5.6  hallazgo inalterable                    -> sin UPDATE salvo anulación
--   5.8  solo hallazgos observados, no lo que se hará (eso es el plan)
--   5.12/5.13 solo azul (buen estado) y rojo (mal estado / temporal / patológico)
--   5.14/5.15 especificaciones y observaciones
-- ---------------------------------------------------------------------------
create function privado.es_pieza_fdi(p smallint) returns boolean
language sql immutable set search_path = '' as $$
  select (p / 10 between 1 and 4 and p % 10 between 1 and 8)   -- permanentes
      or (p / 10 between 5 and 8 and p % 10 between 1 and 5)   -- deciduas
$$;

create function privado.es_pieza_superior(p smallint) returns boolean
language sql immutable set search_path = '' as $$
  select p / 10 in (1, 2, 5, 6)
$$;

-- Catálogo oficial (sección 6.1). Global, solo lectura.
--   ambito:  pieza | superficie | rango (de pieza a pieza_hasta) |
--            entre_piezas (dos piezas vecinas) | arcada (superior/inferior)
--   color:   azul | rojo | segun_estado (azul si bueno, rojo si malo)
create table public.catalogo_hallazgo (
  codigo             text primary key,
  numeral            text not null,
  nombre             text not null,
  ambito             text not null check (ambito in ('pieza', 'superficie', 'rango', 'entre_piezas', 'arcada')),
  color              text not null check (color in ('azul', 'rojo', 'segun_estado')),
  siglas             text[] not null default '{}',
  sigla_obligatoria  boolean not null default false,
  multiples_siglas   boolean not null default false,
  requiere_grado     boolean not null default false
);

insert into public.catalogo_hallazgo
  (codigo, numeral, nombre, ambito, color, siglas, sigla_obligatoria, multiples_siglas, requiere_grado) values
  ('aparato_ortodontico_fijo',      '6.1.1',  'Aparato ortodóntico fijo',          'rango',        'segun_estado', '{}',                         false, false, false),
  ('aparato_ortodontico_removible', '6.1.2',  'Aparato ortodóntico removible',     'arcada',       'segun_estado', '{}',                         false, false, false),
  ('corona',                        '6.1.3',  'Corona',                            'pieza',        'segun_estado', '{CM,CF,CMC,CV,CLM}',         true,  false, false),
  ('corona_temporal',               '6.1.4',  'Corona temporal',                   'pieza',        'rojo',         '{CT}',                       true,  false, false),
  ('defecto_desarrollo_esmalte',    '6.1.5',  'Defectos de desarrollo del esmalte','superficie',   'rojo',         '{O,PE}',                     false, true,  false),
  ('diastema',                      '6.1.6',  'Diastema',                          'entre_piezas', 'azul',         '{}',                         false, false, false),
  ('edentulo_total',                '6.1.7',  'Edéntulo total',                    'arcada',       'azul',         '{}',                         false, false, false),
  ('espigo_munon',                  '6.1.8',  'Espigo – muñón',                    'pieza',        'segun_estado', '{}',                         false, false, false),
  ('fosas_fisuras_profundas',       '6.1.9',  'Fosas y fisuras profundas',         'pieza',        'azul',         '{FFP}',                      true,  false, false),
  ('fractura',                      '6.1.10', 'Fractura dental',                   'pieza',        'rojo',         '{}',                         false, false, false),
  ('fusion',                        '6.1.11', 'Fusión',                            'entre_piezas', 'azul',         '{}',                         false, false, false),
  ('geminacion',                    '6.1.12', 'Geminación',                        'pieza',        'azul',         '{}',                         false, false, false),
  ('giroversion',                   '6.1.13', 'Giroversión',                       'pieza',        'azul',         '{}',                         false, false, false),
  ('impactacion',                   '6.1.14', 'Impactación',                       'pieza',        'azul',         '{I}',                        true,  false, false),
  ('implante',                      '6.1.15', 'Implante dental',                   'pieza',        'segun_estado', '{IMP}',                      true,  false, false),
  ('caries',                        '6.1.16', 'Lesión de caries dental',           'superficie',   'rojo',         '{MB,CE,CD,CDP}',             true,  false, false),
  ('macrodoncia',                   '6.1.17', 'Macrodoncia',                       'pieza',        'azul',         '{MAC}',                      true,  false, false),
  ('microdoncia',                   '6.1.18', 'Microdoncia',                       'pieza',        'azul',         '{MIC}',                      true,  false, false),
  ('movilidad_patologica',          '6.1.19', 'Movilidad patológica',              'pieza',        'rojo',         '{}',                         false, false, true),
  ('pieza_ausente',                 '6.1.20', 'Pieza dentaria ausente',            'pieza',        'azul',         '{DNE,DEX,DAO}',              true,  false, false),
  ('pieza_en_clavija',              '6.1.21', 'Pieza dentaria en clavija',         'pieza',        'azul',         '{}',                         false, false, false),
  ('pieza_ectopica',                '6.1.22', 'Pieza dentaria ectópica',           'pieza',        'azul',         '{E}',                        true,  false, false),
  ('pieza_en_erupcion',             '6.1.23', 'Pieza dentaria en erupción',        'pieza',        'azul',         '{}',                         false, false, false),
  ('pieza_extruida',                '6.1.24', 'Pieza dentaria extruida',           'pieza',        'azul',         '{}',                         false, false, false),
  ('pieza_intruida',                '6.1.25', 'Pieza dentaria intruida',           'pieza',        'azul',         '{}',                         false, false, false),
  ('pieza_supernumeraria',          '6.1.26', 'Pieza dentaria supernumeraria',     'entre_piezas', 'azul',         '{S}',                        true,  false, false),
  ('pulpotomia',                    '6.1.27', 'Pulpotomía',                        'pieza',        'segun_estado', '{PP}',                       true,  false, false),
  ('posicion_anormal',              '6.1.28', 'Posición anormal dentaria',         'pieza',        'azul',         '{M,D,V,P,L}',                true,  true,  false),
  ('protesis_parcial_fija',         '6.1.29', 'Prótesis dental parcial fija',      'rango',        'segun_estado', '{}',                         false, false, false),
  ('protesis_completa',             '6.1.30', 'Prótesis dental completa',          'arcada',       'segun_estado', '{}',                         false, false, false),
  ('protesis_parcial_removible',    '6.1.31', 'Prótesis dental parcial removible', 'rango',        'segun_estado', '{}',                         false, false, false),
  ('remanente_radicular',           '6.1.32', 'Remanente radicular',               'pieza',        'rojo',         '{RR}',                       true,  false, false),
  ('restauracion_definitiva',       '6.1.33', 'Restauración definitiva',           'superficie',   'segun_estado', '{AM,R,IV,IM,IE,C}',          true,  false, false),
  ('restauracion_temporal',         '6.1.34', 'Restauración temporal',             'superficie',   'rojo',         '{}',                         false, false, false),
  ('sellante',                      '6.1.35', 'Sellante',                          'superficie',   'segun_estado', '{S}',                        true,  false, false),
  ('superficie_desgastada',         '6.1.36', 'Superficie desgastada',             'superficie',   'rojo',         '{DES}',                      true,  false, false),
  ('tratamiento_conducto',          '6.1.37', 'Tratamiento de conducto',           'pieza',        'segun_estado', '{TC,PC}',                    true,  false, false),
  ('transposicion',                 '6.1.38', 'Transposición dentaria',            'entre_piezas', 'azul',         '{}',                         false, false, false);

create table public.odontograma (
  id               uuid primary key default gen_random_uuid(),
  clinica_id       uuid not null,
  paciente_id      uuid not null,
  plan_id          uuid,              -- plan que lo origina (5.10), si aplica
  tipo             public.tipo_odontograma not null,
  fecha            timestamptz not null default now(),
  odontologo_id    uuid not null,     -- cirujano dentista que firma (5.3)
  especificaciones text,              -- 5.14 (p. ej. fluorosis, color del metal)
  observaciones    text,              -- 5.15
  anulado_at       timestamptz,
  anulado_por      uuid references public.usuario (id),
  motivo_anulacion text,
  created_at       timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id)   references public.paciente (clinica_id, id),
  foreign key (clinica_id, odontologo_id) references public.usuario (clinica_id, id),
  constraint odontograma_anulacion_completa check ((anulado_at is null) = (motivo_anulacion is null))
);

create table public.odontograma_hallazgo (
  id               uuid primary key default gen_random_uuid(),
  clinica_id       uuid not null,
  odontograma_id   uuid not null,
  hallazgo_codigo  text not null references public.catalogo_hallazgo (codigo),
  pieza            smallint check (pieza is null or privado.es_pieza_fdi(pieza)),
  pieza_hasta      smallint check (pieza_hasta is null or privado.es_pieza_fdi(pieza_hasta)),
  arcada           text check (arcada in ('superior', 'inferior')),
  superficies      text[] check (superficies <@ array['vestibular', 'palatino', 'lingual', 'mesial', 'distal', 'oclusal', 'incisal']),
  siglas           text[] not null default '{}',
  estado           public.estado_hallazgo,
  grado            smallint check (grado >= 1),     -- movilidad: "M" + grado
  especificacion   text,
  cie10            text check (cie10 ~ '^[A-Z]\d{2}(\.\d{1,2})?$'),
  anulado_at       timestamptz,
  anulado_por      uuid references public.usuario (id),
  motivo_anulacion text,
  created_at       timestamptz not null default now(),
  foreign key (clinica_id, odontograma_id) references public.odontograma (clinica_id, id),
  constraint hallazgo_anulacion_completa check ((anulado_at is null) = (motivo_anulacion is null))
);

-- Valida el hallazgo contra el catálogo NTS 188 (forma, siglas, estado/color).
create function privado.validar_hallazgo() returns trigger
language plpgsql set search_path = '' as $$
declare
  c public.catalogo_hallazgo;
begin
  select * into c from public.catalogo_hallazgo where codigo = new.hallazgo_codigo;

  -- Forma según el ámbito
  if c.ambito in ('pieza', 'superficie') then
    if new.pieza is null or new.pieza_hasta is not null or new.arcada is not null then
      raise exception '%: requiere una sola pieza', c.nombre;
    end if;
  elsif c.ambito in ('rango', 'entre_piezas') then
    if new.pieza is null or new.pieza_hasta is null or new.pieza = new.pieza_hasta
       or privado.es_pieza_superior(new.pieza) <> privado.es_pieza_superior(new.pieza_hasta) then
      raise exception '%: requiere dos piezas distintas de la misma arcada', c.nombre;
    end if;
  elsif c.ambito = 'arcada' then
    if new.arcada is null or new.pieza is not null or new.pieza_hasta is not null then
      raise exception '%: requiere solo la arcada (superior o inferior)', c.nombre;
    end if;
  end if;

  if c.ambito = 'superficie' then
    if coalesce(cardinality(new.superficies), 0) = 0 then
      raise exception '%: indique al menos una superficie', c.nombre;
    end if;
  elsif new.superficies is not null then
    raise exception '%: no se registra por superficie', c.nombre;
  end if;

  -- Siglas oficiales
  if not (new.siglas <@ c.siglas) then
    raise exception '%: siglas permitidas %', c.nombre, c.siglas;
  end if;
  if c.sigla_obligatoria and cardinality(new.siglas) = 0 then
    raise exception '%: falta la sigla', c.nombre;
  end if;
  if not c.multiples_siglas and cardinality(new.siglas) > 1 then
    raise exception '%: solo admite una sigla', c.nombre;
  end if;

  -- Estado: solo si el color depende de él (azul bueno / rojo malo)
  if c.color = 'segun_estado' and new.estado is null then
    raise exception '%: indique buen o mal estado', c.nombre;
  elsif c.color <> 'segun_estado' and new.estado is not null then
    raise exception '%: tiene color fijo (%), no lleva estado', c.nombre, c.color;
  end if;

  if c.requiere_grado <> (new.grado is not null) then
    raise exception '%: grado %', c.nombre, case when c.requiere_grado then 'obligatorio' else 'no aplica' end;
  end if;

  return new;
end $$;
create trigger validar before insert on public.odontograma_hallazgo
  for each row execute function privado.validar_hallazgo();

-- Color a dibujar (solo azul o rojo, 5.13)
create view public.v_hallazgo as
select h.*, c.nombre, c.numeral,
       case c.color when 'segun_estado'
         then case h.estado when 'bueno' then 'azul' else 'rojo' end
         else c.color end as color
from public.odontograma_hallazgo h
join public.catalogo_hallazgo c on c.codigo = h.hallazgo_codigo;
alter view public.v_hallazgo set (security_invoker = true);

-- ---------------------------------------------------------------------------
-- Plan de tratamiento (núcleo)
-- version: 1, 2, 3… del mismo plan; alternativa: 'A', 'B'… presentadas a la vez.
-- ---------------------------------------------------------------------------
create table public.plan_tratamiento (
  id                 uuid primary key default gen_random_uuid(),
  clinica_id         uuid not null,
  paciente_id        uuid not null,
  odontologo_id      uuid not null,
  titulo             text not null,
  plan_origen_id     uuid,
  version            smallint not null default 1 check (version >= 1),
  alternativa        char(1) not null default 'A' check (alternativa ~ '^[A-Z]$'),
  estado             public.estado_plan not null default 'propuesto',
  motivo_rechazo     text,
  presentado_at      timestamptz not null default now(),
  fecha_vencimiento  date,
  aceptado_at        timestamptz,
  terminado_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id)    references public.paciente (clinica_id, id),
  foreign key (clinica_id, odontologo_id)  references public.usuario (clinica_id, id),
  foreign key (clinica_id, plan_origen_id) references public.plan_tratamiento (clinica_id, id),
  constraint plan_rechazo_con_motivo check (estado <> 'rechazado' or motivo_rechazo is not null)
);

alter table public.odontograma
  add foreign key (clinica_id, plan_id) references public.plan_tratamiento (clinica_id, id);

create table public.nota_evolucion (
  id               uuid primary key default gen_random_uuid(),
  clinica_id       uuid not null,
  paciente_id      uuid not null,
  odontologo_id    uuid not null,
  texto            text not null,
  cie10            text check (cie10 ~ '^[A-Z]\d{2}(\.\d{1,2})?$'),
  fecha            timestamptz not null default now(),
  anulado_at       timestamptz,
  anulado_por      uuid references public.usuario (id),
  motivo_anulacion text,
  created_at       timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id)   references public.paciente (clinica_id, id),
  foreign key (clinica_id, odontologo_id) references public.usuario (clinica_id, id),
  constraint nota_anulacion_completa check ((anulado_at is null) = (motivo_anulacion is null))
);

create table public.item_plan (
  id                 uuid primary key default gen_random_uuid(),
  clinica_id         uuid not null,
  plan_id            uuid not null,
  pieza              smallint check (pieza is null or privado.es_pieza_fdi(pieza)),
  superficies        text[] check (superficies <@ array['vestibular', 'palatino', 'lingual', 'mesial', 'distal', 'oclusal', 'incisal']),
  procedimiento      text not null,
  cie10              text check (cie10 ~ '^[A-Z]\d{2}(\.\d{1,2})?$'),
  precio_centimos    integer not null check (precio_centimos >= 0),
  odontologo_id      uuid not null,
  estado             public.estado_item not null default 'propuesto',
  nota_evolucion_id  uuid,
  realizado_at       timestamptz,
  motivo_cancelacion text,
  orden              smallint not null default 1,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, plan_id)           references public.plan_tratamiento (clinica_id, id),
  foreign key (clinica_id, odontologo_id)     references public.usuario (clinica_id, id),
  foreign key (clinica_id, nota_evolucion_id) references public.nota_evolucion (clinica_id, id),
  -- Regla 1a: realizado => nota de evolución (la regla 1b, cobrado => pago, se cumple
  -- por construcción: "cobrado" se calcula desde pago_aplicacion)
  constraint item_realizado_con_nota check (estado <> 'realizado' or (nota_evolucion_id is not null and realizado_at is not null)),
  constraint item_cancelado_con_motivo check (estado <> 'cancelado' or motivo_cancelacion is not null)
);

-- Solo un cirujano dentista marca "realizado", con una nota del mismo paciente.
-- Un ítem realizado no vuelve atrás.
create function privado.validar_item() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.estado = 'realizado' and new.estado <> 'realizado' then
    raise exception 'Un ítem realizado no puede cambiar de estado';
  end if;
  if new.estado = 'realizado' and (tg_op = 'INSERT' or old.estado <> 'realizado') then
    if not privado.es_dentista() then
      raise exception 'Solo un cirujano dentista puede marcar un ítem como realizado';
    end if;
    if not exists (
      select 1 from public.nota_evolucion n
      join public.plan_tratamiento p on p.id = new.plan_id
      where n.id = new.nota_evolucion_id and n.paciente_id = p.paciente_id and n.anulado_at is null
    ) then
      raise exception 'La nota de evolución debe ser del mismo paciente y estar vigente';
    end if;
  end if;
  return new;
end $$;
create trigger validar before insert or update on public.item_plan
  for each row execute function privado.validar_item();

-- ---------------------------------------------------------------------------
-- Cuotas y pagos
--   pago            = un movimiento de dinero con UN método (Yape, efectivo…).
--                     Pago mixto = varios pagos.
--   pago_aplicacion = cómo se reparte ese pago entre ítems y/o cuotas.
--                     Lo no aplicado queda como adelanto del plan.
--   Nada se edita: para corregir se anula el pago y se registra de nuevo.
-- ---------------------------------------------------------------------------
create table public.cuota (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null,
  plan_id         uuid not null,
  numero          smallint not null check (numero >= 1),
  monto_centimos  integer not null check (monto_centimos > 0),
  vence_el        date not null,
  created_at      timestamptz not null default now(),
  unique (clinica_id, id),
  unique (plan_id, numero),
  foreign key (clinica_id, plan_id) references public.plan_tratamiento (clinica_id, id)
);

create table public.pago (
  id               uuid primary key default gen_random_uuid(),
  clinica_id       uuid not null,
  plan_id          uuid not null,
  monto_centimos   integer not null check (monto_centimos > 0),
  metodo           public.metodo_pago not null,
  pagado_at        timestamptz not null default now(),
  referencia       text,              -- nº de operación Yape/Plin/transferencia/voucher
  registrado_por   uuid not null,
  anulado_at       timestamptz,
  anulado_por      uuid references public.usuario (id),
  motivo_anulacion text,
  created_at       timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, plan_id)        references public.plan_tratamiento (clinica_id, id),
  foreign key (clinica_id, registrado_por) references public.usuario (clinica_id, id),
  constraint pago_anulacion_completa check ((anulado_at is null) = (motivo_anulacion is null))
);

create table public.pago_aplicacion (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null,
  pago_id         uuid not null,
  item_plan_id    uuid,
  cuota_id        uuid,
  monto_centimos  integer not null check (monto_centimos > 0),
  created_at      timestamptz not null default now(),
  foreign key (clinica_id, pago_id)      references public.pago (clinica_id, id),
  foreign key (clinica_id, item_plan_id) references public.item_plan (clinica_id, id),
  foreign key (clinica_id, cuota_id)     references public.cuota (clinica_id, id),
  constraint aplicacion_con_destino check (item_plan_id is not null or cuota_id is not null)
);

-- Evita sobreaplicar: pago, ítem y cuota nunca reciben más de su monto.
-- Bloquea las filas involucradas para que dos cajas a la vez no se pisen.
create function privado.validar_aplicacion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_pago  public.pago;
  v_item  public.item_plan;
  v_cuota public.cuota;
begin
  select * into v_pago from public.pago where id = new.pago_id for update;
  if v_pago.anulado_at is not null then
    raise exception 'El pago está anulado';
  end if;
  if (select coalesce(sum(monto_centimos), 0) from public.pago_aplicacion where pago_id = new.pago_id)
     + new.monto_centimos > v_pago.monto_centimos then
    raise exception 'La aplicación excede el monto del pago';
  end if;

  if new.item_plan_id is not null then
    select * into v_item from public.item_plan where id = new.item_plan_id for update;
    if v_item.plan_id <> v_pago.plan_id then
      raise exception 'El ítem no pertenece al plan del pago';
    end if;
    if v_item.estado = 'cancelado' then
      raise exception 'No se puede cobrar un ítem cancelado';
    end if;
    if (select coalesce(sum(a.monto_centimos), 0) from public.pago_aplicacion a
        join public.pago p on p.id = a.pago_id
        where a.item_plan_id = new.item_plan_id and p.anulado_at is null)
       + new.monto_centimos > v_item.precio_centimos then
      raise exception 'El cobro excede el precio del ítem';
    end if;
  end if;

  if new.cuota_id is not null then
    select * into v_cuota from public.cuota where id = new.cuota_id for update;
    if v_cuota.plan_id <> v_pago.plan_id then
      raise exception 'La cuota no pertenece al plan del pago';
    end if;
    if (select coalesce(sum(a.monto_centimos), 0) from public.pago_aplicacion a
        join public.pago p on p.id = a.pago_id
        where a.cuota_id = new.cuota_id and p.anulado_at is null)
       + new.monto_centimos > v_cuota.monto_centimos then
      raise exception 'El pago excede el saldo de la cuota';
    end if;
  end if;

  return new;
end $$;
create trigger validar before insert on public.pago_aplicacion
  for each row execute function privado.validar_aplicacion();

-- El precio de un ítem no puede bajar de lo ya cobrado.
create function privado.validar_precio_item() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.precio_centimos < (select coalesce(sum(a.monto_centimos), 0) from public.pago_aplicacion a
                            join public.pago p on p.id = a.pago_id
                            where a.item_plan_id = new.id and p.anulado_at is null) then
    raise exception 'El precio no puede ser menor a lo ya cobrado';
  end if;
  return new;
end $$;
create trigger validar_precio before update of precio_centimos on public.item_plan
  for each row execute function privado.validar_precio_item();

-- Saldos calculados (pagos anulados no cuentan)
create view public.v_item_cobro with (security_invoker = true) as
select i.id as item_plan_id, i.clinica_id, i.plan_id, i.estado, i.precio_centimos,
       coalesce(sum(a.monto_centimos) filter (where p.anulado_at is null), 0)::integer as cobrado_centimos,
       (i.precio_centimos - coalesce(sum(a.monto_centimos) filter (where p.anulado_at is null), 0))::integer as saldo_centimos,
       case
         when coalesce(sum(a.monto_centimos) filter (where p.anulado_at is null), 0) = 0 then 'pendiente'
         when coalesce(sum(a.monto_centimos) filter (where p.anulado_at is null), 0) < i.precio_centimos then 'parcial'
         else 'cobrado'
       end as estado_cobro
from public.item_plan i
left join public.pago_aplicacion a on a.item_plan_id = i.id
left join public.pago p on p.id = a.pago_id
group by i.id;

create view public.v_cuota_saldo with (security_invoker = true) as
select c.id as cuota_id, c.clinica_id, c.plan_id, c.numero, c.vence_el, c.monto_centimos,
       coalesce(sum(a.monto_centimos) filter (where p.anulado_at is null), 0)::integer as pagado_centimos,
       (c.monto_centimos - coalesce(sum(a.monto_centimos) filter (where p.anulado_at is null), 0))::integer as saldo_centimos,
       (c.vence_el < (now() at time zone 'America/Lima')::date
        and c.monto_centimos > coalesce(sum(a.monto_centimos) filter (where p.anulado_at is null), 0)) as vencida
from public.cuota c
left join public.pago_aplicacion a on a.cuota_id = c.id
left join public.pago p on p.id = a.pago_id
group by c.id;

-- ---------------------------------------------------------------------------
-- Citas (N:M con item_plan)
-- ---------------------------------------------------------------------------
create table public.cita (
  id             uuid primary key default gen_random_uuid(),
  clinica_id     uuid not null,
  paciente_id    uuid not null,
  odontologo_id  uuid not null,
  inicio         timestamptz not null,
  fin            timestamptz not null,
  estado         public.estado_cita not null default 'programada',
  nota           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id)   references public.paciente (clinica_id, id),
  foreign key (clinica_id, odontologo_id) references public.usuario (clinica_id, id),
  check (fin > inicio)
);

create table public.cita_item (
  clinica_id    uuid not null,
  cita_id       uuid not null,
  item_plan_id  uuid not null,
  primary key (cita_id, item_plan_id),
  foreign key (clinica_id, cita_id)      references public.cita (clinica_id, id),
  foreign key (clinica_id, item_plan_id) references public.item_plan (clinica_id, id)
);

-- ---------------------------------------------------------------------------
-- Seguimiento y plantillas de WhatsApp (wa.me)
-- ---------------------------------------------------------------------------
create table public.plantilla_mensaje (
  id          uuid primary key default gen_random_uuid(),
  clinica_id  uuid not null references public.clinica (id),
  tipo        public.tipo_seguimiento not null,
  nombre      text not null,
  cuerpo      text not null,          -- con variables {{nombre}}, {{monto}}, …
  activa      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (clinica_id, id)
);

create table public.seguimiento (
  id                uuid primary key default gen_random_uuid(),
  clinica_id        uuid not null,
  paciente_id       uuid not null,
  plan_id           uuid,
  cuota_id          uuid,
  tipo              public.tipo_seguimiento not null,
  fecha_programada  date not null,
  resultado         public.resultado_seguimiento not null default 'pendiente',
  nota              text,
  plantilla_id      uuid,
  mensaje_enviado   text,
  realizado_at      timestamptz,
  realizado_por     uuid references public.usuario (id),
  created_at        timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id)  references public.paciente (clinica_id, id),
  foreign key (clinica_id, plan_id)      references public.plan_tratamiento (clinica_id, id),
  foreign key (clinica_id, cuota_id)     references public.cuota (clinica_id, id),
  foreign key (clinica_id, plantilla_id) references public.plantilla_mensaje (clinica_id, id)
);

-- ---------------------------------------------------------------------------
-- Auditoría (solo la escriben triggers)
-- ---------------------------------------------------------------------------
create table public.auditoria (
  id          bigint generated always as identity primary key,
  clinica_id  uuid not null references public.clinica (id),
  tabla       text not null,
  registro_id uuid not null,
  accion      text not null check (accion in ('insert', 'update', 'anular')),
  usuario_id  uuid,
  antes       jsonb,
  despues     jsonb,
  ocurrido_at timestamptz not null default now()
);

-- Para tablas con columnas de anulación
create function privado.auditar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_accion text := lower(tg_op);
begin
  if tg_op = 'UPDATE' and old.anulado_at is null and new.anulado_at is not null then
    v_accion := 'anular';
  end if;
  insert into public.auditoria (clinica_id, tabla, registro_id, accion, usuario_id, antes, despues)
  values (new.clinica_id, tg_table_name, new.id, v_accion, auth.uid(),
          case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new));
  return new;
end $$;
-- Para tablas sin anulación: solo insert/update
create function privado.auditar_simple() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.auditoria (clinica_id, tabla, registro_id, accion, usuario_id, antes, despues)
  values (new.clinica_id, tg_table_name, new.id, lower(tg_op), auth.uid(),
          case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new));
  return new;
end $$;

create trigger auditar after insert or update on public.paciente             for each row execute function privado.auditar();
create trigger auditar after insert or update on public.odontograma          for each row execute function privado.auditar();
create trigger auditar after insert or update on public.odontograma_hallazgo for each row execute function privado.auditar();
create trigger auditar after insert or update on public.nota_evolucion       for each row execute function privado.auditar();
create trigger auditar after insert or update on public.pago                 for each row execute function privado.auditar();
create trigger auditar after insert            on public.pago_aplicacion     for each row execute function privado.auditar_simple();
create trigger auditar after insert or update on public.plan_tratamiento     for each row execute function privado.auditar_simple();
create trigger auditar after insert or update on public.item_plan            for each row execute function privado.auditar_simple();
create trigger auditar after insert or update on public.cuota                for each row execute function privado.auditar_simple();
create trigger auditar after insert or update on public.usuario              for each row execute function privado.auditar_simple();

-- ---------------------------------------------------------------------------
-- Reglas de negocio en la base
-- ---------------------------------------------------------------------------
-- Regla 3: al terminar un plan se crea un seguimiento de control a 6 meses.
create function privado.crear_control_al_terminar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.estado = 'terminado' and old.estado is distinct from 'terminado' then
    new.terminado_at := coalesce(new.terminado_at, now());
    insert into public.seguimiento (clinica_id, paciente_id, plan_id, tipo, fecha_programada)
    values (new.clinica_id, new.paciente_id, new.id, 'control',
            ((new.terminado_at at time zone 'America/Lima')::date + interval '6 months')::date);
  end if;
  return new;
end $$;
create trigger control_al_terminar before update of estado on public.plan_tratamiento
  for each row execute function privado.crear_control_al_terminar();

-- Regla 4: plan detenido = ítems aceptados sin realizar y sin cita en 30 días.
create view public.v_plan_detenido with (security_invoker = true) as
select p.id as plan_id, p.clinica_id, p.paciente_id,
       sum(i.precio_centimos)::bigint as valor_pendiente_centimos
from public.plan_tratamiento p
join public.item_plan i on i.plan_id = p.id and i.estado in ('aceptado', 'programado')
where p.estado in ('aceptado', 'en_curso', 'detenido')
  and not exists (
    select 1 from public.cita_item ci
    join public.cita c on c.id = ci.cita_id
    join public.item_plan i2 on i2.id = ci.item_plan_id
    where i2.plan_id = p.id
      and c.estado in ('programada', 'confirmada')
      and c.inicio between now() and now() + interval '30 days'
  )
group by p.id, p.clinica_id, p.paciente_id;

-- Anulación de una sola vía: solo se pasa de vigente a anulado, una vez, y
-- registra quién la hizo. Complementa los GRANT por columna.
create function privado.solo_anular() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.anulado_at is not null then
    raise exception 'El registro ya está anulado y no puede modificarse';
  end if;
  if new.anulado_at is null or new.anulado_por is distinct from auth.uid() then
    raise exception 'Solo se permite anular el registro (con motivo, a nombre propio)';
  end if;
  return new;
end $$;
create trigger solo_anular before update on public.odontograma          for each row execute function privado.solo_anular();
create trigger solo_anular before update on public.odontograma_hallazgo for each row execute function privado.solo_anular();
create trigger solo_anular before update on public.nota_evolucion       for each row execute function privado.solo_anular();
create trigger solo_anular before update on public.pago                 for each row execute function privado.solo_anular();

-- updated_at
create function privado.tocar_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger updated_at before update on public.paciente          for each row execute function privado.tocar_updated_at();
create trigger updated_at before update on public.plan_tratamiento  for each row execute function privado.tocar_updated_at();
create trigger updated_at before update on public.item_plan         for each row execute function privado.tocar_updated_at();
create trigger updated_at before update on public.cita              for each row execute function privado.tocar_updated_at();
create trigger updated_at before update on public.plantilla_mensaje for each row execute function privado.tocar_updated_at();

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
create index on public.usuario (clinica_id);
create index on public.paciente (clinica_id, apellidos);
create index on public.odontograma (paciente_id);
create index on public.odontograma_hallazgo (odontograma_id);
create index on public.plan_tratamiento (clinica_id, estado, presentado_at);
create index on public.plan_tratamiento (paciente_id);
create index on public.item_plan (plan_id, estado);
create index on public.nota_evolucion (paciente_id);
create index on public.cuota (clinica_id, vence_el);
create index on public.pago (plan_id);
create index on public.pago_aplicacion (pago_id);
create index on public.pago_aplicacion (item_plan_id);
create index on public.pago_aplicacion (cuota_id);
create index on public.cita (clinica_id, inicio);
create index on public.cita (paciente_id);
create index on public.cita_item (item_plan_id);
create index on public.seguimiento (clinica_id, resultado, fecha_programada);
create index on public.auditoria (clinica_id, tabla, registro_id);

-- ---------------------------------------------------------------------------
-- RLS — (select privado.fn()) se evalúa una vez por consulta.
-- ---------------------------------------------------------------------------
alter table public.clinica              enable row level security;
alter table public.usuario              enable row level security;
alter table public.paciente             enable row level security;
alter table public.catalogo_hallazgo    enable row level security;
alter table public.odontograma          enable row level security;
alter table public.odontograma_hallazgo enable row level security;
alter table public.plan_tratamiento     enable row level security;
alter table public.nota_evolucion       enable row level security;
alter table public.item_plan            enable row level security;
alter table public.cuota                enable row level security;
alter table public.pago                 enable row level security;
alter table public.pago_aplicacion      enable row level security;
alter table public.cita                 enable row level security;
alter table public.cita_item            enable row level security;
alter table public.plantilla_mensaje    enable row level security;
alter table public.seguimiento          enable row level security;
alter table public.auditoria            enable row level security;

-- clinica: ver la propia; solo admin edita
create policy clinica_select on public.clinica for select to authenticated
  using (id = (select privado.clinica_actual()));
create policy clinica_update on public.clinica for update to authenticated
  using (id = (select privado.clinica_actual()) and (select privado.rol_actual()) = 'admin')
  with check (id = (select privado.clinica_actual()));

-- usuario: todos ven a su equipo; solo admin edita. El alta se hace en el
-- servidor (invitación con service_role), nunca desde el navegador.
create policy usuario_select on public.usuario for select to authenticated
  using (clinica_id = (select privado.clinica_actual()));
create policy usuario_update on public.usuario for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) = 'admin')
  with check (clinica_id = (select privado.clinica_actual()));

-- catálogo NTS 188: lectura para todos
create policy catalogo_select on public.catalogo_hallazgo for select to authenticated using (true);

-- Tablas operativas de la clínica (todos los roles leen y escriben)
do $$
declare t text;
begin
  foreach t in array array['paciente', 'plan_tratamiento', 'item_plan', 'cuota',
                           'cita', 'cita_item', 'seguimiento', 'plantilla_mensaje']
  loop
    execute format($f$
      create policy %1$s_select on public.%1$I for select to authenticated
        using (clinica_id = (select privado.clinica_actual()));
      create policy %1$s_insert on public.%1$I for insert to authenticated
        with check (clinica_id = (select privado.clinica_actual()));
      create policy %1$s_update on public.%1$I for update to authenticated
        using (clinica_id = (select privado.clinica_actual()))
        with check (clinica_id = (select privado.clinica_actual()));
    $f$, t);
  end loop;
end $$;
create policy cita_item_delete on public.cita_item for delete to authenticated
  using (clinica_id = (select privado.clinica_actual()));

-- Datos clínicos: solo cirujanos dentistas (admin u odontólogo con COP).
-- Recepción no ve odontograma ni notas. Cada dentista firma lo suyo.
create policy odontograma_select on public.odontograma for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista()));
create policy odontograma_insert on public.odontograma for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista())
              and odontologo_id = (select auth.uid()));
create policy odontograma_anular on public.odontograma for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista()))
  with check (clinica_id = (select privado.clinica_actual()) and anulado_por = (select auth.uid()));

create policy hallazgo_select on public.odontograma_hallazgo for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista()));
create policy hallazgo_insert on public.odontograma_hallazgo for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista())
              and exists (select 1 from public.odontograma o
                          where o.id = odontograma_id and o.odontologo_id = (select auth.uid())
                            and o.anulado_at is null));
create policy hallazgo_anular on public.odontograma_hallazgo for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista()))
  with check (clinica_id = (select privado.clinica_actual()) and anulado_por = (select auth.uid()));

create policy nota_select on public.nota_evolucion for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista()));
create policy nota_insert on public.nota_evolucion for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista())
              and odontologo_id = (select auth.uid()));
create policy nota_anular on public.nota_evolucion for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista()))
  with check (clinica_id = (select privado.clinica_actual()) and anulado_por = (select auth.uid()));

-- Pagos: todos leen; registran y anulan admin y recepción
create policy pago_select on public.pago for select to authenticated
  using (clinica_id = (select privado.clinica_actual()));
create policy pago_insert on public.pago for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual())
              and (select privado.rol_actual()) in ('admin', 'recepcion')
              and registrado_por = (select auth.uid()));
create policy pago_anular on public.pago for update to authenticated
  using (clinica_id = (select privado.clinica_actual())
         and (select privado.rol_actual()) in ('admin', 'recepcion'))
  with check (clinica_id = (select privado.clinica_actual()) and anulado_por = (select auth.uid()));

create policy aplicacion_select on public.pago_aplicacion for select to authenticated
  using (clinica_id = (select privado.clinica_actual()));
create policy aplicacion_insert on public.pago_aplicacion for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual())
              and (select privado.rol_actual()) in ('admin', 'recepcion'));

-- Auditoría: solo lectura para admin
create policy auditoria_select on public.auditoria for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) = 'admin');

-- ---------------------------------------------------------------------------
-- GRANTs explícitos (no dependemos de los default privileges)
-- Sin DELETE salvo cita_item. En datos clínicos y pagos el UPDATE solo
-- alcanza las columnas de anulación (hallazgo inalterable, NTS 188 5.6).
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema privado from public, anon;
grant execute on function privado.clinica_actual(), privado.rol_actual(), privado.es_dentista(),
  privado.es_pieza_fdi(smallint), privado.es_pieza_superior(smallint) to authenticated;

grant usage on schema public to authenticated;

grant select                 on public.catalogo_hallazgo    to authenticated;
grant select                 on public.clinica              to authenticated;
grant update (nombre, ruc)   on public.clinica              to authenticated;
grant select                 on public.usuario              to authenticated;
grant update (nombre, rol, cop, activo) on public.usuario   to authenticated;
grant select, insert, update on public.paciente             to authenticated;

grant select, insert         on public.odontograma          to authenticated;
grant update (anulado_at, anulado_por, motivo_anulacion) on public.odontograma          to authenticated;
grant select, insert         on public.odontograma_hallazgo to authenticated;
grant update (anulado_at, anulado_por, motivo_anulacion) on public.odontograma_hallazgo to authenticated;
grant select, insert         on public.nota_evolucion       to authenticated;
grant update (anulado_at, anulado_por, motivo_anulacion) on public.nota_evolucion       to authenticated;

grant select, insert, update on public.plan_tratamiento     to authenticated;
grant select, insert, update on public.item_plan            to authenticated;
grant select, insert, update on public.cuota                to authenticated;

grant select, insert         on public.pago                 to authenticated;
grant update (anulado_at, anulado_por, motivo_anulacion) on public.pago                 to authenticated;
grant select, insert         on public.pago_aplicacion      to authenticated;

grant select, insert, update on public.cita                 to authenticated;
grant select, insert, delete on public.cita_item            to authenticated;
grant select, insert, update on public.plantilla_mensaje    to authenticated;
grant select, insert, update on public.seguimiento          to authenticated;
grant select                 on public.auditoria            to authenticated;

grant select on public.v_hallazgo, public.v_item_cobro, public.v_cuota_saldo, public.v_plan_detenido
  to authenticated;
