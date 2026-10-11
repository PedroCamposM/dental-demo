import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { crearTransporte, enviarCorreo, urlApp } from "@/lib/correo-servidor";
import { armarCorreo, type TipoCorreo } from "@/lib/correos";
import { procesarPendientes } from "@/lib/envio-diario";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { clienteServicio } from "@/lib/supabase/servicio";

// Tarea diaria (Vercel Cron, 9:00 de Lima): avisos de vencimiento, vencido y sin uso. Vercel
// manda «Authorization: Bearer CRON_SECRET». Cada correo se reserva antes de enviarlo.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Pendiente = { clinica_id: string; tipo: TipoCorreo; referencia: string; para: string; nombre: string; clinica: string;
  plan: string; fecha: string | null };

function autorizado(cabecera: string | null): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || !cabecera) return false;
  const a = Buffer.from(cabecera);
  const b = Buffer.from(`Bearer ${secreto}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!modulos.etapa18 || !autorizado(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const supabase = clienteServicio();
  if (!supabase) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  const { data, error } = await supabase.rpc("correos_pendientes");
  if (error) {
    registrarError("cron.correos_pendientes", error);
    return NextResponse.json({ error: "No se pudo leer la lista" }, { status: 500 });
  }
  const transporte = crearTransporte(true);
  try {
    const resultado = await procesarPendientes((data ?? []) as Pendiente[], {
      reservar: async (p) => {
        const r = await supabase.rpc("reservar_correo", { id_clinica: p.clinica_id, tipo_correo: p.tipo, ref: p.referencia, destinatario: p.para });
        if (r.error) registrarError("cron.reservar_correo", r.error);
        return r.data === true;
      },
      enviar: (p) => enviarCorreo(p.para, armarCorreo(p.tipo, {
        nombre: p.nombre, clinica: p.clinica, url: urlApp(), plan: p.plan, fecha: p.fecha ?? undefined,
      }), `cron.${p.tipo}`, transporte),
      liberar: async (p) => {
        const r = await supabase.rpc("liberar_correo", { id_clinica: p.clinica_id, tipo_correo: p.tipo, ref: p.referencia });
        if (r.error) registrarError("cron.liberar_correo", r.error);
      },
    });
    return NextResponse.json(resultado);
  } finally {
    transporte?.close();
  }
}
