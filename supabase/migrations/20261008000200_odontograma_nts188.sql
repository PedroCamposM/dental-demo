-- Odontograma según NTS 188-MINSA/DGIESP-2022
-- Origen: docs/propuesta-esquema.sql (v2, aprobada).

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

-- RLS activado desde el inicio: sin políticas, nadie lee ni escribe.
alter table public.catalogo_hallazgo enable row level security;
alter table public.odontograma enable row level security;
alter table public.odontograma_hallazgo enable row level security;
