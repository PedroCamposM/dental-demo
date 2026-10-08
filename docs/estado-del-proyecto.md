# Estado del proyecto (bitácora de contexto)

> Este archivo existe para que cualquier sesión nueva (de Claude o de una persona)
> retome el trabajo sin depender de conversaciones anteriores. Se actualiza al cerrar
> cada rebanada. **Leerlo junto con `CLAUDE.md` antes de empezar.**

Última actualización: 2026-10-08 — Etapa 1 de la v2, en cierre.

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

Migraciones (aplicadas en CI; **aún no en el remoto** al momento de escribir esto):
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

### Pendiente para cerrar la Etapa 1

1. CI en verde en la rama de trabajo (último arreglo: formulario de paciente que
   perdía el sexo y el consentimiento tras un error; ver arriba).
2. Pedro corre «Aplicar migraciones» sobre la rama de trabajo.
3. Claude carga `seed_etapa1.sql` en el remoto y verifica conteos.
4. Encender `HABILITAR_ETAPA1=1` en Vercel (primero Preview, luego Production).
5. Checklist manual de Pedro con los 4 roles; luego fusionar la rama a `main`.

## Próximas etapas (CLAUDE.md)

2 catálogo y agenda · 3 historia clínica, signos y alertas · 4 examen, odontograma y
CIE-10 (revisar el catálogo de 38 hallazgos contra las 24 páginas de la NTS 188) ·
5 plan con fases · 6 evolución firmada · 7 consentimientos, recetas, imágenes ·
8 tablero clínico y caja · 9 especialidades · 10 laboratorio · 11 PDF · 12 seed y guion.
Faltan en `/docs`: norma técnica de historia clínica (NTS 139-MINSA/2018/DGAIN) y
formatos de la clínica piloto (necesarios antes de las etapas 3 y 7).
