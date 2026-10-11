import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import type { Mensaje } from "@/lib/correos";
import { registrarError } from "@/lib/registro";

// Envío por el SMTP de Gmail (SMTP_USER / SMTP_PASS en Vercel, solo Production). Sin esas
// variables no se envía nada (vistas previas, CI, local) y la app sigue funcionando.
export function correoConfigurado(): boolean {
  return !!process.env.SMTP_USER && !!process.env.SMTP_PASS;
}

/** Transporte con tiempos cortos (un Gmail lento no debe colgar la app). `pool` para enviar varios. */
export function crearTransporte(pool = false): Transporter | null {
  if (!correoConfigurado()) return null;
  return nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true, pool,
    connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 15000,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

export async function enviarCorreo(para: string, m: Mensaje, contexto: string, transporte = crearTransporte()): Promise<boolean> {
  if (!transporte) return false;
  try {
    await transporte.sendMail({
      from: { name: "Dental Demo", address: process.env.SMTP_USER! }, to: para,
      subject: m.asunto, text: m.texto, html: m.html,
    });
    return true;
  } catch (e) {
    registrarError(`correo.${contexto}`, e);
    return false;
  }
}

/** URL pública de la app para los enlaces de los correos. */
export function urlApp(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://dental-demo-sigma.vercel.app").replace(/\/$/, "");
}
