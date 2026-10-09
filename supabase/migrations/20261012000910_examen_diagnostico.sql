-- Etapa 4 (v2), parte 1: catálogo CIE-10, examen clínico, diagnóstico y dentición
-- del odontograma. Aditiva: tablas y una columna nuevas; la fusión se amplía.
--
-- Regla 1: nada clínico se borra (examen y diagnóstico se anulan con motivo).
-- Regla 2: el diagnóstico registrado no se edita; solo admite adendas.
-- Regla 9: lo ven dentistas y asistente; lo registra solo el cirujano dentista.
-- Regla 10: los códigos CIE-10 vienen de una fuente publicada (ver catálogo).

-- ---------------------------------------------------------------------------
-- Catálogo CIE-10 (global, solo lectura)
-- Fuente: paquete npm `cie10` 0.0.2 (MIT), «Códigos CIE-10 (Clasificación
-- internacional de enfermedades, décima versión)». Se toma el capítulo K00–K14
-- (cavidad bucal, glándulas salivales y maxilares) y algunos códigos de uso
-- odontológico (S02.5, S03.2, Z01.2, Z46.3, Z46.4, B37.0, B00.2, A69.0). Solo se
-- restituyeron las tildes que la fuente omite; los textos no se cambiaron.
-- `es_categoria`: código de tres caracteres; si tiene subcódigos, se usa uno de ellos.
-- ---------------------------------------------------------------------------
create table public.catalogo_cie10 (
  codigo       text primary key check (codigo ~ '^[A-Z]\d{2}(\.\d)?$'),
  descripcion  text not null,
  es_categoria boolean not null
);
insert into public.catalogo_cie10 (codigo, descripcion, es_categoria) values
  ('K00', 'Trastornos del desarrollo y de la erupción de los dientes', true),
  ('K00.0', 'Anodoncia', false),
  ('K00.1', 'Dientes supernumerarios', false),
  ('K00.2', 'Anomalías del tamaño y de la forma del diente', false),
  ('K00.3', 'Dientes moteados', false),
  ('K00.4', 'Alteraciones en la formación dentaria', false),
  ('K00.5', 'Alteraciones hereditarias de la estructura dentaria, no clasificadas en otra parte', false),
  ('K00.6', 'Alteraciones en la erupción dentaria', false),
  ('K00.7', 'Síndrome de la erupción dentaria', false),
  ('K00.8', 'Otros trastornos del desarrollo de los dientes', false),
  ('K00.9', 'Trastorno del desarrollo de los dientes, no especificado', false),
  ('K01', 'Dientes incluidos e impactados', true),
  ('K01.0', 'Dientes incluidos', false),
  ('K01.1', 'Dientes impactados', false),
  ('K02', 'Caries dental', true),
  ('K02.0', 'Caries limitada al esmalte', false),
  ('K02.1', 'Caries de la dentina', false),
  ('K02.2', 'Caries del cemento', false),
  ('K02.3', 'Caries dentaria detenida', false),
  ('K02.4', 'Odontoclasia', false),
  ('K02.8', 'Otras caries dentales', false),
  ('K02.9', 'Caries dental, no especificada', false),
  ('K03', 'Otras enfermedades de los tejidos duros de los dientes', true),
  ('K03.0', 'Atrición excesiva de los dientes', false),
  ('K03.1', 'Abrasión de los dientes', false),
  ('K03.2', 'Erosión de los dientes', false),
  ('K03.3', 'Reabsorción patológica de los dientes', false),
  ('K03.4', 'Hipercementosis', false),
  ('K03.5', 'Anquilosis dental', false),
  ('K03.6', 'Depósitos [acreciones] en los dientes', false),
  ('K03.7', 'Cambios posteruptivos del color de los tejidos dentales duros', false),
  ('K03.8', 'Otras enfermedades especificadas de los tejidos duros de los dientes', false),
  ('K03.9', 'Enfermedad no especificada de los tejidos dentales duros', false),
  ('K04', 'Enfermedades de la pulpa y de los tejidos periapicales', true),
  ('K04.0', 'Pulpitis', false),
  ('K04.1', 'Necrosis de la pulpa', false),
  ('K04.2', 'Degeneración de la pulpa', false),
  ('K04.3', 'Formación anormal de tejido duro en la pulpa', false),
  ('K04.4', 'Periodontitis apical aguda originada en la pulpa', false),
  ('K04.5', 'Periodontitis apical crónica', false),
  ('K04.6', 'Absceso periapical con fístula', false),
  ('K04.7', 'Absceso periapical sin fístula', false),
  ('K04.8', 'Quiste radicular', false),
  ('K04.9', 'Otras enfermedades y las no especificadas de la pulpa y del tejido periapical', false),
  ('K05', 'Gingivitis y enfermedades periodontales', true),
  ('K05.0', 'Gingivitis aguda', false),
  ('K05.1', 'Gingivitis crónica', false),
  ('K05.2', 'Periodontitis aguda', false),
  ('K05.3', 'Periodontitis crónica', false),
  ('K05.4', 'Periodontosis', false),
  ('K05.5', 'Otras enfermedades periodontales', false),
  ('K05.6', 'Enfermedad de periodonto, no especificada', false),
  ('K06', 'Otros trastornos de la encía y de la zona edéntula', true),
  ('K06.0', 'Retracción gingival', false),
  ('K06.1', 'Hiperplasia gingival', false),
  ('K06.2', 'Lesiones de la encía y de la zona edéntula asociadas con traumatismo', false),
  ('K06.8', 'Otros trastornos especificados de la encía y de la zona edéntula', false),
  ('K06.9', 'Trastorno no especificado de la encía y de la zona edéntula', false),
  ('K07', 'Anomalías dentofaciales [incluso la maloclusión]', true),
  ('K07.0', 'Anomalías evidentes del tamaño de los maxilares', false),
  ('K07.1', 'Anomalías de la relación maxilobasilar', false),
  ('K07.2', 'Anomalías de la relación entre los arcos dentarios', false),
  ('K07.3', 'Anomalías de la posición del diente', false),
  ('K07.4', 'Maloclusión de tipo no especificado', false),
  ('K07.5', 'Anomalías dentofaciales funcionales', false),
  ('K07.6', 'Trastornos de la articulación temporomaxilar', false),
  ('K07.8', 'Otras anomalías dentofaciales', false),
  ('K07.9', 'Anomalía dentofacial, no especificada', false),
  ('K08', 'Otros trastornos de los dientes y de sus estructuras de sostén', true),
  ('K08.0', 'Exfoliación de los dientes debida a causas sistémicas', false),
  ('K08.1', 'Pérdida de dientes debida a accidente, extracción o enfermedad periodontal local', false),
  ('K08.2', 'Atrofia de reborde alveolar desdentado', false),
  ('K08.3', 'Raíz dental retenida', false),
  ('K08.8', 'Otras afecciones especificadas de los dientes y de sus estructuras de sostén', false),
  ('K08.9', 'Trastorno de los dientes y de sus estructuras de sostén, no especificado', false),
  ('K09', 'Quistes de la región bucal no clasificadas en otra parte', true),
  ('K09.0', 'Quistes originados por el desarrollo de los dientes', false),
  ('K09.1', 'Quistes de las fisuras (no odontogénicos)', false),
  ('K09.2', 'Otros quistes de los maxilares', false),
  ('K09.8', 'Otros quistes de la región bucal, no clasificados en otra parte', false),
  ('K09.9', 'Quiste de la región bucal, sin otra especificación', false),
  ('K10', 'Otras enfermedades de los maxilares', true),
  ('K10.0', 'Trastornos del desarrollo de los maxilares', false),
  ('K10.1', 'Granuloma central de células gigantes', false),
  ('K10.2', 'Afecciones inflamatorias de los maxilares', false),
  ('K10.3', 'Alveolitis del maxilar', false),
  ('K10.8', 'Otras enfermedades especificadas de los maxilares', false),
  ('K10.9', 'Enfermedad de los maxilares, no especificada', false),
  ('K11', 'Enfermedades de las glándulas salivares', true),
  ('K11.0', 'Atrofia de glándula salival', false),
  ('K11.1', 'Hipertrofia de glándula salival', false),
  ('K11.2', 'Sialadenitis', false),
  ('K11.3', 'Absceso de glándula salival', false),
  ('K11.4', 'Fístula de glándula salival', false),
  ('K11.5', 'Sialolitiasis', false),
  ('K11.6', 'Mucocele de glándula salival', false),
  ('K11.7', 'Alteraciones de la secreción salival', false),
  ('K11.8', 'Otras enfermedades de las glándulas salivales', false),
  ('K11.9', 'Enfermedad de glándula salival, no especificada', false),
  ('K12', 'Estomatitis y lesiones afines', true),
  ('K12.0', 'Estomatitis aftosa recurrente', false),
  ('K12.1', 'Otras formas de estomatitis', false),
  ('K12.2', 'Celulitis y absceso de boca', false),
  ('K13', 'Otras enfermedades de los labios y de la mucosa bucal', true),
  ('K13.0', 'Enfermedades de los labios', false),
  ('K13.1', 'Mordedura del labio y de la mejilla', false),
  ('K13.2', 'Leucoplasia y otras alteraciones del epitelio bucal, incluyendo la lengua', false),
  ('K13.3', 'Leucoplasia pilosa', false),
  ('K13.4', 'Granuloma y lesiones semejantes de la mucosa bucal', false),
  ('K13.5', 'Fibrosis de la submucosa bucal', false),
  ('K13.6', 'Hiperplasia irritativa de la mucosa bucal', false),
  ('K13.7', 'Otras lesiones y las no especificadas de la mucosa bucal', false),
  ('K14', 'Enfermedades de la lengua', true),
  ('K14.0', 'Glositis', false),
  ('K14.1', 'Lengua geográfica', false),
  ('K14.2', 'Glositis romboidea mediana', false),
  ('K14.3', 'Hipertrofia de las papilas linguales', false),
  ('K14.4', 'Atrofia de las papilas linguales', false),
  ('K14.5', 'Lengua plegada', false),
  ('K14.6', 'Glosodinia', false),
  ('K14.8', 'Otras enfermedades de la lengua', false),
  ('K14.9', 'Enfermedad de la lengua, no especificada', false),
  ('A69.0', 'Estomatitis ulcerativa necrotizante', false),
  ('B00.2', 'Gingivoestomatitis y faringoamigdalitis herpética', false),
  ('B37.0', 'Estomatitis candidiásica', false),
  ('S02.5', 'Fractura de los dientes', false),
  ('S03.2', 'Luxación de diente', false),
  ('Z01.2', 'Examen odontológico', false),
  ('Z46.3', 'Prueba y ajuste de prótesis dental', false),
  ('Z46.4', 'Prueba y ajuste de dispositivo ortodóncico', false);

alter table public.catalogo_cie10 enable row level security;
create policy cie10_select on public.catalogo_cie10 for select to authenticated using (true);
revoke all on public.catalogo_cie10 from anon, authenticated;
grant select on public.catalogo_cie10 to authenticated;

-- ---------------------------------------------------------------------------
-- Odontograma: dentición (NTS 188). Los 115 odontogramas existentes ya son
-- «inicial»; se completa la dentición según las piezas registradas y, si no hay
-- piezas, según la edad del paciente a la fecha del odontograma.
-- ---------------------------------------------------------------------------
alter table public.odontograma
  add column denticion text check (denticion in ('permanente', 'temporal', 'mixta'));

create function privado.denticion_por_edad(nacimiento date, fecha date) returns text
language sql immutable set search_path = '' as $$
  select case when nacimiento is null then 'permanente'
              when extract(year from age(fecha, nacimiento)) < 6 then 'temporal'
              when extract(year from age(fecha, nacimiento)) < 12 then 'mixta'
              else 'permanente' end
$$;

-- El odontograma solo admite anulación: el trigger se suspende solo para este relleno.
alter table public.odontograma disable trigger solo_anular;
update public.odontograma o set denticion = coalesce(
  (select case when bool_or(h.pieza / 10 between 5 and 8) and bool_or(h.pieza / 10 between 1 and 4) then 'mixta'
               when bool_or(h.pieza / 10 between 5 and 8) then 'temporal'
               when bool_or(h.pieza / 10 between 1 and 4) then null end
     from public.odontograma_hallazgo h where h.odontograma_id = o.id and h.pieza is not null),
  privado.denticion_por_edad(p.fecha_nacimiento, (o.fecha at time zone 'America/Lima')::date))
from public.paciente p where p.id = o.paciente_id;
alter table public.odontograma enable trigger solo_anular;

-- Si no se indica (código anterior o seed), se completa según la edad.
create function privado.completar_denticion() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.denticion is null then
    new.denticion := privado.denticion_por_edad(
      (select fecha_nacimiento from public.paciente where id = new.paciente_id),
      (new.fecha at time zone 'America/Lima')::date);
  end if;
  return new;
end $$;
create trigger completar_denticion before insert on public.odontograma
  for each row execute function privado.completar_denticion();
alter table public.odontograma alter column denticion set not null;

-- ---------------------------------------------------------------------------
-- Odontograma: ajustes según docs/nts188-resumen.md
-- ---------------------------------------------------------------------------
-- 5.10: también se hace al culminar el plan de tratamiento («alta»).
alter type public.tipo_odontograma add value if not exists 'alta';

-- 6.1.5: el defecto de desarrollo del esmalte se representa solo con su sigla (O o PE).
update public.catalogo_hallazgo set sigla_obligatoria = true where codigo = 'defecto_desarrollo_esmalte';

-- Piezas vecinas en la arcada (FDI): consecutivas en el cuadrante, o los dos
-- incisivos centrales a cada lado de la línea media.
create function privado.piezas_vecinas(a smallint, b smallint) returns boolean
language sql immutable set search_path = '' as $$
  select (a / 10 = b / 10 and abs(a % 10 - b % 10) = 1)
      or (a % 10 = 1 and b % 10 = 1
          and least(a / 10, b / 10) * 10 + greatest(a / 10, b / 10) in (12, 34, 56, 78))
$$;

create or replace function privado.validar_hallazgo() returns trigger
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
    -- NTS 188: diastema, supernumeraria y transposición van entre piezas vecinas;
    -- la transposición, además, en el mismo cuadrante (6.1.38). Entre una pieza
    -- temporal y una permanente (dentición mixta) no se exige vecindad.
    if c.ambito = 'entre_piezas' and (new.pieza / 10 between 5 and 8) = (new.pieza_hasta / 10 between 5 and 8)
       and not privado.piezas_vecinas(new.pieza, new.pieza_hasta) then
      raise exception '%: las piezas deben ser vecinas', c.nombre;
    end if;
    if c.codigo = 'transposicion' and new.pieza / 10 <> new.pieza_hasta / 10 then
      raise exception '%: las piezas deben ser del mismo cuadrante', c.nombre;
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

-- ---------------------------------------------------------------------------
-- Examen clínico (extraoral e intraoral). Lo registra el cirujano dentista;
-- no se edita: si hay un error, se anula con motivo y se registra otro.
-- ---------------------------------------------------------------------------
create table public.examen_clinico (
  id               uuid primary key default gen_random_uuid(),
  clinica_id       uuid not null,
  paciente_id      uuid not null,
  cita_id          uuid,
  registrado_por   uuid default auth.uid(),
  registrado_at    timestamptz not null default now(),
  -- Extraoral
  atm              text check (char_length(atm) <= 500),
  ganglios         text check (char_length(ganglios) <= 500),
  asimetrias       text check (char_length(asimetrias) <= 500),
  labios           text check (char_length(labios) <= 500),
  -- Intraoral
  mucosas          text check (char_length(mucosas) <= 500),
  encia            text check (char_length(encia) <= 500),
  lengua           text check (char_length(lengua) <= 500),
  paladar          text check (char_length(paladar) <= 500),
  piso_boca        text check (char_length(piso_boca) <= 500),
  higiene          text check (higiene in ('buena', 'regular', 'mala')),
  oclusion         text check (char_length(oclusion) <= 500),
  observaciones    text check (char_length(observaciones) <= 2000),
  anulado_at       timestamptz,
  anulado_por      uuid references public.usuario (id),
  motivo_anulacion text,
  created_at       timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id)    references public.paciente (clinica_id, id),
  foreign key (clinica_id, cita_id)        references public.cita (clinica_id, id),
  foreign key (clinica_id, registrado_por) references public.usuario (clinica_id, id),
  constraint examen_algun_dato check (num_nonnulls(atm, ganglios, asimetrias, labios, mucosas, encia, lengua, paladar,
                                                   piso_boca, higiene, oclusion, observaciones) > 0),
  constraint examen_anulacion_completa check ((anulado_at is null) = (motivo_anulacion is null)),
  check (motivo_anulacion is null or char_length(btrim(motivo_anulacion)) >= 3)
);
alter table public.examen_clinico enable row level security;
create index examen_paciente_idx on public.examen_clinico (paciente_id, registrado_at desc);
create trigger paciente_vigente before insert on public.examen_clinico
  for each row execute function privado.validar_paciente_vigente_bloqueando();
-- Misma validación que los signos: la cita es del paciente; la anulación, con hora del servidor.
create trigger validar before insert or update on public.examen_clinico
  for each row execute function privado.validar_signos();
create trigger solo_anular before update on public.examen_clinico
  for each row execute function privado.solo_anular();
create trigger auditar after insert or update on public.examen_clinico
  for each row execute function privado.auditar();

-- ---------------------------------------------------------------------------
-- Diagnóstico CIE-10 (presuntivo o definitivo), por paciente y opcionalmente por
-- pieza y superficies. Puede nacer de un hallazgo del odontograma. Registrado,
-- no se edita (regla 2): se agregan adendas o se anula con motivo.
-- ---------------------------------------------------------------------------
create table public.diagnostico (
  id               uuid primary key default gen_random_uuid(),
  clinica_id       uuid not null,
  paciente_id      uuid not null,
  cie10            text not null references public.catalogo_cie10 (codigo),
  tipo             text not null check (tipo in ('presuntivo', 'definitivo')),
  pieza            smallint check (pieza is null or privado.es_pieza_fdi(pieza)),
  superficies      text[] check (superficies <@ array['vestibular', 'palatino', 'lingual', 'mesial', 'distal', 'oclusal', 'incisal']),
  hallazgo_id      uuid references public.odontograma_hallazgo (id),
  examen_id        uuid,
  confirma_id      uuid,            -- el presuntivo que este definitivo confirma
  observacion      text check (char_length(observacion) <= 1000),
  registrado_por   uuid default auth.uid(),
  registrado_at    timestamptz not null default now(),
  anulado_at       timestamptz,
  anulado_por      uuid references public.usuario (id),
  motivo_anulacion text,
  created_at       timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id)    references public.paciente (clinica_id, id),
  foreign key (clinica_id, examen_id)      references public.examen_clinico (clinica_id, id),
  foreign key (clinica_id, confirma_id)    references public.diagnostico (clinica_id, id),
  foreign key (clinica_id, registrado_por) references public.usuario (clinica_id, id),
  constraint diagnostico_superficie_con_pieza check (superficies is null or (pieza is not null and cardinality(superficies) > 0)),
  constraint diagnostico_confirma_definitivo check (confirma_id is null or tipo = 'definitivo'),
  constraint diagnostico_anulacion_completa check ((anulado_at is null) = (motivo_anulacion is null)),
  check (motivo_anulacion is null or char_length(btrim(motivo_anulacion)) >= 3)
);
alter table public.diagnostico enable row level security;
create index diagnostico_paciente_idx on public.diagnostico (paciente_id, registrado_at desc);
create trigger paciente_vigente before insert on public.diagnostico
  for each row execute function privado.validar_paciente_vigente_bloqueando();

create function privado.validar_diagnostico() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.catalogo_cie10 c where c.codigo = new.cie10 and c.es_categoria)
       and exists (select 1 from public.catalogo_cie10 c where c.codigo like new.cie10 || '.%') then
      raise exception 'Elige el subcódigo CIE-10 (por ejemplo, %.1), no la categoría', new.cie10;
    end if;
    if new.hallazgo_id is not null and not exists (
         select 1 from public.odontograma_hallazgo h join public.odontograma o on o.id = h.odontograma_id
          where h.id = new.hallazgo_id and o.paciente_id = new.paciente_id and h.anulado_at is null) then
      raise exception 'El hallazgo no corresponde a este paciente o está anulado';
    end if;
    if new.examen_id is not null
       and not exists (select 1 from public.examen_clinico e where e.id = new.examen_id and e.paciente_id = new.paciente_id) then
      raise exception 'El examen no corresponde a este paciente';
    end if;
    if new.confirma_id is not null and not exists (
         select 1 from public.diagnostico d where d.id = new.confirma_id and d.paciente_id = new.paciente_id
            and d.tipo = 'presuntivo' and d.anulado_at is null) then
      raise exception 'Solo se confirma un diagnóstico presuntivo vigente del mismo paciente';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.anulado_at is null and new.anulado_at is not null then
    new.anulado_at := now();
  end if;
  return new;
end $$;
create trigger validar before insert or update on public.diagnostico
  for each row execute function privado.validar_diagnostico();
create trigger solo_anular before update on public.diagnostico
  for each row execute function privado.solo_anular();
create trigger auditar after insert or update on public.diagnostico
  for each row execute function privado.auditar();

-- Adendas: texto con fecha y autor; no se editan ni se borran.
create table public.diagnostico_adenda (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null,
  diagnostico_id  uuid not null,
  texto           text not null check (char_length(btrim(texto)) between 3 and 2000),
  registrado_por  uuid default auth.uid(),
  registrado_at   timestamptz not null default now(),
  foreign key (clinica_id, diagnostico_id) references public.diagnostico (clinica_id, id),
  foreign key (clinica_id, registrado_por) references public.usuario (clinica_id, id)
);
alter table public.diagnostico_adenda enable row level security;
create index diagnostico_adenda_idx on public.diagnostico_adenda (diagnostico_id, registrado_at);
-- No pasa por privado.auditar (que espera columnas de anulación): la tabla es de
-- solo inserción y cada fila ya guarda autor y hora.

-- ---------------------------------------------------------------------------
-- RLS: ven dentistas y asistente; registra, anula y agrega adendas solo el
-- cirujano dentista, a nombre propio.
-- ---------------------------------------------------------------------------
create policy examen_select on public.examen_clinico for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico()));
create policy examen_insert on public.examen_clinico for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista())
              and registrado_por = (select auth.uid()));
create policy examen_anular on public.examen_clinico for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista()))
  with check (clinica_id = (select privado.clinica_actual()) and anulado_por = (select auth.uid()));

create policy diagnostico_select on public.diagnostico for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico()));
create policy diagnostico_insert on public.diagnostico for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista())
              and registrado_por = (select auth.uid()));
create policy diagnostico_anular on public.diagnostico for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista()))
  with check (clinica_id = (select privado.clinica_actual()) and anulado_por = (select auth.uid()));

create policy adenda_select on public.diagnostico_adenda for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico()));
create policy adenda_insert on public.diagnostico_adenda for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista())
              and registrado_por = (select auth.uid()));

revoke all on public.examen_clinico, public.diagnostico, public.diagnostico_adenda from anon, authenticated;
grant select on public.examen_clinico, public.diagnostico, public.diagnostico_adenda to authenticated;
grant insert (id, clinica_id, paciente_id, cita_id, registrado_por, atm, ganglios, asimetrias, labios, mucosas, encia,
              lengua, paladar, piso_boca, higiene, oclusion, observaciones)
  on public.examen_clinico to authenticated;
grant update (anulado_at, anulado_por, motivo_anulacion) on public.examen_clinico to authenticated;
grant insert (id, clinica_id, paciente_id, cie10, tipo, pieza, superficies, hallazgo_id, examen_id, confirma_id,
              observacion, registrado_por)
  on public.diagnostico to authenticated;
grant update (anulado_at, anulado_por, motivo_anulacion) on public.diagnostico to authenticated;
grant insert (id, clinica_id, diagnostico_id, texto, registrado_por) on public.diagnostico_adenda to authenticated;

-- ---------------------------------------------------------------------------
-- Fusión de pacientes: también mueve exámenes y diagnósticos.
-- ---------------------------------------------------------------------------
create or replace function public.fusionar_pacientes(duplicado uuid, conservar uuid, motivo text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_clinica uuid := privado.clinica_actual();
  v_dup public.paciente;
  v_con public.paciente;
  v_movidos jsonb;
  v_desfase int;
  n_planes int; n_notas int; n_odontogramas int; n_citas int; n_seguimientos int; n_historia int; n_signos int;
  n_examenes int; n_diagnosticos int;
begin
  if privado.rol_actual() is distinct from 'admin' then
    raise exception 'Solo el administrador puede fusionar pacientes';
  end if;
  if duplicado = conservar then
    raise exception 'Elige dos pacientes distintos';
  end if;
  if length(btrim(coalesce(motivo, ''))) < 5 then
    raise exception 'Indica el motivo de la fusión';
  end if;
  -- Bloquea ambos en orden de id: dos fusiones cruzadas no se bloquean entre sí.
  perform 1 from public.paciente where id in (duplicado, conservar) and clinica_id = v_clinica order by id for update;
  select * into v_dup from public.paciente where id = duplicado and clinica_id = v_clinica;
  select * into v_con from public.paciente where id = conservar and clinica_id = v_clinica;
  if v_dup.id is null or v_con.id is null then
    raise exception 'Paciente no encontrado';
  end if;
  if v_dup.anulado_at is not null or v_con.anulado_at is not null then
    raise exception 'No se puede fusionar un paciente anulado';
  end if;

  perform set_config('dental.fusion', 'on', true);
  update public.plan_tratamiento set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_planes = row_count;
  update public.nota_evolucion set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_notas = row_count;
  update public.odontograma set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_odontogramas = row_count;
  update public.cita set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_citas = row_count;
  update public.seguimiento set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_seguimientos = row_count;
  select coalesce(max(version), 0) into v_desfase from public.cuestionario_salud where paciente_id = conservar;
  update public.cuestionario_salud set paciente_id = conservar, version = version + v_desfase where paciente_id = duplicado;
  get diagnostics n_historia = row_count;
  -- Si ambos tenían historia, una versión conciliada reúne lo que alerta (alergias,
  -- condiciones, anticoagulación, embarazo) para que ninguna alerta se pierda; queda
  -- marcada para revisión.
  if n_historia > 0 and v_desfase > 0 then
    insert into public.cuestionario_salud (clinica_id, paciente_id, registrado_por, motivo_consulta, enfermedades,
      enfermedades_otras, antecedentes_familiares, medicacion, anticoagulado, anticoagulante, alergias, embarazo, semanas_gestacion, lactancia,
      habitos, observaciones)
    select v_clinica, conservar, auth.uid(), 'Versión conciliada al fusionar registros duplicados',
           (select coalesce(array_agg(distinct e order by e), '{}') from unnest(a.enfermedades || b.enfermedades) e),
           nullif(concat_ws('; ', a.enfermedades_otras, nullif(b.enfermedades_otras, a.enfermedades_otras)), ''),
           nullif(concat_ws('; ', a.antecedentes_familiares,
                            nullif(b.antecedentes_familiares, a.antecedentes_familiares)), ''),
           nullif(concat_ws('; ', a.medicacion, nullif(b.medicacion, a.medicacion)), ''),
           a.anticoagulado or b.anticoagulado,
           nullif(concat_ws('; ', case when a.anticoagulado then a.anticoagulante end,
                            case when b.anticoagulado and b.anticoagulante is distinct from a.anticoagulante
                                 then b.anticoagulante end), ''),
           (select coalesce(array_agg(distinct x order by x), '{}') from unnest(a.alergias || b.alergias) x),
           r.embarazo, r.semanas_gestacion, r.lactancia,
           (select coalesce(array_agg(distinct x order by x), '{}') from unnest(a.habitos || b.habitos) x),
           'Generada automáticamente al fusionar registros: revisar con el paciente.'
      from (select * from public.cuestionario_salud where paciente_id = conservar and version <= v_desfase
             order by registrado_at desc, version desc limit 1) a,
           (select * from public.cuestionario_salud where paciente_id = conservar and version > v_desfase
             order by registrado_at desc, version desc limit 1) b
      -- Embarazo: el registrado como «sí» prevalece; si no, el más reciente.
      cross join lateral (select * from public.cuestionario_salud where id in (a.id, b.id)
                           order by (embarazo = 'si') desc, registrado_at desc limit 1) r;
  end if;
  update public.signos_vitales set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_signos = row_count;
  update public.examen_clinico set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_examenes = row_count;
  update public.diagnostico set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_diagnosticos = row_count;
  perform set_config('dental.fusion', 'off', true);

  -- El documento pasa al que se conserva si este no tenía (se libera primero en el
  -- duplicado, porque el documento es único por clínica).
  if v_con.numero_documento is null and v_dup.numero_documento is not null then
    update public.paciente set numero_documento = null, dni = null where id = duplicado;
    update public.paciente set tipo_documento = v_dup.tipo_documento, numero_documento = v_dup.numero_documento
    where id = conservar;
  end if;

  -- Datos que solo tenía el duplicado pasan al que se conserva.
  update public.paciente p set
    telefono = coalesce(p.telefono, v_dup.telefono),
    sexo = coalesce(p.sexo, v_dup.sexo),
    ocupacion = coalesce(p.ocupacion, v_dup.ocupacion),
    direccion = coalesce(p.direccion, v_dup.direccion),
    contacto_emergencia_nombre = coalesce(p.contacto_emergencia_nombre, v_dup.contacto_emergencia_nombre),
    contacto_emergencia_telefono = coalesce(p.contacto_emergencia_telefono, v_dup.contacto_emergencia_telefono),
    contacto_emergencia_parentesco = coalesce(p.contacto_emergencia_parentesco, v_dup.contacto_emergencia_parentesco),
    consentimiento_datos_at = coalesce(p.consentimiento_datos_at, v_dup.consentimiento_datos_at),
    fecha_nacimiento = coalesce(p.fecha_nacimiento, v_dup.fecha_nacimiento),
    apoderado_nombre = coalesce(p.apoderado_nombre, v_dup.apoderado_nombre),
    apoderado_dni = coalesce(p.apoderado_dni, v_dup.apoderado_dni),
    apoderado_telefono = coalesce(p.apoderado_telefono, v_dup.apoderado_telefono),
    apoderado_parentesco = coalesce(p.apoderado_parentesco, v_dup.apoderado_parentesco),
    apoderado_direccion = coalesce(p.apoderado_direccion, v_dup.apoderado_direccion),
    lugar_nacimiento = coalesce(p.lugar_nacimiento, v_dup.lugar_nacimiento),
    procedencia = coalesce(p.procedencia, v_dup.procedencia),
    grupo_sanguineo = coalesce(p.grupo_sanguineo, v_dup.grupo_sanguineo),
    estado_civil = coalesce(p.estado_civil, v_dup.estado_civil),
    grado_instruccion = coalesce(p.grado_instruccion, v_dup.grado_instruccion),
    -- El seguro y su número van juntos: se toman del mismo registro.
    seguro = coalesce(p.seguro, v_dup.seguro),
    seguro_numero = case when p.seguro is not null then p.seguro_numero else v_dup.seguro_numero end,
    religion = coalesce(p.religion, v_dup.religion)
  where p.id = conservar;

  perform set_config('dental.fusion', 'on', true);
  update public.paciente set
    anulado_at = now(), anulado_por = auth.uid(), fusionado_en = conservar,
    motivo_anulacion = 'Fusionado con ' || v_con.nombres || ' ' || v_con.apellidos || ': ' || btrim(motivo)
  where id = duplicado;
  perform set_config('dental.fusion', 'off', true);

  v_movidos := jsonb_build_object('planes', n_planes, 'notas', n_notas, 'odontogramas', n_odontogramas,
                                  'citas', n_citas, 'seguimientos', n_seguimientos,
                                  'historia', n_historia, 'signos_vitales', n_signos,
                                  'examenes', n_examenes, 'diagnosticos', n_diagnosticos);
  insert into public.auditoria (clinica_id, tabla, registro_id, accion, usuario_id, antes, despues)
  values (v_clinica, 'paciente', duplicado, 'fusion', auth.uid(), to_jsonb(v_dup),
          jsonb_build_object('conservar', conservar, 'motivo', btrim(motivo), 'movidos', v_movidos));
  return v_movidos;
end $$;

-- Auditoría: examen y diagnóstico son contenido clínico (regla 9).
drop policy auditoria_select on public.auditoria;
create policy auditoria_select on public.auditoria for select to authenticated
  using (clinica_id = (select privado.clinica_actual())
         and (select privado.rol_actual()) = 'admin'
         and (tabla not in ('nota_evolucion', 'odontograma', 'odontograma_hallazgo', 'cuestionario_salud',
                            'signos_vitales', 'historia_clinica', 'examen_clinico', 'diagnostico',
                            'diagnostico_adenda')
              or (select privado.es_dentista())));
