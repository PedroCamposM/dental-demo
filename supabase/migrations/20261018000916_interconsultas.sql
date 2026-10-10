-- Etapa 7 (v2), rebanada 4: interconsultas y derivaciones.
--
-- - Interna: a otro cirujano dentista de la clínica. Queda como tarea pendiente de ese
--   profesional (la ve en Inicio) hasta que responda.
-- - Externa: a un médico u otro centro, con motivo y datos clínicos relevantes, en un
--   formato imprimible. Se registra la respuesta (p. ej. el riesgo quirúrgico) y se
--   adjunta el documento escaneado.
-- Aditiva. Nada se borra: una interconsulta pedida por error se cancela con motivo.

create table public.interconsulta (
  id                  uuid primary key default gen_random_uuid(),
  clinica_id          uuid not null,
  paciente_id         uuid not null,
  tipo                text not null check (tipo in ('interna', 'externa')),
  solicitante_id      uuid not null,
  destinatario_id     uuid,
  destino             text check (char_length(btrim(destino)) between 3 and 200),
  motivo              text not null check (char_length(btrim(motivo)) between 10 and 1000),
  datos_clinicos      text check (char_length(datos_clinicos) <= 2000),
  nota_id             uuid,
  creada_at           timestamptz not null default now(),
  estado              text not null default 'pendiente' check (estado in ('pendiente', 'respondida', 'cancelada')),
  respuesta           text check (char_length(btrim(respuesta)) between 3 and 2000),
  respondida_at       timestamptz,
  respondida_por      uuid,
  archivo_id          uuid,
  cancelada_at        timestamptz,
  cancelada_por       uuid,
  motivo_cancelacion  text check (char_length(motivo_cancelacion) <= 200),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id) references public.paciente (clinica_id, id),
  foreign key (clinica_id, solicitante_id) references public.usuario (clinica_id, id),
  foreign key (clinica_id, destinatario_id) references public.usuario (clinica_id, id),
  foreign key (clinica_id, nota_id) references public.nota_evolucion (clinica_id, id),
  foreign key (clinica_id, respondida_por) references public.usuario (clinica_id, id),
  foreign key (clinica_id, archivo_id) references public.archivo_clinico (clinica_id, id),
  foreign key (clinica_id, cancelada_por) references public.usuario (clinica_id, id),
  constraint interconsulta_destino check (
    (tipo = 'interna' and destinatario_id is not null and destino is null)
    or (tipo = 'externa' and destinatario_id is null and destino is not null)),
  constraint interconsulta_respuesta check ((estado = 'respondida') = (respuesta is not null and respondida_at is not null)),
  constraint interconsulta_cancelacion check ((estado = 'cancelada') = (cancelada_at is not null and motivo_cancelacion is not null))
);
alter table public.interconsulta enable row level security;
create index interconsulta_paciente_idx on public.interconsulta (paciente_id, creada_at desc);
create index interconsulta_pendiente_idx on public.interconsulta (destinatario_id) where estado = 'pendiente';

create function privado.preparar_interconsulta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    if new.clinica_id is distinct from privado.clinica_actual() then
      raise exception 'Interconsulta de otra clínica';
    end if;
    new.solicitante_id := auth.uid();
  end if;
  if new.tipo = 'interna' and not exists (
       select 1 from public.usuario u where u.id = new.destinatario_id and u.clinica_id = new.clinica_id and u.activo
         and u.rol in ('admin', 'odontologo') and u.cop is not null and u.id <> new.solicitante_id) then
    raise exception 'La interconsulta interna se dirige a otro cirujano dentista activo de la clínica';
  end if;
  if new.nota_id is not null and not exists (select 1 from public.nota_evolucion n
                                              where n.id = new.nota_id and n.paciente_id = new.paciente_id) then
    raise exception 'La sesión no corresponde a este paciente';
  end if;
  new.destino := nullif(btrim(new.destino), '');
  new.creada_at := now();
  new.estado := 'pendiente';
  new.respuesta := null; new.respondida_at := null; new.respondida_por := null; new.archivo_id := null;
  new.cancelada_at := null; new.cancelada_por := null; new.motivo_cancelacion := null;
  return new;
end $$;
create trigger preparar before insert on public.interconsulta
  for each row execute function privado.preparar_interconsulta();
create trigger paciente_vigente before insert on public.interconsulta
  for each row execute function privado.validar_paciente_vigente();
create trigger auditar after insert or update on public.interconsulta
  for each row execute function privado.auditar_simple();

-- Ve el personal clínico; pide el cirujano dentista. Sin UPDATE ni DELETE desde la API.
create policy interconsulta_select on public.interconsulta for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico()));
create policy interconsulta_insert on public.interconsulta for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista()));
revoke all on public.interconsulta from anon, authenticated;
grant select on public.interconsulta to authenticated;
grant insert (id, clinica_id, paciente_id, tipo, solicitante_id, destinatario_id, destino, motivo, datos_clinicos, nota_id)
  on public.interconsulta to authenticated;

-- ---------------------------------------------------------------------------
-- Responder (interna: el destinatario; externa: el personal clínico registra el
-- resultado y, si hay, el documento escaneado ya subido al bucket del paciente).
-- ---------------------------------------------------------------------------
create function public.responder_interconsulta(id_interconsulta uuid, texto text, ruta text, mime text, bytes integer,
                                               nombre text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.interconsulta;
  v_archivo uuid;
begin
  if not privado.ve_clinico() then
    raise exception 'Solo el personal clínico registra la respuesta';
  end if;
  select * into v from public.interconsulta
   where id = id_interconsulta and clinica_id = privado.clinica_actual() for update;
  if v.id is null then
    raise exception 'Interconsulta no encontrada';
  end if;
  if v.estado <> 'pendiente' then
    raise exception 'Esta interconsulta ya fue respondida o cancelada';
  end if;
  if v.tipo = 'interna' and v.destinatario_id is distinct from auth.uid() then
    raise exception 'La responde el profesional a quien se dirigió';
  end if;
  if char_length(btrim(coalesce(texto, ''))) < 3 then
    raise exception 'Escribe la respuesta o el resultado';
  end if;
  if ruta is not null then
    if v.tipo = 'interna' then
      raise exception 'La interconsulta interna se responde por escrito';
    end if;
    insert into public.archivo_clinico (clinica_id, paciente_id, tipo, ruta, nombre, mime, bytes, tomada_el, descripcion,
                                        subido_por)
    values (v.clinica_id, v.paciente_id, 'interconsulta', ruta, left(nombre, 200), mime, bytes,
            (now() at time zone 'America/Lima')::date, left('Respuesta de interconsulta: ' || coalesce(v.destino, ''), 500),
            auth.uid())
    returning id into v_archivo;
  end if;
  update public.interconsulta set estado = 'respondida', respuesta = btrim(texto), respondida_at = now(),
         respondida_por = auth.uid(), archivo_id = v_archivo
   where id = v.id;
end $$;
revoke all on function public.responder_interconsulta(uuid, text, text, text, integer, text) from public, anon;
grant execute on function public.responder_interconsulta(uuid, text, text, text, integer, text) to authenticated;

-- Pedida por error: la cancela quien la pidió (si aún está pendiente).
create function public.cancelar_interconsulta(id_interconsulta uuid, motivo text)
returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  v public.interconsulta;
begin
  if char_length(btrim(coalesce(motivo, ''))) < 3 then
    raise exception 'Indica por qué se cancela';
  end if;
  select * into v from public.interconsulta
   where id = id_interconsulta and clinica_id = privado.clinica_actual() for update;
  if v.id is null or v.estado <> 'pendiente' then
    raise exception 'Solo se cancela una interconsulta pendiente';
  end if;
  if v.solicitante_id is distinct from auth.uid() then
    raise exception 'La cancela quien la pidió';
  end if;
  update public.interconsulta set estado = 'cancelada', cancelada_at = now(), cancelada_por = auth.uid(),
         motivo_cancelacion = left(btrim(motivo), 200)
   where id = v.id;
end $$;
revoke all on function public.cancelar_interconsulta(uuid, text) from public, anon;
grant execute on function public.cancelar_interconsulta(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Fusión y auditoría
-- ---------------------------------------------------------------------------
create or replace function privado.fusion_mover_extra(duplicado uuid, conservar uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n_archivos int;
  n_consentimientos int;
  n_recetas int;
  n_constancias int;
  n_interconsultas int;
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
  return jsonb_build_object('archivos', n_archivos, 'consentimientos', n_consentimientos, 'recetas', n_recetas,
                            'constancias', n_constancias, 'interconsultas', n_interconsultas);
end $$;

drop policy auditoria_select on public.auditoria;
create policy auditoria_select on public.auditoria for select to authenticated
  using (clinica_id = (select privado.clinica_actual())
         and (select privado.rol_actual()) = 'admin'
         and (tabla not in ('nota_evolucion', 'odontograma', 'odontograma_hallazgo', 'cuestionario_salud',
                            'signos_vitales', 'historia_clinica', 'examen_clinico', 'diagnostico',
                            'diagnostico_adenda', 'evolucion_adenda', 'evolucion_item', 'archivo_clinico',
                            'consentimiento', 'receta', 'constancia', 'interconsulta')
              or (select privado.es_dentista())));
