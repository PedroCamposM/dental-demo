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

## v2 — Etapa 4 (examen, odontograma y CIE-10): en la rama, falta migrar el remoto

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
- Pendiente para cerrar la Etapa 4: índices CPOD/ceod e IHO-S y riesgo
  estomatológico (NTS 139, 12.x) necesitan una norma en `/docs` que los defina; la
  NTS 188 no los trata.

## Próximas etapas (CLAUDE.md)

5 plan con fases · 6 evolución firmada · 7 consentimientos, recetas, imágenes ·
8 tablero clínico y caja · 9 especialidades · 10 laboratorio · 11 PDF · 12 seed y guion.
Falta en `/docs`: formatos de la clínica piloto (historia y consentimientos),
necesarios antes de la Etapa 7. La Etapa 4 incluye además lo de las fichas
odonto-estomatológicas de la NTS 139 (índice CPOD/ceod, IHO-S, riesgo estomatológico
y alta básica odontológica).
