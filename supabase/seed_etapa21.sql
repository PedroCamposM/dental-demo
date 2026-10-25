-- Complemento del seed para la Etapa 21 (v2): cómo se cotiza cada procedimiento de la demo.
--
-- En `supabase db reset` los seeds se cargan después de las migraciones, así que el ajuste de
-- 0935 (profilaxis y destartraje «por boca») no alcanza al catálogo del seed: se fija aquí.
-- Idempotente.
update public.procedimiento set cobro_por = 'boca'
 where clinica_id = 'c0000000-0000-4000-8000-000000000001' and codigo = 'PRE-01' and cobro_por <> 'boca';
update public.procedimiento set cobro_por = 'cuadrante'
 where clinica_id = 'c0000000-0000-4000-8000-000000000001' and codigo = 'PER-01' and cobro_por <> 'cuadrante';
