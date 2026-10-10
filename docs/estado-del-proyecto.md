# Estado del proyecto (bitácora de contexto)

> Este archivo existe para que cualquier sesión nueva (de Claude o de una persona)
> retome el trabajo sin depender de conversaciones anteriores. Se actualiza al cerrar
> cada rebanada. **Leerlo junto con `CLAUDE.md` antes de empezar.**

Última actualización: 2026-10-08 — Etapa 1 migrada en el remoto; Etapa 2 hecha en la rama (falta migrar).

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Repo | `PedroCamposM/dental-demo` (público) |
| Rama por defecto / producción | `main` (Vercel publica producción desde `main`) |
| Rama de trabajo actual | `claude/affectionate-maxwell-bjl90k` (vista previa en Vercel) |
| App publicada | https://dental-demo-sigma.vercel.app |
| Supabase | proyecto `elotisuupmqmcedjgxiz` |
| Norma del odontograma | `docs/NTS-188-MINSA-DGIESP-2022-odontograma.pdf` |
| Reglas del producto y Sistema de calidad | `CLAUDE.md` (v2) |

## Usuarios demo (todo ficticio)

Contraseña: `DemoTrujillo2026`. Correos `@clinica-demo.example`:
`valverde` (admin + odontóloga con COP), `alvarado` (odontólogo, ortodoncia),
`mendoza` (odontóloga), `asistente` (asistente, Etapa 1), `recepcion` (recepción).
Los teléfonos de pacientes son al azar: en una demo en vivo, cambiar el del paciente
que se use por uno propio antes de pulsar «Abrir WhatsApp».

## Secretos y configuración (no van en el repo)

- GitHub → Actions secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`,
  `BACKUP_PASSPHRASE` (Pedro la guarda fuera de GitHub; sin ella no se abre un respaldo).
- Vercel (Config, Production and Preview): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Pendiente: `HABILITAR_ETAPA1=1` (ver abajo).
- `.env.local` solo en la máquina de cada uno (ignorado por git).

## Cómo se trabaja (resumen operativo)

1. Antes de cada etapa: plan (migraciones, RLS, pantallas, reglas) y aprobación de Pedro.
2. Rebanadas pequeñas con commit. CI (`.github/workflows/ci.yml`) en cada push:
   lint, tipos, Vitest, build, tests SQL sobre Postgres efímero y sobre **Supabase
   local real**, y Playwright contra ese Supabase local.
3. Migraciones al remoto **solo** con Actions → «Aplicar migraciones» (`migrar.yml`):
   respaldo cifrado → conteos → `db push` → verificaciones → conteos.
4. Módulos que dependen de migraciones nuevas van detrás de una variable
   (`src/lib/funciones.ts`) hasta que el remoto las tenga.
5. Cierre de etapa: salida real de tests, revisión independiente del diff
   (subagente), checklist manual de Pedro con los 4 roles, fusión a `main`.

### Limitaciones del entorno de Claude en la nube (conocidas)

- No llega a la base de Supabase por conexión directa ni puede bajar imágenes de
  Docker: **no puede correr `supabase start` ni `db dump`**. Por eso esas tareas viven
  en GitHub Actions. Sí puede usar la API de gestión de Supabase (consultas SQL).
- No puede crear ni empujar la rama `main` (la trata como producción): Pedro la
  actualiza (fusión/PR) desde GitHub.
- No puede leer los artefactos de Actions (red bloqueada): el CI imprime en el log lo
  que veía la página en cada prueba de Playwright fallida.

## v1 (terminada y publicada)

Tablero «dinero en riesgo» con 6 indicadores y envío por `wa.me`, plantillas
editables, login por rol, seed de 120 pacientes, migraciones 0100–0800.
Decisiones v1 relevantes: alternativas A/B cuentan una vez; detenido vale lo que falta
hacer; controles vencidos = sin cita agendada; tipo de seguimiento `no_show` (0800);
cerrar sesión solo en el dispositivo actual (`scope: "local"`).

## v2 — Etapa 0 (auditoría): hecha

Hallazgo principal: la v1 tenía en la base odontograma, citas, pagos y planes, pero
**sin pantallas**; las etapas de la v2 deben construirlas.

## v2 — Etapa 1 (en cierre)

Decisiones aprobadas por Pedro:
- Firma por COP (admin con COP firma). Asistente ve historia/odontograma/notas, no firma.
- Recepción sí ve diagnósticos y procedimientos del plan.
- Documento: DNI 8 dígitos; CE 9–12 y pasaporte 6–12 alfanuméricos en mayúsculas.
- Seed remoto: solo se agrega (scripts idempotentes), nunca se borra.
- Respaldos y migraciones vía GitHub Actions.

Migraciones (aplicadas en el remoto el 2026-10-08 con «Aplicar migraciones», corrida
37809992322; respaldo cifrado `respaldo-cifrado-37809992322`, 90 días):
0900 rol asistente · 0901 filiación (tipo/número de documento, sexo, ocupación,
dirección, contacto de emergencia, parentesco del apoderado; `dni` sincronizado) ·
0902 permisos por rol (ve_clinico, en_fusion, triggers por rol, anulación de una vía,
auditoría clínica solo para dentistas) · 0903 búsqueda y duplicados · 0904 fusión ·
0905 inactividad por clínica. Seed complementario: `supabase/seed_etapa1.sql`.

Pantallas (detrás de `HABILITAR_ETAPA1`): `/pacientes`, `/pacientes/nuevo`,
`/pacientes/[id]`, `/pacientes/[id]/fusionar`, `/configuracion`; bloqueo de pantalla
(cookie httpOnly) y cierre por inactividad (cliente + middleware).

Revisión independiente: 14 hallazgos, todos corregidos con pruebas (commit 6420f75).
Bug histórico corregido: `pruebas.debe_fallar` daba por bueno cualquier SQL.

Bug encontrado por Playwright (commit ee82609): tras un error del servidor, React
reinicia el formulario y no aplica el `defaultValue` nuevo a un `<select>` ya montado;
el sexo volvía a «Elegir…» y el consentimiento se desmarcaba (y «crear de todas
formas» tras el aviso de duplicado fallaba). Arreglo: `key` en el `<select>` y el
estado devuelve `consiente`. Regla para formularios futuros: todo `<select>` o
casilla no controlado debe conservar su valor tras un envío con errores, y los
formularios llevan `noValidate` (valida el servidor, con mensajes en español). La
fusión se ajustó igual: conserva el duplicado elegido y el motivo.

Desbloqueo de pantalla: la acción de formulario de React vaciaba el campo un instante
después del error «Contraseña incorrecta.» y podía borrar la contraseña ya reescrita
(falla intermitente en CI). Ahora el envío es manual (`onSubmit`). Desde entonces el
CI falla también con pruebas inestables (`failOnFlakyTests`) e imprime siempre lo que
veía la página en cada intento fallido.

### La atención clínica primero (pedido de Pedro, 2026-10-08)

La portada de la v1 era «Dinero en riesgo hoy» con un total en soles, y el login decía
«Mira cuánta plata tienes en riesgo…». Contradecía la v2 (lo económico es un módulo
más). Cambio: `/` lleva a **Pacientes**; el tablero pasa a **Tablero de gestión**
(`/gestion`, `/riesgo/*` redirige), sin el total gigante y con pacientes primero y monto
después; lo ven admin, odontólogo y recepción (Pedro: «es una plataforma de gestión del
odontólogo»), no el asistente (también en la acción del servidor). Regla en
`src/lib/permisos.ts` con Vitest. Login: «Historia clínica, tratamientos y seguimiento
de tus pacientes.». El tablero clínico (Etapa 8) será la portada cuando exista.

### Estado del cierre de la Etapa 1

Hecho:
- CI en verde sin reintentos (corrida 37806322757, commit 029eeda).
- Migraciones 0900–0905 en el remoto. Conteos antes/después iguales salvo
  `auditoria` +120 (backfill del documento de los 120 pacientes). Verificación de
  filiación: 120/120 con documento. La primera corrida falló en el respaldo por
  `SUPABASE_DB_PASSWORD` incorrecta (Pedro la reseteó en Database → Settings).
- `seed_etapa1.sql` cargado en el remoto (en una transacción vía API de gestión):
  5 usuarios (asistente con identidad y login HTTP 200), 0 pacientes sin sexo, 0
  menores sin parentesco, 0 adultos sin contacto de emergencia; auditoría +121.
- `seed.check.sql` en el remoto: todo pasa salvo «citas programadas en el pasado»
  (1 cita de hoy 11:00 que ya pasó: los datos demo envejecen; no es un error).
- Producción (código de `main`) probada contra la base migrada: 10/10 pruebas de
  login, tablero y plantillas (la de plantillas guarda y restaura una plantilla).

Pendiente:
1. Checklist manual de Pedro con los 4 roles en la vista previa (`docs/checklist-etapa1.md`).
   `HABILITAR_ETAPA1=1` ya está en Vercel para Preview (tipo Config).
2. Fusionar la rama a `main` y agregar `HABILITAR_ETAPA1=1` en **Production**.

Decisión de Pedro (2026-10-08): «es un demo»; los permisos finos se dejan para
después. Hoy el asistente no ve el Tablero de gestión en pantalla, pero RLS aún le
deja leer cuotas, pagos y seguimientos por API. Pendiente para una etapa futura.

## v2 — Etapa 2 (catálogo, horarios y agenda): aplicada en el remoto

Pedro pidió avanzar sin esperar aprobación etapa por etapa («quiero que tú
desarrolles y mejores la plataforma»). Rebanadas con commit y CI en verde cada una:

- **0906 catálogo** (`procedimiento`): código, nombre, especialidad, precio base
  (céntimos), duración, consentimiento, control automático (días), activo. Solo
  admin mantiene; no se borra. `item_plan.procedimiento_id` opcional (Etapa 5).
  Pantalla: Configuración → Procedimientos y aranceles.
- **0907 agenda**: `sillon`, `horario_profesional` (un bloque por día; inactivo en
  vez de borrar, regla 8), `bloqueo_agenda` (se anula con motivo), `cita.sillon_id`,
  `cita.forzada_motivo/forzada_por`. Trigger `validar_agenda` (solo rol
  `authenticated`: el seed y la fusión no pasan): sin citas fuera de horario ni sobre
  bloqueos salvo admin con motivo; nunca dos citas activas superpuestas por
  profesional o sillón; no en el pasado ni cruzando la medianoche. Citas auditadas.
  RPC `guardar_horario_semanal` (todo o nada). Pantalla: Configuración → Sillones y
  horarios.
- **Agenda** (`/agenda`, `/agenda/nueva`, ficha del paciente → «Agendar cita»).
- Variable `HABILITAR_ETAPA2` (requiere también la Etapa 1). En CI encendida.
- Hallazgo: Supabase da todos los permisos a anon/authenticated en tablas nuevas;
  cada migración hace `revoke all` y concede solo lo necesario (probado con anon).
- Pruebas que se ajustaron a propósito: `fusion.test` y `rls_reglas.test` cargan
  sus citas de preparación como datos del sistema (la v2 no deja citar sin horario).
- Seed (`seed_etapa2.sql`): 23 procedimientos (los de los planes con su mismo
  precio), 3 sillones, lunes a sábado 9–19, feriado del 8 de diciembre.

Revisión independiente (subagente): 12 hallazgos; corregidos los de severidad media
y baja en el commit 4142be2 (sillón ajeno, autor del forzado falsificable, citas
no activas sin validar, doble cita del paciente, odontólogo inactivo, superposición
en el seed v1, medianoche y fechas imposibles, e2e que compartían datos). Queda
anotado, sin hacer: restricción de exclusión (btree_gist) contra reservas
simultáneas, y el «cuál consentimiento» del catálogo (llega con la Etapa 7).
CI en verde: corrida del commit 4142be2, 29/29 Playwright al primer intento.

Para llevarla al remoto: correr «Aplicar migraciones» (0906–0907), cargar
`seed_etapa2.sql` y encender `HABILITAR_ETAPA2=1` en Vercel. Checklist:
`docs/checklist-etapa2.md`.

## v2 — Etapa 3 (historia clínica, signos vitales y alertas): aplicada en el remoto

- **0908** (`filiacion_nts139`): filiación según el Formato de Filiación de la NTS 139:
  lugar de nacimiento, procedencia, grupo sanguíneo y Rh, estado civil, grado de
  instrucción, seguro y N° de afiliación, religión (opcional, dato sensible) y
  domicilio del apoderado. Todo opcional y aditivo. Se guarda solo con la Etapa 3
  encendida (antes de aplicar la 0908 el formulario no envía esas columnas).
- **0909** (`historia_clinica`; antes se llamaba 0908, se renombró porque no estaba
  aplicada en el remoto): `cuestionario_salud` (insert-only, versión correlativa por paciente; nada
  se edita ni se borra), `signos_vitales` (se anulan con motivo; la cita debe ser del
  mismo paciente; la hora de anulación la pone el servidor), `alertas_pacientes()`
  (solo alergias, anticoagulante, condiciones, embarazo y fecha; recepción ve que hay
  una condición pero no cuál), `registrar_lectura_historia()` (lectura auditada, una
  vez cada 10 min). La fusión mueve historia y signos y crea una **versión
  conciliada** (unión de alergias, condiciones, anticoagulación; embarazo «sí»
  prevalece) para que ninguna alerta se pierda.
- Permisos: la historia la ven y registran dentistas y asistente (decisión de
  Pedro, 2026-10-08: «sí», la asistente también llena el cuestionario); la
  asistente también registra signos vitales. Recepción no ve nada clínico, solo el
  banner de alertas.
- Pantallas: pestañas Filiación · Historia clínica · Signos vitales; banner fijo de
  alertas en toda vista del paciente y en la agenda (texto y al pasar el cursor),
  con la fecha de la historia; si no se pueden cargar, lo dice (no «sin alertas»).
- Seed (`seed_etapa3.sql`): historia para los 120 pacientes, firmada por quien
  atendió; penicilina, AINES, látex, anticoagulados, hipertensos, diabéticos, una
  gestante (registrada hace una semana), hábitos, versiones 2 y signos vitales.
- Revisión independiente: 15 hallazgos; corregidos los de severidad alta y media.
  Segunda revisión (NTS 139): 5 hallazgos (seguro y N° mezclados en la fusión,
  SOAT, COP en signos, tipo de documento en la historia, forma de inicio sin
  «sin registrar»), todos corregidos. La filiación la ve todo el personal: la NTS
  139 la excluye de la «información clínica».
- Condiciones que alertan (Pedro: «decide tú»): todas las de la lista del
  cuestionario (hipertensión, diabetes, cardiopatía, asma, epilepsia, hepatitis,
  VIH, coagulación, renal, tiroides, cáncer, osteoporosis). El equipo clínico ve
  el nombre; recepción, solo que hay una condición registrada (dato sensible).
- NTS 139 ya está en `/docs` (Pedro la subió el 2026-10-08). Alineado: anamnesis
  (tiempo de enfermedad, forma de inicio, funciones biológicas, antecedentes
  familiares), filiación (0908), «Historia clínica N°» = documento y autor con COP.
  Qué cubre y qué falta: `docs/nts139-cumplimiento.md`.
- **Remoto (2026-10-09):** Pedro autorizó («Hazlo») y Claude lanzó «Aplicar
  migraciones» (run 37872665811: respaldo cifrado, 0906–0909 aplicadas,
  verificaciones OK). Se cargaron `seed_etapa2.sql` y `seed_etapa3.sql` por la API
  de gestión: 23 procedimientos, 3 sillones, 18 horarios, 1 feriado, 130 versiones de
  historia (120 pacientes), 84 signos, 70 pacientes con filiación NTS 139.
  `HABILITAR_ETAPA3=1` en Vercel Preview: se le explicó a Pedro cómo agregarlo.
- **Desfase de la demo con el tiempo:** `seed.check` en el remoto marca 3 citas del
  8-oct aún «programadas» y 1 cita futura superpuesta (los datos v1 se generaron
  relativos a la fecha de carga). Corregirlas modifica la base real: el clasificador
  de permisos lo bloqueó y queda pendiente de que Pedro lo autorice. En la Etapa 12,
  script para «refrescar» las fechas de la demo.
- Checklist manual: `docs/checklist-etapa3.md`.

## v2 — Etapa 4 (examen, odontograma y CIE-10): aplicada en el remoto

- **0910** (`examen_diagnostico`):
  - `catalogo_cie10`: 130 códigos (K00–K14 y S02.5, S03.2, Z01.2, Z46.3, Z46.4,
    B37.0, B00.2, A69.0) del paquete npm `cie10` 0.0.2 (MIT); solo se restituyeron
    tildes. Global y de solo lectura, como `catalogo_hallazgo`.
  - `examen_clinico` (extraoral e intraoral), `diagnostico` (presuntivo o definitivo,
    pieza y superficies, desde un hallazgo, confirmación del presuntivo) y
    `diagnostico_adenda`. Solo inserción; se anulan con motivo (reglas 1 y 2). Los
    ven dentistas y asistente; los registra el cirujano dentista (RLS).
  - Odontograma: `denticion` (rellena los 115 existentes por sus piezas o por la
    edad), tipo `alta` (NTS 188, 5.10), piezas vecinas en diastema, supernumeraria y
    transposición (esta, en el mismo cuadrante), sigla obligatoria del defecto de
    esmalte. Verificación: `supabase/verificaciones/20261012000910_examen_diagnostico.sql`.
- `docs/nts188-resumen.md`: la NTS 188 sección por sección (lo hizo un subagente que
  leyó las 24 páginas). Lo que la norma **no** define: qué zona de la corona es cada
  superficie, dentición permanente/temporal/mixta (el gráfico es único, con 4 filas),
  índices CPOD/IHO-S y CIE-10.
- **Convención de superficies (pendiente de confirmar con un odontólogo):** superiores,
  vestibular hacia la raíz y palatino hacia el centro; inferiores, lingual hacia el
  centro y vestibular hacia la raíz; mesial hacia la línea media; centro = oclusal o
  incisal. Está en un solo lugar: `src/lib/odontograma/geometria.ts`.
- Pantallas (`HABILITAR_ETAPA4`): pestañas «Odontograma» y «Examen y diagnóstico».
  Odontograma en SVG con los 38 hallazgos; tocar una pieza la carga en el
  formulario; uno nuevo (evolución o alta) parte de los hallazgos vigentes del
  anterior. Del hallazgo al diagnóstico con un clic. Buscador CIE-10 sin
  sugerencias (regla 11).
- `seed_etapa4.sql`: examen por paciente y diagnósticos desde los hallazgos con
  CIE-10 (pulpitis presuntiva con adenda). `scripts/test-db.sh` ahora carga los seeds
  en una sesión, como el Supabase CLI.
- Revisión independiente: 0 altos, 3 medios y 9 bajos; corregidos. Solo quien firmó
  el odontograma anula sus hallazgos; adendas auditadas; un presuntivo se confirma una
  vez; diagnóstico coherente con su hallazgo y con superficies posibles; pieza
  coherente con la dentición; copia fila por fila; formularios que no pierden lo
  escrito; fusión dibujada con círculos que se cruzan. `test-db.sh` aplica la última
  migración sobre el seed. CI en verde: run 37876599600 (commit 75163b9).
- Lección: en SVG solo lo pintado recibe el clic; cada pieza lleva un fondo
  transparente. `<Link>` de Next dentro de `<svg>` se cambió por `<a>` nativo.
- Para el remoto: «Aplicar migraciones» (0910), cargar `seed_etapa4.sql` y
  `HABILITAR_ETAPA4=1` en Vercel Preview. Checklist: `docs/checklist-etapa4.md`.
- Pendiente para cerrar la Etapa 4: índices CPOD/ceod e IHO-S y riesgo
  estomatológico (NTS 139, 12.x) necesitan una norma en `/docs` que los defina; la
  NTS 188 no los trata.

## v2 — Etapa 5 (plan con fases y versiones): aplicada en el remoto

- Hallazgo de la auditoría: el estado de cobro ya estaba separado desde la v1
  (`item_plan.estado` no tiene «cobrado»; `v_item_cobro` lo calcula desde los pagos).
  No hay ítems «cobrado» que migrar.
- **0911** (`plan_fases_versiones`): `plan_fase` (las nombra el odontólogo; no se
  inventa una clasificación), `item_plan.fase / duracion_minutos / diagnostico_id`
  (el CIE-10 del ítem viene del diagnóstico de origen), `item_dependencia` (sin ciclos;
  un ítem no se marca realizado antes que lo que requiere), `grupo_id` que une versiones
  y alternativas (relleno: las B del seed v1 se unen a la A del mismo paciente y día),
  estado `reemplazado`. Sin DELETE: si el orden cambia, se hace una versión nueva.
  - `aceptar_plan()`: el paciente elige una alternativa (o algunos ítems); las demás
    quedan «rechazado» con motivo y la versión anterior en marcha queda «reemplazado»
    (lo hecho se conserva; lo pendiente se cancela con motivo). Lo registra recepción o
    un dentista. Usa la marca `dental.proceso` para que los triggers de rol acepten
    esas consecuencias.
  - `copiar_plan()`: versión nueva o alternativa, con fases, ítems pendientes y orden.
- Pantalla (`HABILITAR_ETAPA5`): pestaña «Plan de tratamiento» para toda la clínica
  (recepción no ve el Dx de los ítems). «Agregar al plan» desde un diagnóstico.
- `seed_etapa5.sql`: une las alternativas del seed v1 a su plan A.
- Checklist: `docs/checklist-etapa5.md`.
- Revisión independiente: 1 alta, 4 medias, 5 bajas; corregidas. Alta: `grupo_id` lo
  podía fijar el cliente y `aceptar_plan` no filtraba por clínica/paciente (un dentista
  podía reemplazar planes ajenos); ahora se calcula, no cambia y todo filtra por clínica
  y paciente. Además: al aceptar se reemplaza cualquier otro plan en marcha del grupo;
  alternativas solo desde un plan propuesto; la aceptación parcial no deja dependencias
  colgando; no se reemplaza un plan con cuotas por cobrar, pagos o citas futuras en lo
  pendiente; `rechazar_plan()` atómico; tablero agrupado por `grupo_id` y con
  «reemplazado». CI en verde: run 37929559304 (commit 93c30e7).
- Para el remoto: «Aplicar migraciones» (0910 y 0911), cargar `seed_etapa4.sql` y
  `seed_etapa5.sql`, y `HABILITAR_ETAPA4=1` y `HABILITAR_ETAPA5=1` en Vercel Preview.
  Se verificó en el remoto (solo lectura) que no hay dos planes de la misma letra del
  mismo paciente el mismo día (el relleno de grupos no choca).

## v2 — Etapa 6 (evolución por sesión firmada): aplicada en el remoto

- **0912** (`evolucion_firmada`): la «nota» de la v1 pasa a ser la evolución.
  `nota_evolucion` suma cita, anestesia (tipo y cantidad), materiales, incidencias,
  indicaciones, próxima cita sugerida y `firmada_at`. Las 132 notas de la v1 quedan
  firmadas en su propia fecha. Estado de cita `en_sala`.
  - Borrador → lo edita solo su autor. Firmada → no se edita; solo adendas
    (`evolucion_adenda`, con fecha y autor, auditadas) o anulación con motivo si no
    respalda ítems realizados.
  - `evolucion_item`: ítems del plan trabajados y terminados en la sesión (sin DELETE:
    se desmarcan).
  - `abrir_evolucion(cita)` («Atender»): crea el borrador a nombre del dentista con los
    ítems de la cita y deja la cita «en sala».
  - `firmar_evolucion(nota)`: solo el autor; los ítems terminados pasan a realizado
    (respetando dependencias: si el orden falla, no firma) y la cita queda atendida.
  - Regla 3 ahora: realizado = evolución **firmada** (el consentimiento llega en la Etapa 7).
- Pantalla (`HABILITAR_ETAPA6`): pestaña «Evolución» (dentistas y asistente) y en la
  agenda «En sala» (toda la clínica, solo hoy) y «Atender» / «Continuar evolución»
  (cirujano dentista). «Nueva evolución sin cita» para urgencias.
- Tests: `supabase/tests/evolucion.test.sql`, `rls_reglas.test.sql` actualizado a
  propósito (realizado exige evolución firmada), Vitest `src/lib/clinico/evolucion.test.ts`,
  Playwright `e2e/evolucion.spec.ts` (recepción → en sala; odontóloga → atiende, firma,
  adenda; asistente solo lee).
- Checklist: `docs/checklist-etapa6.md`.
- Revisión independiente: 1 alta, 2 medias y 5 bajas; corregidas. Alta: al firmar dos
  ítems dependientes terminados en la misma sesión, la firma fallaba según el orden de
  las filas; ahora se marcan en orden de dependencias. Medias: un dentista podía marcar
  realizado un ítem citando cualquier evolución firmada (ahora solo al firmar la sesión
  en que se terminó) y otro dentista podía reescribir un borrador ajeno al anularlo
  (ahora solo el autor lo anula y sin cambiar el texto). Bajas: una cita «en sala» no
  se mueve de día; la firma conserva la fecha de la sesión; `GRANT INSERT` por columna
  efectivo; «Continuar evolución» solo para el autor; `seed_etapa3` determinista (usaba
  el id aleatorio del paciente y a veces no llegaba a los mínimos del guion).
  `plan.test.sql` y `rls_reglas.test.sql` actualizados a propósito: el ítem pasa a
  realizado firmando la evolución, no con un UPDATE directo.
- Para el remoto: «Aplicar migraciones» (0910, 0911 y 0912), cargar `seed_etapa4.sql` y
  `seed_etapa5.sql`, y `HABILITAR_ETAPA4/5/6=1` en Vercel Preview.

## v2 — Etapa 7 (imágenes, consentimientos, recetas, constancias, interconsultas): aplicada en el remoto

- **Decisión de Pedro (2026-10-09):** el consentimiento informado se **imprime y se firma
  a mano** (con huella) y se sube el escaneo. La NTS 139 (4.3.3 c y formato 16) no admite
  la firma electrónica del paciente para el consentimiento; CLAUDE.md pedía firma en
  pantalla. Pedro preguntó por tener también firma en pantalla o huella digital: se puede
  agregar como respaldo, pero no reemplaza al papel; la huella digital requiere un lector
  biométrico (o el servicio de RENIEC). Por ahora, papel + escaneo.
- **0913** `archivos_clinicos`: bucket privado `clinico` (rutas `clínica/paciente/uuid.ext`,
  políticas por clínica y rol, sin UPDATE/DELETE), `archivo_clinico` (fecha, pieza,
  sesión; se anula con motivo), URLs firmadas de 5 minutos, subida directa desde el
  navegador. `privado.fusion_mover_extra` para que la fusión mueva las tablas nuevas.
- **0914** `consentimientos`: plantillas (admin; las de ejemplo marcadas), plantilla por
  procedimiento, consentimiento con copia del texto, firma/negativa con escaneo,
  revocación y anulación; uso de imagen. **Regla 3 completa** (realizado = evolución
  firmada + consentimiento firmado si se requiere; se hereda entre versiones del plan
  por `item_plan.item_origen_id`).
- **0915** `recetas_constancias`: receta (atómica, plantillas propias del profesional;
  el sistema no sugiere dosis), constancia de atención y certificado de descanso.
- **0916** `interconsultas`: interna (pendiente del otro dentista, en Pacientes) y externa
  (formato imprimible, resultado con documento).
- Pantallas (`HABILITAR_ETAPA7`): pestañas «Imágenes y archivos», «Consentimientos»,
  «Recetas y documentos» e «Interconsultas»; Configuración → Consentimientos. Formatos
  imprimibles (imprimir o guardar como PDF desde el navegador).
- `seed_etapa7.sql`: plantillas de consentimiento DE EJEMPLO (la clínica debe revisarlas).
- Revisión independiente de 7.1–7.2: 2 altas, 3 medias, 6 bajas; corregidas las altas,
  medias y las bajas de seguridad (rechazo temprano de otra clínica, formato vs.
  extensión). Pendientes menores: objetos huérfanos si falla el registro tras subir;
  formatos pendientes conservan el texto de ejemplo si luego se revisa la plantilla.
- Segunda revisión independiente (7.3–7.5 y correcciones): 1 alta, 3 medias, 6 bajas;
  corregidas. Alta: `item_origen_id` se podía fijar a mano para «prestar» el
  consentimiento de otro paciente (o formar un ciclo); ahora solo lo pone la copia del
  plan y debe ser un ítem del plan de origen. Medias: `emitir_receta` con datos vacíos,
  plantilla desactivada que usa el catálogo, subir el documento antes de validar la
  respuesta. Bajas: los campos del formulario de receta ya no se borran tras un error;
  recetas y constancias guardan nombre y COP del profesional al emitirse; otros ajustes.
  En CI apareció un error real del formulario de receta: dos campos `indicaciones`
  (general y por medicamento) creaban un medicamento fantasma; corregido con prueba.
- Checklist: `docs/checklist-etapa7.md`. Falta en `/docs`: formatos reales de la clínica
  piloto (consentimientos) para reemplazar las plantillas de ejemplo.

## v2 — Etapa 8 (seguimiento clínico, Tablero clínico y caja): aplicada en el remoto

- **0917** `seguimiento_clinico`: tipos de control clínicos (posoperatorio, retiro de
  puntos, ortodoncia, mantenimiento periodontal, anual; «laboratorio atrasado» lo genera
  la Etapa 10). Regla 5: al realizarse un procedimiento con «control automático» se crea
  su control (tipo según la especialidad); el plan pasa a «en curso» con el primer
  realizado y a «terminado» (con el control de 6 meses) cuando no le queda nada por hacer,
  también si el profesional cancela el último pendiente. «En sala» de hoy cuenta como
  cita próxima para la regla de detenido.
- **0918** `pagos_caja`: `registrar_pago()` es la única vía para registrar pagos (se
  retiró el INSERT directo de la v1; el test `rls_reglas` se actualizó a propósito). Aplica
  a las cuotas en orden y, con ellas, a los ítems; lo demás a los ítems. Cierre de caja
  diario por método y profesional con efectivo contado y diferencia; un día cerrado no
  recibe pagos ni anulaciones, se corrige con ajuste con motivo.
- Pantallas (`HABILITAR_ETAPA8`): Tablero clínico, controles clínicos en el Tablero de
  gestión, región «Pagos» en el plan y página Caja.
- Revisión independiente: 2 altas, 4 medias, 6 bajas. Altas corregidas: pagos insertados
  directo (fecha forjada, sin aplicar, saltando el cierre) y plan que nunca terminaba si el
  último pendiente se cancelaba. Medias: cuotas que no avanzaban el cobro del ítem (y saldo
  en pantalla distinto del que acepta la base), controles vencidos que no se limpiaban con
  citas, e2e de caja no repetible. Bajas corregidas: bandera de proceso restaurada,
  seguimiento manual no se vincula a un ítem, «en sala» antigua, conteos con tope,
  «Anular» oculto en días cerrados. Decisión: se permite cerrar la caja de hoy (lo
  natural al final de la jornada); un pago posterior ese día se corrige con ajuste.
  Queda como mejora: el mensaje de WhatsApp de los controles clínicos usa la plantilla
  genérica de control.
- En CI apareció un error real: las secciones del Tablero clínico usaban ids con espacios
  en `aria-labelledby` (quedaban sin nombre accesible); corregido.
- Checklist: `docs/checklist-etapa8.md`.
- Remoto: CI verde (run 38016285641) y «Aplicar migraciones» run 38016680712 (respaldo
  previo): 0917–0918 aplicadas. Comprobado: 11 tipos de seguimiento, sin INSERT directo en
  `pago`, 4 funciones nuevas, 19 planes detenidos. Falta `HABILITAR_ETAPA8=1` en Vercel.

## v2 — Etapa 9 (periodontograma y registros por especialidad): aplicada en el remoto

- **0919** `periodontograma`: examen por fecha, borrador → firmado por el cirujano
  dentista responsable (la asistente puede registrarlo a su nombre, no firmarlo).
  Seis sitios por pieza (PS, MG, NIC = PS + MG calculado, sangrado, supuración, placa),
  movilidad y furca 0–3. `guardar_periodontograma()` valida en el servidor; al firmar,
  si se indica, programa el mantenimiento periodontal. Firmado no se edita; lo anula solo
  su responsable, con motivo. Comparación entre fechas (sitios que cambian ≥ 2 mm).
- **0920** `especialidades`: endodoncia por conducto, ortodoncia (diagnóstico y
  controles), implante y sus fases (la fecha de carga es la de la fase «en carga»),
  cirugía (técnica, sutura, retiro de puntos: el control se programa al firmar la
  evolución) y odontopediatría (apoderado y conducta). Se escriben en la evolución en
  borrador por su autor, ligados al ítem trabajado de esa especialidad; firmada, quedan
  fijos. Anular la evolución anula sus registros; anular un implante, sus fases.
- Pantallas (`HABILITAR_ETAPA9`): pestañas «Periodontograma» y «Especialidades»;
  formularios de especialidad dentro de la evolución en borrador.
- **A validar con la clínica piloto (regla 10):** convención del MG, grados de movilidad
  y furca (sin clasificación fija), nombres de las fases del implante, escala de Frankl.
- Revisión independiente: 2 altas, 2 medias, varias bajas; corregidas. Altas: la
  asistente podía anular un periodontograma firmado; la grilla conservaba los datos de
  otro borrador al cambiar de uno a otro. Medias: una pieza vaciada no se borraba;
  registros de una evolución anulada quedaban vigentes y bloqueaban el ítem. Pendiente
  menor: cada periodontograma firmado agrega su propio mantenimiento (sin deduplicar).
- En CI apareció un error real: «Guardar y firmar» llegaba al servidor como «guardar»
  (el botón que envía no llegaba en el formulario); ahora son dos formularios.
- Checklist: `docs/checklist-etapa9.md`.
- Remoto: CI verde (run 38030933815) y «Aplicar migraciones» run 38031491013 (respaldo
  previo): 0919–0920 aplicadas. Comprobado: 9 tablas nuevas con RLS y 4 funciones.
  Falta `HABILITAR_ETAPA9=1` en Vercel.

## v2 — Etapa 10 (laboratorio): aplicada en el remoto

- **0921** `laboratorio`: laboratorios de la clínica (los administra el admin) y
  `orden_laboratorio` vinculada al ítem del plan: pieza, tipo de trabajo, color,
  indicaciones, fechas de envío, entrega prevista y recepción, estado y costo (céntimos).
  Estados por funciones: enviar (y cambiar la entrega prevista), recibir, cancelar con
  motivo; la orden no se edita ni se borra. La prescribe el cirujano dentista; envío y
  recepción también la asistente; recepción no la ve.
- «Atrasada» se calcula con las fechas (en laboratorio y con la entrega prevista vencida);
  no se guarda, así no queda desactualizada. El tipo de seguimiento «laboratorio atrasado»
  (0917) no se usa por ahora: el atraso es del laboratorio, no un contacto con el paciente.
- Pantallas (`HABILITAR_ETAPA10`): Configuración → Laboratorios, pestaña «Laboratorio» del
  paciente, página «Laboratorio» y sección del Tablero clínico.
- `seed_etapa10.sql`: dos laboratorios y tres órdenes de demo (una atrasada).
- Checklist: `docs/checklist-etapa10.md`.
- Revisión: el agente revisor no pudo terminar (límite semanal de uso); la revisé yo
  (permisos, transiciones, fechas, consultas). Corregido: el seed no era idempotente del
  todo (al repetirlo agregaba órdenes en otras coronas). En CI: dos selectores del e2e.
  **Pendiente:** revisión independiente de la Etapa 10 cuando se restablezca el límite.
- Remoto: CI verde (run 38079448077) y «Aplicar migraciones» run 38079871097 (respaldo
  previo): 0921 aplicada; `seed_etapa10.sql` cargado por la API. Comprobado: 2
  laboratorios, 3 órdenes, 1 atrasada. Falta `HABILITAR_ETAPA10=1` en Vercel.

## v2 — Etapa 11 (exportar la historia clínica): aplicada en el remoto

- **0922** `exportacion_historia`: cada exportación con quién, cuándo y motivo, por
  `registrar_exportacion()` (solo el cirujano dentista), que también la escribe en la
  auditoría (acción «exportar»). No se edita ni se borra; la fusión la mueve.
- Pantallas (`HABILITAR_ETAPA11`): «Exportar historia clínica» en la ficha; pide el motivo
  y abre el documento A4 (imprimir o guardar como PDF desde el navegador, como recetas y
  consentimientos): filiación, historia y versiones, odontogramas con su dibujo,
  diagnósticos con adendas, planes, evoluciones firmadas con adendas, consentimientos y
  recetas; lo anulado se muestra marcado. El documento solo se abre desde una exportación
  propia de las últimas 2 horas (no se puede saltar el motivo).
- Checklist: `docs/checklist-etapa11.md`.
- En CI apareció una carrera en un e2e antiguo (recepción abría el duplicado que la prueba
  de fusión anulaba en paralelo); corregida.
- Remoto: CI verde (run 38081184700) y «Aplicar migraciones» run 38081664279 (respaldo
  previo): 0922 aplicada; tabla con RLS y función presentes. Falta `HABILITAR_ETAPA11=1`
  en Vercel. **Pendiente:** revisión independiente de las etapas 10 y 11 (límite semanal
  del agente revisor, se restablece el 13-oct).

## v2 — Etapa 12 (seed ampliado, guion de la demo y fechas al día)

- `seed_etapa12.sql` (idempotente): registros de especialidad coherentes con lo ya
  sembrado. Conductos de las endodoncias realizadas (seguidas de coronas); cirugía de las
  exodoncias, con un retiro de puntos vencido; implantes con sus fases (uno en fase
  protésica); 6 ortodoncias con caso y 5 controles mensuales; odontopediatría de los
  niños (con apoderado); 2 pacientes con 2 periodontogramas firmados para comparar.
- **0923** «refrescar fechas de la demo»: `privado.clinica_demo` (solo la clínica de
  demostración) y `privado.refrescar_fechas_demo()`, que corre todas las fechas de esa
  clínica los días transcurridos desde la última vez (sin tocar la auditoría ni las
  exportaciones). Solo la ejecuta el rol de servicio, desde el flujo manual «Refrescar
  fechas de la demo» (`.github/workflows/refrescar-demo.yml`, escribir `REFRESCAR`).
- Ficha del paciente: sección «Controles programados» (los vencidos en rojo).
- Guion: `docs/guion-demo.md`. Playwright: `e2e/flujo-completo.spec.ts` (alta → historia
  → odontograma → diagnóstico → plan → cita → evolución firmada → pago → control) y
  `e2e/guion-demo.spec.ts` (los casos del seed). Checklist: `docs/checklist-etapa12.md`.
- Seeds deterministas: laboratorio (seed10), ortodoncias y periodontogramas (seed12) elegían
  pacientes por uuid (distintos en cada base); ahora por apellidos y nombres.
- Tablero clínico: «Controles vencidos» muestra uno por paciente **y tipo** (antes, uno por
  paciente: un retiro de puntos podía quedar oculto tras un control más antiguo). Un control
  sigue sin contar como vencido si el paciente ya tiene cita (regla existente), **salvo el
  retiro de puntos** (decisión de Pedro, 10-oct): tiene plazo clínico, así que solo lo cubre
  la atención en o después de su fecha. Vale para los dos tableros; en el de gestión, si el
  paciente tiene varios controles vencidos, su fila es el retiro de puntos.
- Remoto: CI verde (run 38085707364); «Aplicar migraciones» run 38086112311 (respaldo
  previo): 0923 aplicada, clínica de demo registrada (referencia 2026-10-10).
  `seed_etapa12.sql` cargado por la API: 27 conductos, 12 cirugías, 1 retiro de puntos
  pendiente, 4 implantes (1 en fase protésica), 6 ortodoncias con 30 controles,
  20 registros de odontopediatría, 4 periodontogramas firmados. Los pacientes del guion
  coinciden con los del remoto. Había un periodontograma en borrador hecho a mano: se
  conserva (el seed ahora solo se salta ese bloque si ya hay periodontogramas firmados).
- **Pendiente:** revisión independiente de las etapas 10, 11 y 12 (límite semanal del
  agente revisor, se restablece el 13-oct). Encender `HABILITAR_ETAPA12` no hace falta:
  la etapa no agrega módulos nuevos detrás de una bandera.

## v2 — Etapa 13 (registro más ágil, pedido del odontólogo piloto)

Plan aprobado por Pedro (orden 13 → 17: ágil, atención rápida, personalización, prueba
gratuita por clínica, suscripción).

- **Odontograma:** las piezas del dibujo son botones de alternancia (antes, enlaces que
  recargaban la página). Se marcan varias piezas y el mismo hallazgo se guarda en todas en un
  solo envío, un registro por pieza (NTS 188). Se valida que cada pieza tenga la superficie
  (p. ej. no hay oclusal en un incisivo) y que pertenezca a la dentición del odontograma.
  El pintado por superficie ya existía desde la Etapa 4 (lo que vio el odontólogo era la v1).
- **Plan:** «Piezas (FDI)» admite una lista; se crea un ítem por pieza. El diagnóstico de
  origen elegido se lleva a cada pieza con su diagnóstico vigente del mismo CIE-10.
- **Certificado de descanso:** migración **0924** (aditiva), columna `tratamiento`, obligatoria
  en los certificados de descanso nuevos (trigger solo en insert: los anteriores no cambian).
  Se completa con lo trabajado en las evoluciones firmadas de esa fecha. La prueba SQL de
  recetas se actualizó a propósito (el descanso sin tratamiento ahora falla).
- Pendiente de confirmar con el odontólogo: si «una parte de la oclusal» pide algo más fino
  que la superficie (la NTS 188 registra por superficie; no se inventa nomenclatura).
- Checklist: `docs/checklist-etapa13.md`.
- Remoto: CI verde (run 38094381712); «Aplicar migraciones» run 38094718586 (respaldo
  previo): 0924 aplicada (columna y trigger presentes). Mientras producción tenga el código
  anterior, emitir un certificado de descanso falla con el mensaje «El certificado de
  descanso indica el tratamiento realizado»: se resuelve al fusionar el PR de esta etapa.

## Remoto al 2026-10-10

- Pedro autorizó («Hazlo»). «Aplicar migraciones» run 38013481738 (respaldo cifrado
  previo): 0910–0916 aplicadas y verificaciones en verde. Seeds 4, 5 y 7 cargados por la
  API. Comprobado: 130 códigos CIE-10, 115 exámenes, 169 diagnósticos, todos los
  odontogramas con dentición, todos los planes con grupo, 132 notas v1 firmadas,
  7 plantillas de consentimiento de ejemplo, 8 procedimientos con plantilla, bucket
  `clinico` privado, 120 pacientes vigentes.
- Falta: `HABILITAR_ETAPA4=1` … `HABILITAR_ETAPA7=1` en Vercel (Preview) y redeploy.
- Pedro autorizó «todo lo que consideres mejor para el proyecto» (2026-10-10):
  - Citas desfasadas del seed en el remoto: 7 citas pasadas que seguían programadas o
    confirmadas quedaron «atendida» y 1 cita futura superpuesta (26-oct, mismo
    profesional y sillón) se movió de 11:30 a 12:00–12:30 (hora de Lima; libre y dentro de su horario). Verificado: 0 citas pasadas abiertas y
    0 superposiciones. Los datos de la demo envejecen con los días: la Etapa 12 debe
    traer un «refrescar fechas de la demo».
  - Convención de superficies del odontograma: se mantiene la descrita en
    `docs/nts188-resumen.md` como decisión del proyecto, a validar con la clínica piloto
    (la NTS 188 no la fija).
  - Plantillas de consentimiento: siguen de ejemplo hasta tener los formatos reales.

## Próximas etapas (CLAUDE.md)

Etapas 0 a 12 terminadas (v2 en producción desde el 10-oct). Siguen: 13 registro ágil · 14 atención rápida · 15 personalización · 16 prueba gratuita por clínica · 17 suscripción.
Falta en `/docs`: formatos de la clínica piloto (historia y consentimientos),
necesarios antes de la Etapa 7. La Etapa 4 incluye además lo de las fichas
odonto-estomatológicas de la NTS 139 (índice CPOD/ceod, IHO-S, riesgo estomatológico
y alta básica odontológica).
