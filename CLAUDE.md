# CLAUDE.md — Software clínico dental (v2: ampliación clínica)

## Contexto: qué ya existe y qué cambia

La plataforma **ya está construida** con la versión 1 de este archivo. Hoy está centrada en el plan de tratamiento y la gestión económica, y tiene:

- clínicas, usuarios con roles admin, odontólogo y recepción, y RLS;
- pacientes;
- odontograma simple;
- plan de tratamiento con ítems y estados;
- citas vinculadas a ítems;
- pagos y cuotas;
- seguimiento por WhatsApp (`wa.me`);
- tablero de "dinero en riesgo";
- auditoría;
- datos de demo.

**La v2 no se empieza de cero.** Se **amplía** lo existente para que el sistema cubra **la atención clínica completa del paciente**: historia clínica, examen, diagnóstico, evolución, especialidades, recetas, consentimientos, imágenes y continuidad del tratamiento. La parte económica se mantiene como un módulo más.

### Reglas para modificar lo existente

1. **Antes de cambiar nada**, revisar el código y el esquema actuales y compararlos con este documento (ver Etapa 0).
2. Las migraciones son **aditivas**: se agregan tablas y columnas. No se borran tablas ni columnas con datos sin proponerlo y esperar aprobación.
3. Si hay que cambiar el significado de un campo existente, crear una migración de datos explícita y probarla con el seed.
4. Los tests que ya existen deben seguir pasando. Si una regla de la v2 los contradice a propósito, actualizar el test y decirlo.
5. Ninguna pantalla actual debe quedar rota al terminar una etapa.

## Objetivo del sistema

Acompañar al paciente de principio a fin:

**primera consulta → historia → examen → diagnóstico → plan → sesiones → alta → controles**

El sistema persigue dos cosas:

- **Clínico:** historia completa y segura; tratamiento ejecutado bien, en orden y hasta el final.
- **Gestión:** ver lo pendiente, lo detenido y lo no cobrado, y a quién contactar.

El **plan de tratamiento** sigue siendo el eje, pero ahora se alimenta del diagnóstico y produce evoluciones clínicas.

## Stack (sin cambios)

- Next.js (App Router) + TypeScript estricto + Tailwind
- Supabase (Postgres, Auth, Storage privado, RLS)
- Vercel
- Vitest y Playwright
- Español (Perú), soles (S/), zona horaria America/Lima
- Uso en la PC de recepción y en tablet en el consultorio

## Cambios sobre lo existente

| Elemento actual | Cambio en v2 |
|---|---|
| **Roles** (admin, odontólogo, recepción) | Agregar **asistente**. Recepción **deja de ver** las notas clínicas detalladas (ajustar RLS). Solo el odontólogo firma |
| **Paciente** | Ampliar la filiación: tipo de documento (DNI, CE o pasaporte), sexo, ocupación, dirección, contacto de emergencia y apoderado (obligatorio si es menor) |
| **Odontograma simple** | Separar el odontograma **inicial** de los de **evolución**. Dentición permanente, temporal y mixta. Nomenclatura según NTS 188 (ver `/docs`). Migrar los registros actuales como "inicial" |
| **Plan de tratamiento** | Agregar **fases**, **dependencias** entre ítems, **diagnóstico de origen** por ítem, **alternativas y versiones** con fecha de aceptación |
| **Estados de `item_plan`** | Separar el **estado clínico** (propuesto, aceptado, programado, realizado o cancelado) del **estado de cobro**, que se calcula a partir de los pagos. Migrar los ítems en "cobrado" a "realizado" con su pago vinculado |
| **Regla "realizado = tiene nota"** | Ahora un ítem realizado requiere una **evolución firmada** y, si corresponde, un **consentimiento firmado** |
| **Citas** | Agregar sillón, el estado "en sala" y, al atender, la apertura de la evolución de la sesión |
| **Seguimiento** | Agregar tipos clínicos: control posoperatorio, retiro de puntos, control de ortodoncia, mantenimiento periodontal, control anual y laboratorio atrasado |
| **Tablero "dinero en riesgo"** | Pasa a llamarse **Tablero de gestión** y se mantiene. Se agrega un **Tablero clínico** |
| **Auditoría** | Registrar también accesos (lectura) a la historia clínica y las firmas |
| **Seed** | Ampliar con historia clínica coherente (ver Datos de demo) |

## Módulos nuevos

### Historia clínica

- Anamnesis: motivo de consulta y enfermedad actual.
- Antecedentes médicos: enfermedades sistémicas, cirugías, hospitalizaciones, medicación actual, alergias, embarazo o lactancia.
- Hábitos.
- Antecedentes odontológicos.
- El cuestionario de salud es **versionado con fecha**. Las versiones anteriores se conservan.

### Signos vitales por consulta

PA, FC, FR, temperatura, peso y talla. Los puede registrar el asistente.

### Alertas clínicas

Banner fijo en **todas** las pantallas del paciente, incluida la agenda al pasar el cursor sobre la cita. Muestra alergias, anticoagulantes, condiciones sistémicas relevantes y embarazo. **Solo muestra lo registrado; no da recomendaciones médicas.**

### Examen clínico

- Extraoral: ATM, ganglios, asimetrías y labios.
- Intraoral: mucosas, encía, lengua, paladar, piso de boca, higiene y oclusión.

### Diagnóstico

- Códigos CIE-10, principalmente el capítulo K00–K14, con buscador.
- Asociado a pieza o superficie; presuntivo o definitivo.
- Un hallazgo del odontograma puede convertirse en diagnóstico y luego en un ítem del plan.

### Evolución clínica por sesión

- Datos: profesional, ítems trabajados, anestesia (tipo y cantidad), materiales, descripción, incidencias, indicaciones y próxima cita sugerida.
- **Firmada al cerrar.** Después solo admite **adendas** con fecha y autor.

### Periodontograma

- Seis sitios por pieza: profundidad de sondaje, margen gingival o recesión, nivel de inserción calculado, sangrado, supuración y placa.
- Por pieza: movilidad y furca.
- Comparación entre fechas.

### Registros por especialidad

Se asocian al ítem del plan y a la evolución.

- **Endodoncia:** por conducto, con longitud de trabajo, referencia, lima maestra, irrigación, técnica de obturación y sesiones.
- **Ortodoncia:** diagnóstico, aparatología, controles mensuales (arcos, ligaduras, activaciones, observaciones) y fotos de evolución.
- **Implantes:** marca, diámetro, longitud, lote, torque, fase y fecha de carga.
- **Cirugía:** técnica y sutura; genera un control de retiro de puntos.
- **Odontopediatría:** apoderado presente y conducta.
- **Periodoncia:** usa el periodontograma y el plan de mantenimiento.

### Recetas e indicaciones

- El profesional escribe medicamento, presentación, dosis, frecuencia y duración, y puede usar plantillas propias.
- **El sistema nunca sugiere dosis.**
- Se genera un PDF con los datos del profesional y su número de colegiatura.

### Consentimientos informados

- Plantilla por procedimiento, editable por la clínica. Las plantillas de ejemplo dicen que la clínica debe revisarlas.
- El paciente o apoderado firma en pantalla y se guarda el PDF con fecha.
- El consentimiento queda vinculado al ítem del plan.

### Imágenes y archivos

- Radiografías, fotos intra y extraorales y documentos, por fecha, pieza y sesión.
- Se guardan en Storage **privado** con URLs firmadas de corta duración.

### Laboratorio

Orden de trabajo con pieza, tipo de trabajo, laboratorio, color, fechas de envío y entrega, estado y costo. Está vinculada al ítem del plan.

### Tablero clínico

Muestra:

- tratamientos en curso;
- evoluciones sin firmar;
- consentimientos pendientes;
- controles vencidos;
- tratamientos detenidos;
- trabajos de laboratorio por llegar.

### Catálogo de procedimientos y aranceles

- Lista de procedimientos de la clínica, cada uno con:
  - código interno y nombre;
  - especialidad;
  - precio base y duración estándar;
  - si requiere consentimiento (y cuál);
  - si genera control automático (y a los cuántos días).
- Lo administra el rol admin.
- El plan toma el precio y la duración del catálogo, pero el odontólogo puede ajustarlos en cada ítem.
- Si ya existe una lista de precios en la v1, se amplía y no se duplica.

### Horarios de profesionales

- Días y horas de atención por profesional y por sillón (especialistas que solo van ciertos días).
- Bloqueos por vacaciones, feriados o capacitación.
- La agenda no permite citar fuera de horario ni sobre un bloqueo, salvo que admin lo fuerce y quede registrado.

### Búsqueda de pacientes y duplicados

- Búsqueda rápida por DNI, nombre o teléfono.
- No se permite crear dos pacientes con el mismo tipo y número de documento.
- Si se detecta un posible duplicado (nombre y fecha de nacimiento iguales), se avisa antes de crear.
- Fusión de duplicados: solo admin, con registro en la auditoría.

### Exportar historia clínica

- PDF completo del paciente:
  - filiación;
  - historia y sus versiones;
  - odontogramas;
  - diagnósticos;
  - planes;
  - evoluciones firmadas con sus adendas;
  - consentimientos;
  - recetas.
- Cada exportación queda registrada en la auditoría (quién, cuándo y motivo).

### Interconsultas y derivaciones

- Interna: a otro especialista de la clínica. Crea una tarea para ese profesional.
- Externa: a un médico u otro centro, con motivo, datos clínicos relevantes y PDF imprimible.
- Se registra la respuesta o resultado (por ejemplo, el riesgo quirúrgico) y se adjunta el documento.

### Constancias y certificados

Constancia de atención y certificado de descanso, con plantilla, datos del profesional y su número de colegiatura, y PDF. Solo los emite el odontólogo y quedan registrados en la historia.

### Consentimiento de uso de imagen

- Consentimiento separado y opcional para usar fotos del paciente con fines académicos o de difusión.
- Las imágenes sin este consentimiento quedan marcadas como **solo uso clínico**.

### Cierre de caja diario

- Resumen del día por método de pago (efectivo, Yape, Plin, tarjeta y transferencia) y por profesional.
- Registro del efectivo contado y de la diferencia.
- Una vez cerrado, los pagos de ese día no se editan; solo se corrigen con un movimiento de ajuste con motivo.

### Seguridad de sesión

- Cierre de sesión automático tras 15 minutos de inactividad (configurable por la clínica).
- Bloqueo rápido de pantalla para la tablet del consultorio.

## Reglas que NO se rompen

1. Los datos clínicos **nunca se borran**. Se anulan con motivo y queda el registro.
2. Las evoluciones y diagnósticos firmados no se editan; solo admiten adendas.
3. Ítem realizado = evolución firmada + consentimiento firmado si el procedimiento lo requiere.
4. Las alertas clínicas son visibles en toda vista del paciente.
5. Al terminar un plan o un procedimiento quirúrgico, se crean automáticamente los controles que correspondan.
6. Un plan se considera detenido cuando tiene ítems aceptados sin realizar y no tiene cita en los próximos 30 días (regla existente).
7. Los montos se guardan en céntimos (enteros) (regla existente).
8. Toda tabla lleva `clinica_id` y tiene RLS activado. Las tablas nuevas no se exponen automáticamente: cada migración incluye los `GRANT` necesarios para `authenticated` (y para `anon` solo si hace falta) y sus políticas.
9. Los permisos clínicos por rol se aplican en RLS, no solo en la interfaz.
10. No inventar normativa ni nomenclatura clínica. Si falta un documento en `/docs`, pedirlo.
11. Sin IA en decisiones clínicas.

## Documentos de referencia (`/docs`)

- NTS 188-MINSA/DGIESP-2022, sobre el odontograma
- Norma técnica de historia clínica vigente
- Historia clínica y consentimientos reales de una clínica piloto, anonimizados

## Orden de trabajo

Cada etapa cierra con build, lint, Vitest y Playwright en verde, y sin pantallas rotas.

0. **Auditoría (sin cambiar código).** Revisar el código y el esquema actuales contra este documento y entregar:
   - qué existe y cumple;
   - qué existe y hay que modificar;
   - qué falta;
   - riesgos de migración.

   Esperar aprobación antes de seguir.
1. Roles: agregar asistente y restringir lo clínico en RLS. Ampliar la filiación del paciente. Búsqueda, control de duplicados y seguridad de sesión.
2. Catálogo de procedimientos y aranceles. Horarios y bloqueos de los profesionales en la agenda.
3. Historia clínica versionada, signos vitales y alertas.
4. Examen clínico, odontograma inicial y de evolución (con migración del actual) y diagnóstico CIE-10.
5. Plan de tratamiento: fases, dependencias, diagnóstico de origen y versiones, tomando precios del catálogo. Separar el estado clínico del cobro (con migración).
6. Evolución por sesión con firma y adendas, conectada a la cita.
7. Consentimientos (incluido el de uso de imagen), recetas, imágenes, constancias e interconsultas.
8. Seguimiento clínico y tablero clínico. El tablero de gestión se mantiene. Cierre de caja diario.
9. Especialidades y periodontograma.
10. Laboratorio.
11. Exportar la historia clínica completa en PDF.
12. Actualizar el seed y los tests de Playwright del guion de demo.

**Sigue fuera de alcance:** facturación SUNAT, API de WhatsApp, IA, inventario, multisede, app móvil y portal del paciente.

## Sistema de calidad (obligatorio)

El objetivo es **casi cero errores** frente al usuario. Nada se da por terminado si no cumple todo lo que sigue.

### Antes de tocar la base de datos

- Respaldo con la CLI de Supabase (`db dump`) antes de **cada** migración. Guardarlo fuera del repo.
- Cada migración se prueba primero contra una base local (`npx supabase start`), con el seed completo, y recién después se aplica al proyecto remoto.
- Toda migración de datos incluye un script de verificación: conteos antes y después, y ningún registro huérfano.

### Tests que deben existir

- **Una prueba por cada regla de "Reglas que NO se rompen".** Por ejemplo: intentar editar una evolución firmada debe fallar; intentar marcar como realizado un ítem sin consentimiento debe fallar.
- **Pruebas de RLS por rol.** Con usuarios reales de cada rol (admin, odontólogo, asistente y recepción), verificar qué puede ver y hacer cada uno. Verificar también que una clínica nunca ve datos de otra.
- **Validaciones en el servidor**, no solo en el formulario: campos obligatorios, fechas coherentes, montos positivos y DNI de 8 dígitos.
- **Playwright** para cada flujo principal:
  - alta de paciente → historia → odontograma → diagnóstico → plan → cita → evolución firmada → pago → control;
  - el guion completo de la demo.
- Los tests existentes de la v1 siguen pasando.

### Verificación automática

- TypeScript estricto, sin `any` y sin `@ts-ignore`.
- `npm run build`, lint, Vitest y Playwright en verde antes de cada commit.
- GitHub Actions corre todo lo anterior en cada push. Si falla, no se despliega.
- Vercel crea una vista previa por rama. Se revisa ahí antes de pasar a la rama principal.

### Revisión antes de cerrar cada etapa

1. Claude entrega: lista de archivos cambiados, migraciones aplicadas, tests agregados y la salida real de los tests (no un resumen).
2. Una revisión independiente del diff (`/review` o un subagente que no escribió el código) busca errores, casos borde y huecos de RLS.
3. Pedro hace la prueba manual con los cuatro roles, siguiendo la checklist de la etapa que Claude debe entregar.
4. Recién entonces se fusiona la rama y se pasa a la siguiente etapa.

### Errores en producción

- Mensajes de error claros en español para el usuario. Nunca mostrar pantallas en blanco ni errores técnicos.
- Registro de errores del lado del servidor para poder rastrearlos.

## Forma de trabajar

- Antes de cada etapa, proponer el plan (migraciones, RLS, pantallas y reglas) y esperar aprobación.
- Trabajar en rebanadas pequeñas, con commit por rebanada.
- Si algo clínico o normativo no está claro, preguntar en lugar de suponer.

## Datos de demo

Ampliar el seed actual sin perder los casos de gestión que ya tiene: presupuestos abiertos, cuotas vencidas y tratamientos detenidos. Agregar historia clínica coherente para cada paciente:

- pacientes con alertas (alergia a penicilina, paciente anticoagulado);
- endodoncias seguidas de coronas;
- ortodoncias con controles mensuales;
- un implante en fase protésica;
- niños con apoderado;
- una cirugía con retiro de puntos pendiente;
- un trabajo de laboratorio atrasado.

Agregar un asistente al personal. **Nunca usar datos reales de pacientes.**
