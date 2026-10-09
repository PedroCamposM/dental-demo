-- Complemento del seed para la Etapa 7 (v2): plantillas de consentimiento DE EJEMPLO.
--
-- Idempotente: se puede correr varias veces sin duplicar ni borrar nada.
-- Local/CI: `supabase db reset` lo carga después de seed_etapa5.sql (config.toml).
-- Remoto: se aplica una vez sobre la clínica demo existente.
--
-- IMPORTANTE: son textos de ejemplo para la demo (es_ejemplo = true). No son un
-- formato oficial ni reemplazan la revisión de la clínica: el formato impreso lo
-- advierte hasta que el administrador las revise y las marque como revisadas.
-- Estructura según la NTS 139 (formato 16): descripción en términos sencillos,
-- riesgos, efectos adversos de los fármacos y pronóstico y recomendaciones.

insert into public.plantilla_consentimiento (clinica_id, tipo, nombre, descripcion, riesgos, efectos_adversos, pronostico,
                                             es_ejemplo)
select 'c0000000-0000-4000-8000-000000000001', v.tipo, v.nombre, v.descripcion, v.riesgos, v.efectos, v.pronostico, true
from (values
  ('procedimiento', 'Tratamiento de conductos (endodoncia)',
   'Se retira el tejido inflamado o infectado del interior del diente (pulpa), se limpian y desinfectan los conductos y se rellenan. Puede requerir más de una sesión y, al final, una restauración o corona para proteger el diente.',
   'Molestias o dolor por algunos días; inflamación; fractura del diente o de un instrumento dentro del conducto; conductos que no se pueden tratar por completo; persistencia de la infección que haga necesario repetir el tratamiento, una cirugía o la extracción.',
   'Anestesia local: adormecimiento prolongado, palpitaciones o, rara vez, reacción alérgica. Analgésicos y antiinflamatorios (AINES): molestias gástricas o reacción alérgica. Antibióticos, si se indican: molestias digestivas o reacción alérgica. Informe al profesional si es alérgico a algún medicamento.',
   'En la mayoría de los casos el diente se conserva. Se recomienda no masticar alimentos duros con el diente tratado hasta su restauración definitiva y acudir a los controles indicados.'),
  ('procedimiento', 'Cirugía oral (extracción dental)',
   'Se extrae la pieza dentaria indicada bajo anestesia local. En piezas retenidas o con raíces complejas puede ser necesario abrir la encía, retirar hueso y colocar puntos de sutura.',
   'Dolor, sangrado e inflamación en los días siguientes; hematoma; infección de la herida o alveolitis; daño a dientes vecinos o restauraciones; fractura de la raíz; comunicación con el seno maxilar en piezas superiores; adormecimiento temporal o, rara vez, permanente del labio o la lengua en piezas inferiores.',
   'Anestesia local: adormecimiento prolongado, palpitaciones o, rara vez, reacción alérgica. Analgésicos y antiinflamatorios (AINES): molestias gástricas o reacción alérgica. Antibióticos, si se indican: molestias digestivas o reacción alérgica. Informe si toma anticoagulantes u otros medicamentos.',
   'La recuperación suele tomar de una a dos semanas. Siga las indicaciones por escrito (frío local, dieta blanda, no enjuagarse el primer día, no fumar) y acuda al control y al retiro de puntos.'),
  ('procedimiento', 'Implante dental',
   'Se coloca en el hueso maxilar un implante de titanio que reemplaza la raíz del diente perdido. Tras un tiempo de integración se coloca la corona. Puede requerir injerto de hueso.',
   'Dolor, inflamación y sangrado tras la cirugía; infección; falta de integración del implante, que obligue a retirarlo; daño a estructuras vecinas (nervio, seno maxilar, dientes); inflamación alrededor del implante con el tiempo.',
   'Anestesia local: adormecimiento prolongado, palpitaciones o, rara vez, reacción alérgica. Analgésicos y antiinflamatorios (AINES): molestias gástricas o reacción alérgica. Antibióticos, si se indican: molestias digestivas o reacción alérgica.',
   'El éxito depende de la higiene, de los controles y de no fumar. Se recomienda acudir a los controles y al mantenimiento periódico.'),
  ('procedimiento', 'Tratamiento de ortodoncia',
   'Se colocan aparatos (brackets u otros) que mueven los dientes de forma progresiva. El tratamiento dura meses o años y requiere controles periódicos. Al terminar se usa un retenedor.',
   'Molestias los primeros días y tras cada control; llagas por roce; manchas o caries si la higiene no es adecuada; acortamiento de las raíces; inflamación de las encías; molestias en la articulación de la mandíbula; recidiva si no se usa el retenedor.',
   'Analgésicos, si se indican para las molestias: molestias gástricas o reacción alérgica.',
   'El resultado depende de la colaboración del paciente (higiene, asistencia a controles, cuidado de los aparatos y uso del retenedor).'),
  ('procedimiento', 'Tratamiento pulpar en dientes de leche',
   'Se retira la parte inflamada de la pulpa del diente de leche, se coloca un medicamento y se restaura el diente para conservarlo hasta su recambio natural.',
   'Molestias o inflamación; persistencia de la infección que haga necesaria la extracción; afectación del diente permanente en formación si la infección avanza.',
   'Anestesia local: el niño puede morderse el labio o la mejilla mientras dura el adormecimiento; rara vez, reacción alérgica.',
   'Se recomienda vigilar que el niño no se muerda mientras dure la anestesia y acudir a los controles.'),
  ('procedimiento', 'Blanqueamiento dental',
   'Se aplica un gel blanqueador sobre los dientes en el consultorio para aclarar su color. Las restauraciones y coronas no cambian de color.',
   'Sensibilidad dental pasajera; irritación de las encías; resultado distinto al esperado o desigual; el color puede volver a oscurecerse con el tiempo.',
   null,
   'Se recomienda evitar alimentos y bebidas que manchan en los días siguientes y mantener controles.'),
  ('uso_imagen', 'Uso de imágenes clínicas con fines académicos o de difusión',
   'Autorizo el uso de fotografías y radiografías de mi tratamiento con los fines que marco abajo (académicos y/o de difusión). Las imágenes se usarán sin mi nombre ni datos que me identifiquen. Puedo negarme o revocar esta autorización en cualquier momento sin que afecte mi atención.',
   'Aunque se retiren los datos personales, algunas imágenes del rostro o de rasgos particulares podrían permitir reconocerme.',
   null, null)
) as v(tipo, nombre, descripcion, riesgos, efectos, pronostico)
where exists (select 1 from public.clinica where id = 'c0000000-0000-4000-8000-000000000001')
on conflict (clinica_id, (lower(btrim(nombre)))) do nothing;

-- Cada procedimiento que requiere consentimiento apunta a su plantilla (el injerto óseo
-- queda sin plantilla de ejemplo: la elige la clínica).
update public.procedimiento p set consentimiento_plantilla_id = t.id
from public.plantilla_consentimiento t
where p.clinica_id = 'c0000000-0000-4000-8000-000000000001' and t.clinica_id = p.clinica_id
  and p.requiere_consentimiento and p.consentimiento_plantilla_id is null
  and t.nombre = case
    when p.codigo like 'END-%' then 'Tratamiento de conductos (endodoncia)'
    when p.codigo in ('CIR-01', 'CIR-02') then 'Cirugía oral (extracción dental)'
    when p.codigo like 'IMP-%' then 'Implante dental'
    when p.codigo like 'ORT-%' then 'Tratamiento de ortodoncia'
    when p.codigo = 'PED-01' then 'Tratamiento pulpar en dientes de leche'
    when p.codigo = 'EST-01' then 'Blanqueamiento dental'
  end;
