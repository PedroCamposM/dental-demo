-- Etapa 11 (v2): exportar la historia clínica completa.
--
-- Aditiva:
-- - exportacion_historia: cada exportación con quién, cuándo y el motivo (CLAUDE.md:
--   «cada exportación queda registrada en la auditoría»). También se escribe en auditoria
--   (acción «exportar»).
-- - registrar_exportacion(): la única forma de registrarla. Exporta el cirujano dentista
--   (la historia completa incluye datos que solo él firma). El documento solo se abre
--   desde una exportación propia y reciente (la pantalla lo comprueba).

create table public.exportacion_historia (
  id           uuid primary key default gen_random_uuid(),
  clinica_id   uuid not null,
  paciente_id  uuid not null,
  usuario_id   uuid not null,
  motivo       text not null check (char_length(btrim(motivo)) between 5 and 300),
  creada_at    timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id) references public.paciente (clinica_id, id),
  foreign key (clinica_id, usuario_id) references public.usuario (clinica_id, id)
);
alter table public.exportacion_historia enable row level security;
create index exportacion_historia_paciente on public.exportacion_historia (paciente_id, creada_at desc);

create function public.registrar_exportacion(id_paciente uuid, motivo text)
returns uuid
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  v_clinica uuid := privado.clinica_actual();
  v_id uuid;
begin
  if not privado.es_dentista() then
    raise exception 'La historia clínica completa la exporta el cirujano dentista';
  end if;
  if not exists (select 1 from public.paciente where id = id_paciente and clinica_id = v_clinica) then
    raise exception 'Paciente no encontrado';
  end if;
  if motivo is null or char_length(btrim(motivo)) < 5 then
    raise exception 'Escribe el motivo de la exportación';
  end if;
  insert into public.exportacion_historia (clinica_id, paciente_id, usuario_id, motivo)
  values (v_clinica, id_paciente, auth.uid(), left(btrim(motivo), 300))
  returning id into v_id;
  insert into public.auditoria (clinica_id, tabla, registro_id, accion, usuario_id, antes, despues)
  values (v_clinica, 'historia_clinica', id_paciente, 'exportar', auth.uid(), null,
          jsonb_build_object('exportacion_id', v_id, 'motivo', left(btrim(motivo), 300)));
  return v_id;
end $$;
revoke all on function public.registrar_exportacion(uuid, text) from public, anon;
grant execute on function public.registrar_exportacion(uuid, text) to authenticated;

-- La ven los cirujanos dentistas de la clínica (y el admin, que audita). Sin INSERT directo,
-- sin UPDATE ni DELETE (regla 1).
create policy exportacion_historia_select on public.exportacion_historia for select to authenticated
  using (clinica_id = (select privado.clinica_actual())
         and ((select privado.es_dentista()) or (select privado.rol_actual()) = 'admin'));
revoke all on public.exportacion_historia from anon, authenticated;
grant select on public.exportacion_historia to authenticated;

-- Fusión de pacientes: las exportaciones pasan al paciente que se conserva.
create or replace function privado.fusion_mover_extra(duplicado uuid, conservar uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n_archivos int;
  n_consentimientos int;
  n_recetas int;
  n_constancias int;
  n_interconsultas int;
  n_periodontogramas int;
  n_especialidad int := 0;
  n_laboratorio int;
  n_exportaciones int;
  n int;
  t text;
begin
  update public.archivo_clinico set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_archivos = row_count;
  perform privado.fusion_uso_imagen(duplicado, conservar);
  update public.consentimiento set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_consentimientos = row_count;
  update public.receta set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_recetas = row_count;
  update public.constancia set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_constancias = row_count;
  update public.interconsulta set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_interconsultas = row_count;
  update public.periodontograma set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_periodontogramas = row_count;
  foreach t in array array['endodoncia_conducto', 'ortodoncia_caso', 'ortodoncia_control', 'implante', 'implante_fase',
                           'cirugia_registro', 'odontopediatria_registro'] loop
    execute format('update public.%I set paciente_id = $1 where paciente_id = $2', t) using conservar, duplicado;
    get diagnostics n = row_count;
    n_especialidad := n_especialidad + n;
  end loop;
  update public.orden_laboratorio set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_laboratorio = row_count;
  update public.exportacion_historia set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_exportaciones = row_count;
  return jsonb_build_object('archivos', n_archivos, 'consentimientos', n_consentimientos, 'recetas', n_recetas,
                            'constancias', n_constancias, 'interconsultas', n_interconsultas,
                            'periodontogramas', n_periodontogramas, 'registros_especialidad', n_especialidad,
                            'ordenes_laboratorio', n_laboratorio, 'exportaciones', n_exportaciones);
end $$;
