# Guion de la demo

Recorrido de unos 20 minutos por la plataforma con los datos de demostración. Todos los pacientes son **ficticios** (los genera el seed). La prueba `e2e/guion-demo.spec.ts` recorre estos mismos casos, y `e2e/flujo-completo.spec.ts` hace el flujo de la parte 2.

## Antes de empezar

- **Usuarios** (contraseña de demo en `supabase/seed.sql`):

  | Rol | Correo | Persona |
  |---|---|---|
  | Admin (odontóloga) | `valverde@clinica-demo.example` | Dra. Lucía Valverde Ríos |
  | Odontóloga | `mendoza@clinica-demo.example` | Dra. Carla Mendoza Paredes |
  | Odontólogo | `alvarado@clinica-demo.example` | Dr. Martín Alvarado Cruz |
  | Asistente | `asistente@clinica-demo.example` | Milagros Ruiz Arana |
  | Recepción | `recepcion@clinica-demo.example` | Rosa Chávez Liñán |

- **Fechas al día.** Si la demo se cargó hace días, correr en GitHub → Actions el flujo **«Refrescar fechas de la demo»** (escribir `REFRESCAR`). Mueve todas las fechas de la clínica de demostración los días transcurridos: vuelven a estar las citas de hoy, las mismas cuotas vencidas y los mismos controles atrasados. No toca la auditoría.
- Usar la PC para la recepción y la tablet (o una ventana angosta) para el consultorio.

## 1. Recepción: la mañana (Rosa, recepción)

1. **Agenda**: citas del día por profesional y sillón. Al pasar el cursor sobre una cita se ven las alertas clínicas del paciente.
2. **Pacientes → buscar** «Zavaleta» (o un DNI o teléfono). Abrir **Diana Zavaleta Cerna**: el banner rojo dice *Alergia: Penicilina*.
3. Mostrar que la recepción **no ve** las pestañas clínicas (Evolución, Consentimientos…): los permisos están en la base de datos (RLS), no solo en la pantalla.
4. **Pacientes → Nuevo**: intentar registrar a alguien con un DNI ya existente → lo impide. Con mismo nombre y fecha de nacimiento → avisa de posible duplicado.
5. **Gestión** (Tablero de gestión): presupuestos abiertos, cuotas vencidas y tratamientos detenidos, con el botón de WhatsApp para contactar.

## 2. Consultorio: un paciente nuevo de principio a fin (Dra. Mendoza)

Paciente nuevo, registrado por la recepción.

1. **Historia clínica**: motivo de consulta y antecedentes; anotar una alergia → aparece en el banner al instante. Guardar crea la versión 1 (las anteriores se conservan).
2. **Signos vitales** (los puede registrar la asistente).
3. **Odontograma** inicial (NTS 188): caries oclusal en la 36. Mostrar que se pueden tocar varias piezas (p. ej. 16, 26, 36) y registrar el mismo hallazgo en todas de una vez, sin recargar.
4. Del hallazgo → **Registrar diagnóstico** (CIE-10 K02.1, definitivo).
5. Del diagnóstico → **Agregar al plan**: el procedimiento toma precio y duración del catálogo; el ítem queda con su diagnóstico de origen. **Registrar aceptación** del paciente.
6. **Agenda → Atender**: abre la evolución de la sesión. Marcar el ítem trabajado y terminado, describir lo realizado y **Firmar y cerrar**. La evolución firmada ya no se edita (solo adendas).
7. El ítem pasa a **realizado** y el plan a **Terminado**; en la ficha aparece el **control programado**.
8. Recepción **cobra** (por ejemplo, Yape): saldo S/ 0.00.

## 3. Casos clínicos del seed (Dra. Mendoza)

| Caso | Dónde mirarlo | Paciente del seed |
|---|---|---|
| Paciente anticoagulado | Banner de alertas | Jimena Horna Cerna (warfarina) |
| Endodoncias seguidas de coronas | Plan y Especialidades → Endodoncia (conductos) | Tratamientos en curso del Tablero clínico |
| Ortodoncia con controles mensuales | Especialidades → Ortodoncia: «Controles (5)» | Camila Cruz Ruiz |
| Implante en fase protésica | Especialidades → Implantes | Diana Lescano Torres |
| Niño con apoderado | Filiación → Apoderado; Especialidades → Odontopediatría (conducta Frankl) | Víctor Ramírez Burgos |
| Cirugía con retiro de puntos pendiente | Tablero clínico → Controles vencidos: «Retiro de puntos» (figura aunque ya tenga cita más adelante); también en la ficha → Controles programados; Especialidades → Cirugía | Ricardo Benites Neyra |
| Trabajo de laboratorio atrasado | Tablero clínico → Trabajos de laboratorio; menú Laboratorio | La corona de zirconio marcada «Atrasado» |
| Periodontograma con comparación | Periodontograma → Comparar fechas | Mariela Alvarado Rodríguez |

**Tablero clínico**: tratamientos en curso, evoluciones sin firmar, consentimientos pendientes, controles vencidos, tratamientos detenidos y laboratorio por llegar. Cada fila lleva al paciente.

## 4. Documentos (Dra. Mendoza)

1. **Consentimientos**: imprimir el de un procedimiento, subir el escaneo firmado. Un ítem que lo requiere no se puede dar por realizado sin él.
2. **Recetas y documentos**: receta escrita por la profesional (el sistema **no sugiere dosis**), constancia de atención. PDF con número de colegiatura.
3. **Interconsultas**: derivación interna (crea una tarea al especialista) o externa (PDF imprimible).
4. **Exportar historia clínica**: pide motivo, queda en la auditoría y genera el documento completo para imprimir o guardar como PDF.

## 5. Cierre del día (Rosa, recepción, o la admin)

1. **Caja**: resumen por método de pago y por profesional; registrar el efectivo contado y la diferencia; cerrar. Los pagos de un día cerrado ya no se editan (solo ajustes con motivo).
2. **Seguridad de sesión**: la sesión se cierra sola tras 15 minutos sin uso; en la tablet, «Bloquear pantalla».

## 6. Administración (Dra. Valverde, admin)

- **Configuración**: catálogo de procedimientos y aranceles, horarios por profesional y sillón, bloqueos (feriados, vacaciones), laboratorios, tiempo de inactividad.
- Una cita fuera de horario solo la puede forzar la admin, con motivo.
- **Fusión de duplicados**: solo admin, queda en la auditoría.
