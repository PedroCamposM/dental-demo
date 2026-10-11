-- Etapa 19 (v2): equipo de la clínica. El administrador invita por correo (odontólogo, asistente,
-- recepción u otro administrador), ve a su equipo con su último ingreso y desactiva o reactiva
-- usuarios. Nada se borra: un usuario desactivado deja de entrar y queda en el historial.
--
-- Aditiva: solo funciones. La invitación la crea el servidor con la service role
-- (auth.admin.inviteUserByEmail, con la clínica en los metadatos); el administrador, con su
-- sesión, incorpora a la persona invitada (incorporar_usuario verifica que la invitación sea
-- de su clínica). Con la clínica vencida, el disparador de solo lectura de `usuario` lo impide.

-- Equipo de la clínica (solo el administrador: incluye correos y últimos ingresos).
create function public.equipo_clinica()
returns table (id uuid, nombre text, rol public.rol_usuario, cop text, activo boolean, correo text,
               ultimo_ingreso timestamptz, invitacion_pendiente boolean, desde date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if privado.rol_actual() is distinct from 'admin' then
    raise exception 'Solo el administrador';
  end if;
  return query
    select u.id, u.nombre, u.rol, u.cop, u.activo, a.email::text, a.last_sign_in_at,
           a.last_sign_in_at is null, (u.created_at at time zone 'America/Lima')::date
      from public.usuario u join auth.users a on a.id = u.id
     where u.clinica_id = privado.clinica_actual()
     order by u.activo desc, u.nombre;
end $$;
revoke all on function public.equipo_clinica() from public, anon;
grant execute on function public.equipo_clinica() to authenticated;

-- Incorpora a la clínica a quien el servidor acaba de invitar.
create function public.incorporar_usuario(id_usuario uuid, nombre_usuario text, rol_usuario public.rol_usuario, cop_usuario text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_clinica uuid := privado.clinica_actual();
  v_meta jsonb;
  v_cop text := nullif(btrim(coalesce(cop_usuario, '')), '');
begin
  if v_clinica is null or privado.rol_actual() is distinct from 'admin' then
    raise exception 'Solo el administrador';
  end if;
  select raw_user_meta_data into v_meta from auth.users where id = id_usuario;
  if v_meta is null or v_meta ->> 'invitado_clinica' is distinct from v_clinica::text then
    raise exception 'Invitación no encontrada';
  end if;
  if exists (select 1 from public.usuario where id = id_usuario) then
    raise exception 'Esa persona ya pertenece a una clínica';
  end if;
  if char_length(btrim(coalesce(nombre_usuario, ''))) not between 3 and 120 then
    raise exception 'El nombre va de 3 a 120 caracteres';
  end if;
  if v_cop is not null and v_cop !~ '^\d{1,6}$' then
    raise exception 'El número de colegiatura (COP) tiene de 1 a 6 dígitos';
  end if;
  if rol_usuario = 'odontologo' and v_cop is null then
    raise exception 'El odontólogo necesita su número de colegiatura (COP)';
  end if;
  if rol_usuario in ('asistente', 'recepcion') then
    v_cop := null;
  end if;
  insert into public.usuario (id, clinica_id, nombre, rol, cop) values (id_usuario, v_clinica, btrim(nombre_usuario), rol_usuario, v_cop);
end $$;
revoke all on function public.incorporar_usuario(uuid, text, public.rol_usuario, text) from public, anon;
grant execute on function public.incorporar_usuario(uuid, text, public.rol_usuario, text) to authenticated;

-- Desactiva o reactiva a alguien del equipo (no a uno mismo; siempre queda un administrador activo).
create function public.cambiar_estado_usuario(id_usuario uuid, activar boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_clinica uuid := privado.clinica_actual();
  v_rol public.rol_usuario;
begin
  if v_clinica is null or privado.rol_actual() is distinct from 'admin' then
    raise exception 'Solo el administrador';
  end if;
  if activar is null then
    raise exception 'Indica si activas o desactivas';
  end if;
  if id_usuario = auth.uid() then
    raise exception 'No puedes desactivarte a ti mismo';
  end if;
  select rol into v_rol from public.usuario where id = id_usuario and clinica_id = v_clinica for update;
  if v_rol is null then
    raise exception 'Usuario no encontrado';
  end if;
  update public.usuario set activo = activar where id = id_usuario;
end $$;
revoke all on function public.cambiar_estado_usuario(uuid, boolean) from public, anon;
grant execute on function public.cambiar_estado_usuario(uuid, boolean) to authenticated;
