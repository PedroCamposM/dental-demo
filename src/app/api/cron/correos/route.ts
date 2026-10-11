import { NextResponse, type NextRequest } from "next/server";
import { enviarCorreo, urlApp } from "@/lib/correo-servidor";
import { armarCorreo, type TipoCorreo } from "@/lib/correos";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { clienteServicio } from "@/lib/supabase/servicio";

// Tarea diaria (Vercel Cron, 9:00 de Lima): avisos de vencimiento, vencido y sin uso. Vercel
// manda «Authorization: Bearer CRON_SECRET». Cada correo se marca para no repetirse.
export const dynamic = "force-dynamic";

type Pendiente = { clinica_id: string; tipo: TipoCorreo; referencia: string; para: string; nombre: string; clinica: string;
  plan: string; fecha: string | null };

export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!modulos.etapa18 || !secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const supabase = clienteServicio();
  if (!supabase) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  const { data, error } = await supabase.rpc("correos_pendientes");
  if (error) {
    registrarError("cron.correos_pendientes", error);
    return NextResponse.json({ error: "No se pudo leer la lista" }, { status: 500 });
  }
  let enviados = 0;
  let fallidos = 0;
  for (const p of (data ?? []) as Pendiente[]) {
    const ok = await enviarCorreo(p.para, armarCorreo(p.tipo, {
      nombre: p.nombre, clinica: p.clinica, url: urlApp(), plan: p.plan, fecha: p.fecha ?? undefined,
    }), `cron.${p.tipo}`);
    if (!ok) { fallidos++; continue; }
    const { error: errorMarca } = await supabase.rpc("marcar_correo", {
      id_clinica: p.clinica_id, tipo_correo: p.tipo, ref: p.referencia, destinatario: p.para,
    });
    if (errorMarca) registrarError("cron.marcar_correo", errorMarca);
    enviados++;
  }
  return NextResponse.json({ enviados, fallidos });
}
