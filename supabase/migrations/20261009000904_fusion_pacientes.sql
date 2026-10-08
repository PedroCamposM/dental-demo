-- Etapa 1 (v2): fusión de pacientes duplicados. Solo admin; queda en la auditoría.
-- Nada se borra: el duplicado se anula con motivo y apunta al paciente que queda.

alter table public.paciente
  add column fusionado_en uuid references public.paciente (id);

-- Acciones nuevas de auditoría (fusión ahora; lectura, firma y exportación en
-- etapas siguientes). Solo se amplía la lista permitida.
alter table public.auditoria drop constraint auditoria_accion_check;
alter table public.auditoria add constraint auditoria_accion_check
  check (accion in ('insert', 'update', 'anular', 'fusion', 'lectura', 'firma', 'exportar'));

-- Los registros clínicos inalterables (notas, odontogramas) solo se anulan. La
-- única excepción es la fusión: cambiar SOLO paciente_id, dentro de la función
-- de fusión (que corre como su dueño, no como "authenticated").
create or replace function privado.solo_anular() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_setting('dental.fusion', true) = 'on' and current_user <> 'authenticated'
     and (to_jsonb(new) - 'paciente_id') = (to_jsonb(old) - 'paciente_id') then
    return new;
  end if;
  if old.anulado_at is not null then
    raise exception 'El registro ya está anulado y no puede modificarse';
  end if;
  if new.anulado_at is null or new.anulado_por is distinct from auth.uid() then
    raise exception 'Solo se permite anular el registro (con motivo, a nombre propio)';
  end if;
  return new;
end $$;

create function public.fusionar_pacientes(duplicado uuid, conservar uuid, motivo text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_clinica uuid := privado.clinica_actual();
  v_dup public.paciente;
  v_con public.paciente;
  v_movidos jsonb;
  n_planes int; n_notas int; n_odontogramas int; n_citas int; n_seguimientos int;
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
  select * into v_dup from public.paciente where id = duplicado and clinica_id = v_clinica for update;
  select * into v_con from public.paciente where id = conservar and clinica_id = v_clinica for update;
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
  perform set_config('dental.fusion', 'off', true);

  -- Datos de contacto que solo tenía el duplicado pasan al que se conserva.
  update public.paciente p set
    telefono = coalesce(p.telefono, v_dup.telefono),
    sexo = coalesce(p.sexo, v_dup.sexo),
    ocupacion = coalesce(p.ocupacion, v_dup.ocupacion),
    direccion = coalesce(p.direccion, v_dup.direccion),
    contacto_emergencia_nombre = coalesce(p.contacto_emergencia_nombre, v_dup.contacto_emergencia_nombre),
    contacto_emergencia_telefono = coalesce(p.contacto_emergencia_telefono, v_dup.contacto_emergencia_telefono),
    contacto_emergencia_parentesco = coalesce(p.contacto_emergencia_parentesco, v_dup.contacto_emergencia_parentesco),
    consentimiento_datos_at = coalesce(p.consentimiento_datos_at, v_dup.consentimiento_datos_at)
  where p.id = conservar;

  update public.paciente set
    anulado_at = now(), anulado_por = auth.uid(), fusionado_en = conservar,
    motivo_anulacion = 'Fusionado con ' || v_con.nombres || ' ' || v_con.apellidos || ': ' || btrim(motivo)
  where id = duplicado;

  v_movidos := jsonb_build_object('planes', n_planes, 'notas', n_notas, 'odontogramas', n_odontogramas,
                                  'citas', n_citas, 'seguimientos', n_seguimientos);
  insert into public.auditoria (clinica_id, tabla, registro_id, accion, usuario_id, antes, despues)
  values (v_clinica, 'paciente', duplicado, 'fusion', auth.uid(), to_jsonb(v_dup),
          jsonb_build_object('conservar', conservar, 'motivo', btrim(motivo), 'movidos', v_movidos));
  return v_movidos;
end $$;

revoke all on function public.fusionar_pacientes(uuid, uuid, text) from public, anon;
grant execute on function public.fusionar_pacientes(uuid, uuid, text) to authenticated;
