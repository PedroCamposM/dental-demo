"use client";

import { useActionState, useState, type ReactNode } from "react";
import {
  INFERIOR, nic, nombresSitios, piezaVacia, SUPERIOR, tieneDatos, tieneFurca, type PiezaPeriodonto, type Seis,
} from "@/lib/clinico/periodonto";
import { anularPeriodontograma, guardarPeriodontograma, nuevoPeriodontograma, type EstadoPerio } from "./acciones";

const INICIAL: EstadoPerio = { error: null, mensaje: null, intento: 0 };
const BOTON = "rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60";
const CELDA = "w-7 rounded border border-gray-300 px-0.5 py-0.5 text-center text-xs tabular-nums focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";

function Mensajes({ estado }: { estado: EstadoPerio }) {
  return (
    <>
      {estado.error && <p role="alert" className="text-sm text-red-700">{estado.error}</p>}
      {estado.mensaje && <p role="status" className="text-sm text-teal-700">{estado.mensaje}</p>}
    </>
  );
}

export function NuevoPeriodontograma({ pacienteId, esDentista, dentistas }: {
  pacienteId: string; esDentista: boolean; dentistas: { id: string; nombre: string }[];
}) {
  const [estado, accion, enviando] = useActionState(nuevoPeriodontograma, INICIAL);
  return (
    <form action={accion} className="flex flex-wrap items-end gap-3" noValidate>
      <input type="hidden" name="paciente_id" value={pacienteId} />
      {!esDentista && (
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Cirujano dentista responsable
          <select name="odontologo_id" defaultValue="" className="rounded-md border border-gray-300 px-3 py-2 text-base font-normal">
            <option value="" disabled>Elige…</option>
            {dentistas.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
        </label>
      )}
      <button type="submit" disabled={enviando} className={BOTON}>{enviando ? "Abriendo…" : "Nuevo periodontograma"}</button>
      <Mensajes estado={estado} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Grilla: edición (borrador) o lectura (firmado)
// ---------------------------------------------------------------------------
type CampoNumero = "ps" | "mg";
type CampoMarca = "sangrado" | "placa" | "supuracion";
const MARCAS: { campo: CampoMarca; texto: string; corto: string }[] = [
  { campo: "sangrado", texto: "Sangrado", corto: "S" },
  { campo: "placa", texto: "Placa", corto: "P" },
  { campo: "supuracion", texto: "Supuración", corto: "Su" },
];

const colorPs = (v: number | null) => (v === null ? "" : v >= 6 ? "bg-red-100 text-red-800" : v >= 4 ? "bg-amber-100 text-amber-900" : "");

function Arcada({ piezas, datos, editar, cambiar }: {
  piezas: readonly number[]; datos: Map<number, PiezaPeriodonto>; editar: boolean;
  cambiar: (pieza: number, f: (p: PiezaPeriodonto) => PiezaPeriodonto) => void;
}) {
  const superior = (piezas[0] ?? 0) < 30;
  const caras: { nombre: string; sitios: [number, number, number] }[] = [
    { nombre: "Vestibular", sitios: [0, 1, 2] },
    { nombre: superior ? "Palatino" : "Lingual", sitios: [3, 4, 5] },
  ];
  const dato = (n: number) => datos.get(n) ?? piezaVacia(n);
  const numero = (n: number, campo: CampoNumero, i: number) => {
    const p = dato(n);
    const v = p[campo][i] ?? null;
    const etiqueta = `${campo === "ps" ? "PS" : "MG"} ${n} ${nombresSitios(n)[i]}`;
    if (!editar) {
      return <span aria-label={etiqueta} className={`inline-block w-7 rounded text-center text-xs tabular-nums ${campo === "ps" ? colorPs(v) : ""}`}>{v ?? "·"}</span>;
    }
    return (
      <CeldaNumero key={`${etiqueta}${p.ausente ? "-aus" : ""}`} etiqueta={etiqueta} valor={v} negativo={campo === "mg"} deshabilitada={p.ausente}
        clase={campo === "ps" ? colorPs(v) : ""}
        cambiar={(nuevo) => cambiar(n, (x) => {
          const arr = [...x[campo]] as Seis<number | null>;
          arr[i] = nuevo;
          return { ...x, [campo]: arr };
        })} />
    );
  };
  const marca = (n: number, campo: CampoMarca, i: number, texto: string) => {
    const p = dato(n);
    const v = p[campo][i] ?? false;
    const etiqueta = `${texto} ${n} ${nombresSitios(n)[i]}`;
    if (!editar) return <span aria-label={etiqueta} className={`inline-block h-2.5 w-2.5 rounded-full ${v ? (campo === "sangrado" ? "bg-red-600" : campo === "placa" ? "bg-sky-600" : "bg-amber-500") : "bg-gray-100"}`} />;
    return (
      <input type="checkbox" aria-label={etiqueta} checked={v} disabled={p.ausente} className="h-3.5 w-3.5"
        onChange={(e) => {
          const marcado = e.target.checked;   // se lee aquí: el actualizador corre después
          cambiar(n, (x) => {
            const arr = [...x[campo]] as Seis<boolean>;
            arr[i] = marcado;
            return { ...x, [campo]: arr };
          });
        }} />
    );
  };
  const grado = (n: number, campo: "movilidad" | "furca") => {
    const p = dato(n);
    if (campo === "furca" && !tieneFurca(n)) return <span className="text-xs text-gray-300">—</span>;
    const etiqueta = `${campo === "movilidad" ? "Movilidad" : "Furca"} ${n}`;
    if (!editar) return <span aria-label={etiqueta} className="text-xs tabular-nums">{p[campo] ?? "·"}</span>;
    return (
      <select aria-label={etiqueta} value={p[campo] ?? ""} disabled={p.ausente} className="rounded border border-gray-300 text-xs"
        onChange={(e) => {
          const v = e.target.value === "" ? null : Number(e.target.value);
          cambiar(n, (x) => ({ ...x, [campo]: v }));
        }}>
        <option value="">·</option>
        {[0, 1, 2, 3].map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
    );
  };
  const fila = (titulo: string, celda: (n: number) => ReactNode, clase = "") => (
    <tr className={clase}>
      <th scope="row" className="sticky left-0 z-10 bg-white px-2 py-0.5 text-left text-xs font-medium text-gray-600">{titulo}</th>
      {piezas.map((n) => <td key={n} className={`border-l border-gray-100 px-0.5 py-0.5 text-center ${dato(n).ausente ? "bg-gray-50" : ""}`}>{celda(n)}</td>)}
    </tr>
  );
  const tres = (n: number, f: (i: number) => ReactNode, sitios: [number, number, number]) => (
    <div className="flex justify-center gap-0.5">{sitios.map((i) => <span key={i}>{f(i)}</span>)}</div>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-max text-sm">
        <caption className="sr-only">Arcada {superior ? "superior" : "inferior"}</caption>
        <thead>
          <tr className="bg-gray-50">
            <th scope="col" className="sticky left-0 z-10 bg-gray-50 px-2 py-1 text-left text-xs font-medium text-gray-500">
              {superior ? "Superior" : "Inferior"}
            </th>
            {piezas.map((n) => <th key={n} scope="col" className="border-l border-gray-100 px-1 py-1 text-xs font-semibold">{n}</th>)}
          </tr>
        </thead>
        <tbody>
          {fila("Ausente", (n) => editar
            ? <input type="checkbox" aria-label={`Ausente ${n}`} checked={dato(n).ausente} className="h-3.5 w-3.5"
                onChange={(e) => {
                  const marcado = e.target.checked;
                  cambiar(n, (x) => (marcado ? { ...piezaVacia(n), ausente: true } : { ...x, ausente: false }));
                }} />
            : (dato(n).ausente ? <span className="text-xs text-gray-500">Aus.</span> : null))}
          {fila("Implante", (n) => editar
            ? <input type="checkbox" aria-label={`Implante ${n}`} checked={dato(n).implante} disabled={dato(n).ausente} className="h-3.5 w-3.5"
                onChange={(e) => {
                  const marcado = e.target.checked;
                  cambiar(n, (x) => ({ ...x, implante: marcado }));
                }} />
            : (dato(n).implante ? <span className="text-xs text-gray-600">Impl.</span> : null))}
          {fila("Movilidad", (n) => grado(n, "movilidad"))}
          {fila("Furca", (n) => grado(n, "furca"))}
          {caras.map((cara) => (
            <FilasCara key={cara.nombre} nombre={cara.nombre}>
              {fila("PS", (n) => tres(n, (i) => numero(n, "ps", i), cara.sitios))}
              {fila("MG", (n) => tres(n, (i) => numero(n, "mg", i), cara.sitios))}
              {fila("NIC", (n) => tres(n, (i) => {
                const p = dato(n);
                const v = nic(p.ps[i] ?? null, p.mg[i] ?? null);
                return <span aria-label={`NIC ${n} ${nombresSitios(n)[i]}`} className="inline-block w-7 text-center text-xs tabular-nums text-gray-600">{v ?? "·"}</span>;
              }, cara.sitios), "bg-gray-50/60")}
              {MARCAS.map((m) => (
                <Fragmento key={m.campo}>{fila(m.texto, (n) => tres(n, (i) => marca(n, m.campo, i, m.texto), cara.sitios))}</Fragmento>
              ))}
            </FilasCara>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Celda numérica: conserva lo que se escribe (p. ej. «-» antes del número) y solo
 * propaga enteros válidos; el servidor vuelve a validar. */
function CeldaNumero({ etiqueta, valor, negativo, deshabilitada, clase, cambiar }: {
  etiqueta: string; valor: number | null; negativo: boolean; deshabilitada: boolean; clase: string;
  cambiar: (v: number | null) => void;
}) {
  const [texto, setTexto] = useState(valor === null ? "" : String(valor));
  const mostrado = deshabilitada ? "" : texto;
  return (
    <input aria-label={etiqueta} inputMode={negativo ? "text" : "numeric"} disabled={deshabilitada} value={mostrado}
      className={`${CELDA} ${clase}`}
      onChange={(e) => {
        const t = e.target.value.trim();
        if (!(negativo ? /^-?\d{0,2}$/ : /^\d{0,2}$/).test(t)) return;
        setTexto(t);
        cambiar(t === "" || t === "-" ? null : Number(t));
      }} />
  );
}

function FilasCara({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (
    <>
      <tr className="border-t border-gray-200 bg-teal-50/50">
        <th scope="rowgroup" colSpan={17} className="sticky left-0 px-2 py-1 text-left text-xs font-semibold text-teal-900">{nombre}</th>
      </tr>
      {children}
    </>
  );
}

function Fragmento({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** Grilla de solo lectura (periodontograma firmado o anulado). */
export function GrillaLectura({ piezas }: { piezas: PiezaPeriodonto[] }) {
  const datos = new Map(piezas.map((p) => [p.pieza, p]));
  return (
    <div className="flex flex-col gap-4">
      <Arcada piezas={SUPERIOR} datos={datos} editar={false} cambiar={() => undefined} />
      <Arcada piezas={INFERIOR} datos={datos} editar={false} cambiar={() => undefined} />
    </div>
  );
}

/** Borrador: se registra pieza por pieza y se guarda o firma de una vez. Guardar y firmar
 * son dos formularios con los mismos datos (en campos ocultos): la acción no depende de
 * qué botón envió el formulario. */
export function GrillaEdicion({ id, pacienteId, piezas, observaciones, mantenimiento, puedeFirmar }: {
  id: string; pacienteId: string; piezas: PiezaPeriodonto[]; observaciones: string; mantenimiento: number | null;
  puedeFirmar: boolean;
}) {
  const [guardado, guardar, guardando] = useActionState(guardarPeriodontograma, INICIAL);
  const [firmado, firmar, firmando] = useActionState(guardarPeriodontograma, INICIAL);
  const [ultimo, setUltimo] = useState<"guardar" | "firmar">("guardar");
  const [datos, setDatos] = useState(() => new Map(piezas.map((p) => [p.pieza, p])));
  const [obs, setObs] = useState(observaciones);
  const [meses, setMeses] = useState(mantenimiento === null ? "" : String(mantenimiento));
  const cambiar = (pieza: number, f: (p: PiezaPeriodonto) => PiezaPeriodonto) =>
    setDatos((m) => new Map(m).set(pieza, f(m.get(pieza) ?? piezaVacia(pieza))));
  // Las piezas con datos y las ya guardadas (aunque se hayan vaciado: así se borra lo guardado).
  const guardadas = new Set(piezas.map((p) => p.pieza));
  const enviar = JSON.stringify([...datos.values()].filter((p) => tieneDatos(p) || guardadas.has(p.pieza)));
  const enviando = guardando || firmando;
  const ocultos = (accion: "guardar" | "firmar") => (
    <>
      <input type="hidden" name="accion" value={accion} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <input type="hidden" name="piezas" value={enviar} />
      <input type="hidden" name="observaciones" value={obs} />
      <input type="hidden" name="mantenimiento_meses" value={meses} />
    </>
  );
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-gray-600">
        PS y MG en milímetros enteros. MG positivo = recesión (margen apical al límite amelocementario); negativo =
        margen coronal. NIC = PS + MG. Sitios: M, centro y D de cada cara.
      </p>
      <Arcada piezas={SUPERIOR} datos={datos} editar cambiar={cambiar} />
      <Arcada piezas={INFERIOR} datos={datos} editar cambiar={cambiar} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 sm:col-span-2">
          Observaciones
          <textarea rows={2} maxLength={2000} value={obs} onChange={(e) => setObs(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-base font-normal" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Mantenimiento periodontal en (meses)
          <input inputMode="numeric" value={meses} onChange={(e) => setMeses(e.target.value)}
            placeholder="Opcional" className="rounded-md border border-gray-300 px-3 py-2 text-base font-normal" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <form action={guardar} onSubmit={() => setUltimo("guardar")} noValidate>
          {ocultos("guardar")}
          <button type="submit" disabled={enviando}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 font-medium hover:bg-gray-50 disabled:opacity-60">
            {guardando ? "Guardando…" : "Guardar borrador"}
          </button>
        </form>
        {puedeFirmar && (
          <form action={firmar} noValidate
            onSubmit={(ev) => {
              if (!window.confirm("Una vez firmado, el periodontograma no se edita. ¿Firmar?")) ev.preventDefault();
              else setUltimo("firmar");
            }}>
            {ocultos("firmar")}
            <button type="submit" disabled={enviando} className={BOTON}>{firmando ? "Firmando…" : "Guardar y firmar"}</button>
          </form>
        )}
        <Mensajes estado={ultimo === "firmar" ? firmado : guardado} />
      </div>
    </div>
  );
}

export function AnularPeriodontograma({ id, pacienteId }: { id: string; pacienteId: string }) {
  const [estado, accion, enviando] = useActionState(anularPeriodontograma, INICIAL);
  const [motivo, setMotivo] = useState("");
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-gray-600 hover:underline">Anular</summary>
      <form action={accion} className="mt-2 flex flex-wrap items-end gap-2" noValidate>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="paciente_id" value={pacienteId} />
        <input name="motivo" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)}
          aria-label="Motivo para anular el periodontograma" placeholder="Motivo"
          className="min-w-56 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <button type="submit" disabled={enviando} className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50">
          {enviando ? "Anulando…" : "Confirmar anulación"}
        </button>
        <div className="w-full"><Mensajes estado={estado} /></div>
      </form>
    </details>
  );
}
