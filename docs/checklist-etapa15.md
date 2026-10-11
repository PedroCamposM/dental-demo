# Checklist manual — Etapa 15 (personalización de la clínica)

Se prueba después de aplicar la migración 0928 y encender `HABILITAR_ETAPA15=1` en Vercel.
Contraseña: `DemoTrujillo2026`.

- [ ] Admin (Dra. Valverde) → Configuración → «Marca de la clínica».
- [ ] Color: el selector y el campo #RRGGBB muestran cómo se ven los botones. Un color muy
      claro (p. ej. amarillo) avisa y no se guarda.
- [ ] Al guardar un color, toda la app lo usa (botones, enlaces, pestañas) y aparece una
      franja de ese color arriba del encabezado.
- [ ] Logo PNG/JPG/WebP de hasta 512 KB: aparece en el encabezado de la app. Un SVG, un PDF o
      un archivo pesado no se acepta. «Quitar el logo» lo quita.
- [ ] Dirección, teléfono, correo y pie: aparecen en recetas, constancias, certificados,
      consentimientos, interconsultas y en la exportación de la historia clínica.
- [ ] Odontólogo, asistente y recepción ven la marca, pero no la Configuración.
- [ ] Sin color ni logo, todo se ve como antes.
