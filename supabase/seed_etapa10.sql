-- Complemento del seed para la Etapa 10 (v2): laboratorios y órdenes de trabajo de demo.
--
-- Idempotente: se puede correr varias veces sin duplicar ni borrar nada.
-- Local/CI: `supabase db reset` lo carga después de seed_etapa7.sql (config.toml).
-- Remoto: se aplica una vez sobre la clínica demo existente.
-- Datos inventados. Incluye un trabajo atrasado (CLAUDE.md, «Datos de demo»).

insert into public.laboratorio (clinica_id, nombre, telefono, contacto)
values ('c0000000-0000-4000-8000-000000000001', 'Laboratorio Dental Moche', '944 210 330', 'Técnico dental Julio Paredes'),
       ('c0000000-0000-4000-8000-000000000001', 'Cerámica Dental Trujillo', '949 118 452', 'Ing. Sofía Rebaza')
on conflict do nothing;

-- Coronas de zirconio aún no realizadas: una atrasada, una por llegar y una por enviar.
with coronas as (
  select i.id, row_number() over (order by i.id) as n
    from public.item_plan i join public.plan_tratamiento p on p.id = i.plan_id
   where i.clinica_id = 'c0000000-0000-4000-8000-000000000001' and i.procedimiento ilike 'Corona de zirconio%'
     and i.estado in ('aceptado', 'programado') and p.estado in ('aceptado', 'en_curso', 'detenido')
     -- Solo la primera vez: si la clínica ya tiene órdenes, no se agregan más.
     and not exists (select 1 from public.orden_laboratorio o where o.clinica_id = i.clinica_id)
), hoy as (select (now() at time zone 'America/Lima')::date as d)
insert into public.orden_laboratorio (clinica_id, item_plan_id, laboratorio_id, tipo_trabajo, color, indicaciones,
                                      estado, fecha_envio, fecha_entrega_prevista, costo_centimos, registrado_por)
select 'c0000000-0000-4000-8000-000000000001', c.id,
       (select id from public.laboratorio where clinica_id = 'c0000000-0000-4000-8000-000000000001'
          and nombre = case when c.n = 2 then 'Cerámica Dental Trujillo' else 'Laboratorio Dental Moche' end),
       'Corona de zirconio monolítica', case c.n when 1 then 'A2' when 2 then 'A3' else 'B1' end,
       'Terminación en chamfer. Enviar con prueba de estructura.',
       case when c.n <= 2 then 'en_laboratorio' else 'por_enviar' end::public.estado_orden_lab,
       case c.n when 1 then hoy.d - 12 when 2 then hoy.d - 3 end,
       case c.n when 1 then hoy.d - 4 when 2 then hoy.d + 4 end,
       case when c.n <= 2 then 45000 end,
       'd0000000-0000-4000-8000-000000000001'
  from coronas c, hoy
 where c.n <= 3;
