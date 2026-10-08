-- Etapa 1 (v2): búsqueda rápida de pacientes y aviso de posibles duplicados.
-- Funciones SECURITY INVOKER: RLS sigue filtrando por clínica.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Texto sin tildes, en minúsculas y con espacios simples. IMMUTABLE para poder
-- indexarlo (se fija el diccionario explícitamente).
create function privado.normalizar(texto text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select btrim(regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(texto, ''))),
                              '\s+', ' ', 'g'))
$$;
grant execute on function privado.normalizar(text) to authenticated;

create index paciente_nombre_trgm on public.paciente
  using gin (privado.normalizar(nombres || ' ' || apellidos) extensions.gin_trgm_ops);
create index paciente_telefono on public.paciente (clinica_id, telefono);

-- Búsqueda por documento, teléfono o nombre (en cualquier orden, sin tildes).
create function public.buscar_pacientes(texto text, limite int default 20)
returns table (id uuid, nombres text, apellidos text, tipo_documento public.tipo_documento,
               numero_documento text, telefono text, fecha_nacimiento date)
language sql stable security invoker set search_path = '' as $$
  with q as (
    select privado.normalizar(texto) as t,
           regexp_replace(coalesce(texto, ''), '\D', '', 'g') as digitos
  )
  select p.id, p.nombres, p.apellidos, p.tipo_documento, p.numero_documento, p.telefono, p.fecha_nacimiento
  from public.paciente p, q
  where p.anulado_at is null
    and length(q.t) >= 2
    and (
      -- documento (DNI, CE o pasaporte) desde el inicio
      p.numero_documento like upper(regexp_replace(texto, '\s', '', 'g')) || '%'
      -- teléfono: 6 o más dígitos en cualquier parte (con o sin 51)
      or (length(q.digitos) >= 6 and (p.telefono like '%' || q.digitos || '%'
                                      or p.apoderado_telefono like '%' || q.digitos || '%'))
      -- nombre: cada palabra buscada aparece en nombres + apellidos
      or not exists (
        select 1 from unnest(string_to_array(q.t, ' ')) palabra
        where privado.normalizar(p.nombres || ' ' || p.apellidos) not like '%' || palabra || '%')
    )
  order by extensions.similarity(privado.normalizar(p.nombres || ' ' || p.apellidos), q.t) desc,
           p.apellidos, p.nombres
  limit least(greatest(limite, 1), 50)
$$;

-- Posibles duplicados antes de crear: mismo nombre completo (sin tildes ni
-- mayúsculas) y misma fecha de nacimiento.
create function public.posibles_duplicados(nombres text, apellidos text, fecha_nacimiento date)
returns table (id uuid, nombres text, apellidos text, tipo_documento public.tipo_documento,
               numero_documento text, telefono text, fecha_nacimiento date)
language sql stable security invoker set search_path = '' as $$
  select p.id, p.nombres, p.apellidos, p.tipo_documento, p.numero_documento, p.telefono, p.fecha_nacimiento
  from public.paciente p
  where p.anulado_at is null
    and p.fecha_nacimiento = posibles_duplicados.fecha_nacimiento
    and privado.normalizar(p.nombres || ' ' || p.apellidos)
        = privado.normalizar(posibles_duplicados.nombres || ' ' || posibles_duplicados.apellidos)
$$;

-- Las funciones de public se crean ejecutables por PUBLIC: se restringe a authenticated.
revoke all on function public.buscar_pacientes(text, int) from public, anon;
revoke all on function public.posibles_duplicados(text, text, date) from public, anon;
grant execute on function public.buscar_pacientes(text, int) to authenticated;
grant execute on function public.posibles_duplicados(text, text, date) to authenticated;
