# NTS 139-MINSA/2018/DGAIN: qué cubre la plataforma

Referencia: `docs/NTS-139-MINSA-2018-DGAIN-historia-clinica.md` (Norma Técnica de
Salud para la Gestión de la Historia Clínica). Este cuadro dice qué pide la norma,
dónde está en el sistema y qué falta. No reemplaza la revisión de la clínica.

## Ya cubierto (Etapas 1 a 3)

| Pide la NTS 139 | Dónde está |
|---|---|
| 4.2.1 Cada atención con fecha, hora, nombre y colegiatura del profesional | Historia y signos guardan `registrado_por` y `registrado_at`; la pantalla muestra el nombre con su COP |
| 4.2.1 En menores: nombre y DNI del padre, madre o apoderado antes de atender | Apoderado obligatorio en menores (formulario, servidor y trigger de la base) |
| 4.2.23 N° de historia clínica = DNI, carné de extranjería o pasaporte | Se muestra «Historia clínica N° …» con el documento; es único por clínica |
| Formato de Filiación: nombres, fecha de nacimiento, edad, sexo, domicilio actual, teléfono, documento, ocupación | Filiación v1 y Etapa 1 |
| Formato de Filiación: lugar de nacimiento, grupo sanguíneo y factor Rh, domicilio de procedencia, N° de seguro (SIS, EsSalud, otros), estado civil, grado de instrucción, religión, domicilio del responsable | Migración 0908 (`filiacion_nts139`), opcionales. Las listas de estado civil y grado de instrucción siguen las del anexo de la norma |
| Anamnesis: motivo de consulta, forma de inicio, tiempo de enfermedad, relato, funciones biológicas | Cuestionario de salud (0909) |
| Antecedentes personales (patológicos, cirugías, hospitalizaciones, medicación, alergias) y familiares | Cuestionario de salud (0909) |
| Datos sensibles (Ley 29733): consentimiento y acceso restringido | Consentimiento de datos al registrar; lo clínico solo para el equipo clínico (RLS); recepción ve «reservado»; la religión es opcional |
| Trazabilidad del acceso a la historia electrónica | Cada lectura de la historia queda en la auditoría |
| Correcciones sin borrar lo anterior | El cuestionario es versionado (no se edita); los signos se anulan con motivo |

## Falta, y en qué etapa llega

| Pide la NTS 139 | Etapa |
|---|---|
| Examen físico y odontológico | 4 |
| Fichas odonto-estomatológicas (12.1 y 12.2): odontograma inicial y final, índice de caries (CPOD/ceod), IHO-S, placa blanda y calcificada, riesgo estomatológico, diagnóstico CIE-10, tratamiento efectuado, alta básica odontológica con fecha | 4 (examen, odontograma, CIE-10, índices) y 6 (tratamiento efectuado y alta) |
| Diagnóstico CIE-10 presuntivo o definitivo | 4 |
| Consultas siguientes: tratamiento, exámenes auxiliares, referencia y fecha de próxima cita | 6 (evolución) y 7 (interconsultas) |
| Firma del profesional en cada atención | 6 (evolución firmada). Hoy se registra el autor autenticado; no hay firma digital certificada (la norma la pide para la historia clínica *electrónica*; sin ella el sistema es una historia *informatizada*) |
| Consentimiento informado, referencia y contrarreferencia | 7 |
| Ficha de la gestante (12.3) | Por revisar con la clínica piloto |
| N° de historia provisional para pacientes sin documento | Pendiente: hoy el paciente sin documento aparece «sin número» |
| Formatos impresos de la historia | 11 (PDF de la historia completa) |

## Decisiones tomadas

- El grupo sanguíneo y el factor Rh se guardan juntos (`O+`, `A-`…), en la filiación,
  como pide el formato; no es una alerta clínica.
- El seguro es una lista (ninguno, SIS, EsSalud, EPS, privado, otro) más el número
  de afiliación. El SOAT no se incluye porque corresponde a accidentes de tránsito,
  no a la afiliación del paciente.
- Lo propio de cada consulta (motivo, tiempo de enfermedad, forma de inicio, relato y
  funciones biológicas) empieza vacío en cada versión nueva del cuestionario; los
  antecedentes se copian de la versión vigente para revisarlos.
