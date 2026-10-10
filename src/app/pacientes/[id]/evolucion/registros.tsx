import "server-only";
import { FASES_IMPLANTE, FRANKL, type FaseImplante, type TipoRegistro } from "@/lib/clinico/especialidades";
import { formatearFecha } from "@/lib/fechas";
import { registrarError } from "@/lib/registro";
import type { createClient } from "@/lib/supabase/server";
import { AnularRegistro } from "./especialidades";

type Base = { id: string; nota_id: string; registrado_at: string; anulado_at: string | null; motivo_anulacion: string | null };
export type Endodoncia = Base & {
  item_plan_id: string; conducto: string; longitud_trabajo_mm: number | null; referencia: string | null; lima_maestra: string | null;
  irrigacion: string | null; tecnica_obturacion: string | null; observaciones: string | null;
};
export type OrtoCaso = Base & { item_plan_id: string; diagnostico: string; aparatologia: string };
export type OrtoControl = Base & {
  item_plan_id: string; arco_superior: string | null; arco_inferior: string | null; ligaduras: string | null;
  activaciones: string | null; observaciones: string | null;
};
export type Implante = Base & {
  item_plan_id: string; pieza: number; marca: string; diametro_mm: number; longitud_mm: number; lote: string | null;
  torque_ncm: number | null; observaciones: string | null;
};
export type ImplanteFase = Base & { implante_id: string; fase: FaseImplante; fecha: string; observaciones: string | null };
export type Cirugia = Base & {
  item_plan_id: string; tecnica: string; sutura: string | null; retiro_puntos_dias: number | null; observaciones: string | null;
};
export type Odontopediatria = Base & {
  item_plan_id: string | null; apoderado_presente: boolean; acompanante: string | null; conducta_frankl: number | null; conducta: string | null;
};
export type Registros = {
  endodoncia: Endodoncia[]; ortodoncia_caso: OrtoCaso[]; ortodoncia_control: OrtoControl[]; implante: Implante[];
  implante_fase: ImplanteFase[]; cirugia: Cirugia[]; odontopediatria: Odontopediatria[];
};

const BASE = "id, nota_id, registrado_at, anulado_at, motivo_anulacion";

/** Todos los registros de especialidad del paciente (RLS: solo el personal clínico). */
export async function cargarRegistros(supabase: Awaited<ReturnType<typeof createClient>>, pacienteId: string):
  Promise<{ registros: Registros; error: boolean }> {
  const orden = { ascending: true } as const;
  const [endo, caso, control, impl, fase, cir, ped] = await Promise.all([
    supabase.from("endodoncia_conducto").select(`${BASE}, item_plan_id, conducto, longitud_trabajo_mm, referencia, lima_maestra, irrigacion, tecnica_obturacion, observaciones`)
      .eq("paciente_id", pacienteId).order("registrado_at", orden).returns<Endodoncia[]>(),
    supabase.from("ortodoncia_caso").select(`${BASE}, item_plan_id, diagnostico, aparatologia`)
      .eq("paciente_id", pacienteId).order("registrado_at", orden).returns<OrtoCaso[]>(),
    supabase.from("ortodoncia_control").select(`${BASE}, item_plan_id, arco_superior, arco_inferior, ligaduras, activaciones, observaciones`)
      .eq("paciente_id", pacienteId).order("registrado_at", orden).returns<OrtoControl[]>(),
    supabase.from("implante").select(`${BASE}, item_plan_id, pieza, marca, diametro_mm, longitud_mm, lote, torque_ncm, observaciones`)
      .eq("paciente_id", pacienteId).order("registrado_at", orden).returns<Implante[]>(),
    supabase.from("implante_fase").select(`${BASE}, implante_id, fase, fecha, observaciones`)
      .eq("paciente_id", pacienteId).order("fecha", orden).order("registrado_at", orden).returns<ImplanteFase[]>(),
    supabase.from("cirugia_registro").select(`${BASE}, item_plan_id, tecnica, sutura, retiro_puntos_dias, observaciones`)
      .eq("paciente_id", pacienteId).order("registrado_at", orden).returns<Cirugia[]>(),
    supabase.from("odontopediatria_registro").select(`${BASE}, item_plan_id, apoderado_presente, acompanante, conducta_frankl, conducta`)
      .eq("paciente_id", pacienteId).order("registrado_at", orden).returns<Odontopediatria[]>(),
  ]);
  const error = endo.error ?? caso.error ?? control.error ?? impl.error ?? fase.error ?? cir.error ?? ped.error;
  if (error) registrarError("especialidad.cargar", error, { paciente: pacienteId });
  return {
    registros: {
      endodoncia: endo.data ?? [], ortodoncia_caso: caso.data ?? [], ortodoncia_control: control.data ?? [],
      implante: impl.data ?? [], implante_fase: fase.data ?? [], cirugia: cir.data ?? [], odontopediatria: ped.data ?? [],
    },
    error: !!error,
  };
}

const mm = (v: number | null) => (v === null ? null : `${Number(v).toLocaleString("es-PE")} mm`);
const unir = (partes: (string | null | false | undefined)[]) => partes.filter(Boolean).join(" · ");

/** Texto de un registro (para la evolución y el historial por especialidad). */
export function describirRegistro(tipo: TipoRegistro, r: Base & Record<string, unknown>): string {
  switch (tipo) {
    case "endodoncia": {
      const e = r as Endodoncia;
      return unir([`Conducto ${e.conducto}`, e.longitud_trabajo_mm !== null && `LT ${mm(e.longitud_trabajo_mm)}`,
        e.referencia && `ref. ${e.referencia}`, e.lima_maestra && `lima maestra ${e.lima_maestra}`,
        e.irrigacion && `irrigación: ${e.irrigacion}`, e.tecnica_obturacion && `obturación: ${e.tecnica_obturacion}`, e.observaciones]);
    }
    case "ortodoncia_caso": {
      const o = r as OrtoCaso;
      return `Diagnóstico ortodóncico: ${o.diagnostico} · Aparatología: ${o.aparatologia}`;
    }
    case "ortodoncia_control": {
      const o = r as OrtoControl;
      return unir([o.arco_superior && `arco sup. ${o.arco_superior}`, o.arco_inferior && `arco inf. ${o.arco_inferior}`,
        o.ligaduras && `ligaduras ${o.ligaduras}`, o.activaciones && `activaciones: ${o.activaciones}`, o.observaciones]);
    }
    case "implante": {
      const i = r as Implante;
      return unir([`Implante en ${i.pieza}`, i.marca, `${mm(i.diametro_mm)} × ${mm(i.longitud_mm)}`, i.lote && `lote ${i.lote}`,
        i.torque_ncm !== null && `torque ${i.torque_ncm} Ncm`, i.observaciones]);
    }
    case "implante_fase": {
      const f = r as ImplanteFase;
      return unir([`${FASES_IMPLANTE[f.fase]} el ${formatearFecha(f.fecha)}`, f.observaciones]);
    }
    case "cirugia": {
      const c = r as Cirugia;
      return unir([`Técnica: ${c.tecnica}`, c.sutura && `sutura: ${c.sutura}`,
        c.retiro_puntos_dias !== null && `retiro de puntos a los ${c.retiro_puntos_dias} días`, c.observaciones]);
    }
    case "odontopediatria": {
      const o = r as Odontopediatria;
      return unir([o.apoderado_presente ? "Apoderado presente" : "Sin apoderado presente", o.acompanante && `acompañante: ${o.acompanante}`,
        o.conducta_frankl !== null && `conducta ${FRANKL[o.conducta_frankl] ?? o.conducta_frankl} (Frankl)`, o.conducta]);
    }
  }
}

const TITULO: Record<TipoRegistro, string> = {
  endodoncia: "Endodoncia", ortodoncia_caso: "Ortodoncia", ortodoncia_control: "Control de ortodoncia", implante: "Implante",
  implante_fase: "Fase de implante", cirugia: "Cirugía", odontopediatria: "Odontopediatría",
};

/** Registros de una evolución. En borrador del autor, cada uno se puede anular. */
export function RegistrosSesion({ registros, notaId, pacienteId, anulable }: {
  registros: Registros; notaId: string; pacienteId: string; anulable: boolean;
}) {
  const filas = (Object.keys(registros) as TipoRegistro[]).flatMap((tipo) =>
    (registros[tipo] as (Base & Record<string, unknown>)[]).filter((r) => r.nota_id === notaId)
      // La colocación se muestra con el implante.
      .filter((r) => !(tipo === "implante_fase" && (r as ImplanteFase).fase === "colocacion"))
      .map((r) => ({ tipo, r })));
  if (filas.length === 0) return null;
  return (
    <ul aria-label="Registros de especialidad" className="mt-3 flex flex-col gap-1.5 border-l-2 border-teal-200 pl-3 text-sm">
      {filas.map(({ tipo, r }) => (
        <li key={r.id} className={r.anulado_at ? "text-gray-400" : ""}>
          <span className="mr-1 rounded bg-teal-50 px-1.5 py-0.5 text-xs text-teal-800">{TITULO[tipo]}</span>
          <span className={r.anulado_at ? "line-through" : ""}>{describirRegistro(tipo, r)}</span>
          {r.anulado_at && <span className="ml-1 text-xs">(anulado: {r.motivo_anulacion})</span>}
          {anulable && !r.anulado_at && (
            <AnularRegistro tipo={tipo} id={r.id} pacienteId={pacienteId} descripcion={`el registro de ${TITULO[tipo].toLowerCase()}`} />
          )}
        </li>
      ))}
    </ul>
  );
}
