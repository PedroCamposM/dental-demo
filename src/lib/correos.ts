// Etapa 18: textos de los correos a las clínicas (desde contacto.hud@gmail.com). Sin datos
// clínicos: solo la cuenta y el plan.
import { CORREO_CONTACTO } from "@/lib/prueba";

export type TipoCorreo = "bienvenida" | "vence_pronto" | "vencido" | "sin_uso" | "pago_confirmado" | "pago_rechazado";
export type DatosCorreo = {
  nombre: string; clinica: string; url: string;
  plan?: "prueba" | "activo" | string; fecha?: string; motivo?: string;
};
export type Mensaje = { asunto: string; texto: string; html: string };

const escapar = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** «2026-10-18» → «18/10/2026». */
export function fechaCorta(fecha: string): string {
  const [a, m, d] = fecha.split("-");
  return a && m && d ? `${d}/${m}/${a}` : fecha;
}

export function armarCorreo(tipo: TipoCorreo, d: DatosCorreo): Mensaje {
  const enlacePlan = `${d.url}/configuracion/plan`;
  const fecha = d.fecha ? fechaCorta(d.fecha) : "";
  const queVence = d.plan === "prueba" ? "tu prueba gratuita" : "tu plan";
  const partes: Record<TipoCorreo, { asunto: string; parrafos: string[]; boton?: [string, string] }> = {
    bienvenida: {
      asunto: `Bienvenida a Dental Demo, ${d.clinica}`,
      parrafos: [
        `Tu clínica ${d.clinica} ya está lista, con 30 días de prueba gratuita.`,
        "Empieza registrando a tu primer paciente real, agenda una cita y personaliza el logo y el color en Configuración.",
        "Los 3 pacientes de ejemplo son ficticios: puedes anularlos cuando quieras.",
      ],
      boton: ["Entrar a Dental Demo", d.url],
    },
    vence_pronto: {
      asunto: `${queVence === "tu plan" ? "Tu plan" : "Tu prueba gratuita"} vence el ${fecha}`,
      parrafos: [
        `${queVence.charAt(0).toUpperCase()}${queVence.slice(1)} de ${d.clinica} vence el ${fecha}.`,
        "Para seguir registrando sin interrupciones, elige tu plan y reporta tu pago en «Plan y pagos».",
      ],
      boton: ["Ver planes y pagar", enlacePlan],
    },
    vencido: {
      asunto: `${queVence === "tu plan" ? "Tu plan venció" : "Tu prueba gratuita terminó"}: ${d.clinica} está en solo lectura`,
      parrafos: [
        `${queVence.charAt(0).toUpperCase()}${queVence.slice(1)} de ${d.clinica} venció el ${fecha}.`,
        "Tus datos están a salvo: puedes verlos y exportar las historias, pero no registrar nada nuevo hasta activar el plan.",
      ],
      boton: ["Activar mi plan", enlacePlan],
    },
    sin_uso: {
      asunto: `¿Te ayudamos con Dental Demo, ${d.clinica}?`,
      parrafos: [
        `Notamos que ${d.clinica} no usa Dental Demo desde hace unos días.`,
        `Si algo no te quedó claro o necesitas ayuda para empezar, respóndenos a ${CORREO_CONTACTO}.`,
      ],
      boton: ["Entrar a Dental Demo", d.url],
    },
    pago_confirmado: {
      asunto: "Confirmamos tu pago",
      parrafos: [`Gracias. Confirmamos el pago de ${d.clinica}: tu plan está activo hasta el ${fecha}.`],
      boton: ["Ver mi plan", enlacePlan],
    },
    pago_rechazado: {
      asunto: "No pudimos confirmar tu pago",
      parrafos: [
        `No pudimos confirmar el pago reportado por ${d.clinica}.`,
        `Motivo: ${d.motivo ?? "—"}`,
        `Revisa los datos y vuelve a reportarlo, o respóndenos a ${CORREO_CONTACTO}.`,
      ],
      boton: ["Ver mis pagos", enlacePlan],
    },
  };
  const p = partes[tipo];
  const saludo = `Hola, ${d.nombre}:`;
  const texto = [saludo, "", ...p.parrafos, ...(p.boton ? ["", `${p.boton[0]}: ${p.boton[1]}`] : []), "", `Dental Demo · ${CORREO_CONTACTO}`]
    .join("\n");
  const html = [
    `<p>${escapar(saludo)}</p>`,
    ...p.parrafos.map((x) => `<p>${escapar(x)}</p>`),
    p.boton ? `<p><a href="${escapar(p.boton[1])}">${escapar(p.boton[0])}</a></p>` : "",
    `<p style="color:#6b7280;font-size:12px">Dental Demo · ${escapar(CORREO_CONTACTO)}</p>`,
  ].join("\n");
  return { asunto: p.asunto, texto, html };
}
