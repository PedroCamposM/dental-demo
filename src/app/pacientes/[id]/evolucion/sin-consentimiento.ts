import "server-only";
import { itemsConConsentimiento, type ItemConOrigen } from "@/lib/clinico/consentimientos";
import { modulos } from "@/lib/funciones";
import type { createClient } from "@/lib/supabase/server";

type ItemPorFirmar = { id: string; estado: string; procedimiento_id: string | null };

/**
 * Etapa 7: ítems aceptados o programados que requieren consentimiento firmado y aún no lo
 * tienen (la firma de la evolución fallaría). Lo usan la pestaña Evolución y la ficha rápida.
 */
export async function itemsSinConsentimiento(
  supabase: Awaited<ReturnType<typeof createClient>>, pacienteId: string, items: ItemPorFirmar[], idsPlanes: string[],
): Promise<Set<string>> {
  const sinConsentimiento = new Set<string>();
  if (!modulos.etapa7) return sinConsentimiento;
  const pendientes = items.filter((i) => i.estado === "aceptado" || i.estado === "programado");
  const procs = [...new Set(pendientes.flatMap((i) => (i.procedimiento_id ? [i.procedimiento_id] : [])))];
  if (procs.length === 0 || idsPlanes.length === 0) return sinConsentimiento;
  const [requieren, firmados, origenes] = await Promise.all([
    supabase.from("procedimiento").select("id").in("id", procs).eq("requiere_consentimiento", true).returns<{ id: string }[]>(),
    supabase.from("consentimiento").select("item_plan_id").eq("paciente_id", pacienteId).eq("estado", "firmado").is("anulado_at", null)
      .returns<{ item_plan_id: string | null }[]>(),
    supabase.from("item_plan").select("id, item_origen_id, procedimiento_id, pieza, zona").in("plan_id", idsPlanes)
      .returns<ItemConOrigen[]>(),
  ]);
  const req = new Set((requieren.data ?? []).map((r) => r.id));
  // Firmado en este ítem o en el de una versión anterior del plan (lo mismo que exige la base).
  const ok = itemsConConsentimiento(origenes.data ?? [],
    new Set((firmados.data ?? []).flatMap((f) => (f.item_plan_id ? [f.item_plan_id] : []))));
  for (const i of pendientes) if (i.procedimiento_id && req.has(i.procedimiento_id) && !ok.has(i.id)) sinConsentimiento.add(i.id);
  return sinConsentimiento;
}
