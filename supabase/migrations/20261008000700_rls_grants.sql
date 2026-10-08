-- Row Level Security y GRANTs explícitos
-- Origen: docs/propuesta-esquema.sql (v2, aprobada).

-- ---------------------------------------------------------------------------
-- Políticas RLS — (select privado.fn()) se evalúa una vez por consulta.
-- RLS ya se activa en la migración que crea cada tabla.
-- ---------------------------------------------------------------------------

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
