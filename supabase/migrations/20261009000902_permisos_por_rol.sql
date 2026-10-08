-- Etapa 1 (v2): permisos clínicos por rol, aplicados en la base (regla 9).
--
--                                      admin*  odontólogo  asistente  recepción
--   ver odontograma, hallazgos, notas    ✓        ✓           ✓          ✗
--   crear/firmar registros clínicos      ✓        ✓           ✗          ✗
--   crear/editar ítems y planes          ✓        ✓           ✗          solo estado
--   cuotas y plantillas de mensajes      ✓        ✗           ✗          ✓
--   anular pacientes                     ✓        ✗           ✗          ✗
--   * admin con COP es cirujano dentista; sin COP actúa como recepción en lo clínico.
--
-- Sin usuario (migraciones, seed, service_role) privado.rol_actual() es null y
-- estas validaciones no aplican: RLS ya no rige para esos roles.

-- Ve la historia clínica: cirujano dentista o asistente.
create function privado.ve_clinico() returns boolean
language sql stable security definer set search_path = '' as $$
  select privado.es_dentista() or coalesce(privado.rol_actual() = 'asistente', false)
$$;
grant execute on function privado.ve_clinico() to authenticated;

drop policy odontograma_select on public.odontograma;
create policy odontograma_select on public.odontograma for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico()));
drop policy hallazgo_select on public.odontograma_hallazgo;
create policy hallazgo_select on public.odontograma_hallazgo for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico()));
drop policy nota_select on public.nota_evolucion;
create policy nota_select on public.nota_evolucion for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico()));

-- Planes e ítems: los crea un cirujano dentista; asistente no los modifica.
drop policy plan_tratamiento_insert on public.plan_tratamiento;
create policy plan_tratamiento_insert on public.plan_tratamiento for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista()));
drop policy plan_tratamiento_update on public.plan_tratamiento;
create policy plan_tratamiento_update on public.plan_tratamiento for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) <> 'asistente')
  with check (clinica_id = (select privado.clinica_actual()));

drop policy item_plan_insert on public.item_plan;
create policy item_plan_insert on public.item_plan for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista()));
drop policy item_plan_update on public.item_plan;
create policy item_plan_update on public.item_plan for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) <> 'asistente')
  with check (clinica_id = (select privado.clinica_actual()));

-- Quien no es cirujano dentista (recepción o admin sin COP) solo cambia el estado
-- comercial: aceptar o rechazar el plan y programar ítems aceptados.
create function privado.validar_cambio_plan_por_rol() returns trigger
language plpgsql set search_path = '' as $$
begin
  if privado.rol_actual() is null or privado.es_dentista() then
    return new;
  end if;
  if (to_jsonb(new) - array['estado', 'motivo_rechazo', 'aceptado_at', 'terminado_at', 'updated_at'])
     is distinct from (to_jsonb(old) - array['estado', 'motivo_rechazo', 'aceptado_at', 'terminado_at', 'updated_at']) then
    raise exception 'Solo un cirujano dentista puede modificar el contenido del plan';
  end if;
  if new.terminado_at is distinct from old.terminado_at and new.estado = old.estado then
    raise exception 'Solo un cirujano dentista puede modificar el contenido del plan';
  end if;
  if new.estado is distinct from old.estado
     and not (old.estado = 'propuesto' and new.estado in ('aceptado', 'rechazado')) then
    raise exception 'Recepción solo puede registrar si el paciente acepta o rechaza el presupuesto';
  end if;
  return new;
end $$;
create trigger validar_rol before update on public.plan_tratamiento
  for each row execute function privado.validar_cambio_plan_por_rol();

create function privado.validar_cambio_item_por_rol() returns trigger
language plpgsql set search_path = '' as $$
begin
  if privado.rol_actual() is null or privado.es_dentista() then
    return new;
  end if;
  if (to_jsonb(new) - array['estado', 'updated_at']) is distinct from (to_jsonb(old) - array['estado', 'updated_at']) then
    raise exception 'Solo un cirujano dentista puede modificar el procedimiento, la pieza, el diagnóstico o el precio';
  end if;
  if new.estado is distinct from old.estado
     and not (old.estado in ('aceptado', 'programado') and new.estado in ('aceptado', 'programado')) then
    raise exception 'Recepción solo puede programar o desprogramar ítems aceptados';
  end if;
  return new;
end $$;
-- "validar_rol" corre después de "validar" (orden alfabético): el mensaje de la regla
-- 1 (solo un cirujano dentista marca realizado) se mantiene.
create trigger validar_rol before update on public.item_plan
  for each row execute function privado.validar_cambio_item_por_rol();

-- Cuotas y plantillas de mensajes: administración y recepción.
drop policy cuota_insert on public.cuota;
create policy cuota_insert on public.cuota for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual())
              and (select privado.rol_actual()) in ('admin', 'recepcion'));
drop policy cuota_update on public.cuota;
create policy cuota_update on public.cuota for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) in ('admin', 'recepcion'))
  with check (clinica_id = (select privado.clinica_actual()));

drop policy plantilla_mensaje_insert on public.plantilla_mensaje;
create policy plantilla_mensaje_insert on public.plantilla_mensaje for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual())
              and (select privado.rol_actual()) in ('admin', 'recepcion'));
drop policy plantilla_mensaje_update on public.plantilla_mensaje;
create policy plantilla_mensaje_update on public.plantilla_mensaje for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) in ('admin', 'recepcion'))
  with check (clinica_id = (select privado.clinica_actual()));

-- Anular un paciente: solo admin.
create function privado.validar_anulacion_paciente() returns trigger
language plpgsql set search_path = '' as $$
begin
  if privado.rol_actual() is not null and privado.rol_actual() <> 'admin'
     and new.anulado_at is distinct from old.anulado_at then
    raise exception 'Solo el administrador puede anular un paciente';
  end if;
  return new;
end $$;
create trigger validar_anulacion before update on public.paciente
  for each row execute function privado.validar_anulacion_paciente();
