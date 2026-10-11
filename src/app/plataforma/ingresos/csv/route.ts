import { fechaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { csvIngresos, esFecha, type Ingreso } from "@/lib/plataforma";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";

/** CSV de ingresos (solo el superadministrador; la base lo exige). */
export async function GET(req: Request) {
  if (!modulos.etapa20) return new Response("No encontrado", { status: 404 });
  const supabase = await createClient();
  const { data: esSuper } = await supabase.rpc("es_superadmin");
  if (esSuper !== true) return new Response("No encontrado", { status: 404 });
  const url = new URL(req.url);
  const hoy = fechaLima(new Date());
  const desde = url.searchParams.get("desde") ?? "";
  const hasta = url.searchParams.get("hasta") ?? "";
  if (!esFecha(desde) || !esFecha(hasta) || desde > hasta || hasta > `${Number(hoy.slice(0, 4)) + 1}-12-31`) {
    return new Response("Rango de fechas inválido.", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const { data, error } = await supabase.rpc("ingresos_plataforma", { desde, hasta });
  if (error) {
    if (error.message.startsWith("El rango")) {
      return new Response(`${error.message}.`, { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    registrarError("plataforma.ingresos_csv", error);
    return new Response("No se pudo generar el reporte. Vuelve a intentarlo.", { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new Response(csvIngresos((data ?? []) as Ingreso[]), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="ingresos-${desde}-a-${hasta}.csv"`,
      "cache-control": "no-store",
    },
  });
}
