// Dibujo del odontograma (SVG) según la NTS 188: gráfico base en negro y hallazgos
// solo en azul (buen estado) o rojo (mal estado, temporal o patológico) — 5.12, 5.13.
// Cada hallazgo se dibuja como indica la sección 6.1 (docs/nts188-resumen.md, tabla 2).
import type { ReactNode } from "react";
import {
  ALTO_TOTAL, ANCHO, ANCHO_TOTAL, aTexto, CORONA, centroX, centrosDeRaiz, corona, esSuperior, FILAS, fila, interior,
  NUMERO, poligonosRaiz, RECUADRO, zonaDeSuperficie, zonas, type Superficie, type Zona,
} from "@/lib/odontograma/geometria";

export type HallazgoDibujo = {
  id: string;
  codigo: string;
  pieza: number | null;
  pieza_hasta: number | null;
  arcada: "superior" | "inferior" | null;
  superficies: Superficie[] | null;
  siglas: string[];
  grado: number | null;
  color: "azul" | "rojo";
};

const COLOR = { azul: "#1d4ed8", rojo: "#dc2626" } as const;
const NEGRO = "#111827";

/** Siglas que se escriben en el recuadro de la pieza. */
function siglasDe(h: HallazgoDibujo): string[] {
  if (h.codigo === "movilidad_patologica" && h.grado) return [`M${h.grado}`];
  return h.siglas;
}

/** Zonas pintadas o contorneadas por superficie (caries, restauraciones, sellante, desgaste). */
function porSuperficie(h: HallazgoDibujo, p: number): ReactNode[] {
  const color = COLOR[h.color];
  const zs = zonas(p);
  const lista = [...new Set((h.superficies ?? []).map((s) => zonaDeSuperficie(p, s)))] as Zona[];
  switch (h.codigo) {
    case "caries":
    case "restauracion_definitiva":
      return lista.map((z) => <polygon key={`${h.id}${z}`} points={aTexto(zs[z])} fill={color} stroke={NEGRO} strokeWidth={0.6} />);
    case "restauracion_temporal":
      return lista.map((z) => <polygon key={`${h.id}${z}`} points={aTexto(zs[z])} fill="none" stroke={color} strokeWidth={2} />);
    case "sellante": {
      const i = interior(p);
      const y = i.y + i.alto / 2;
      return [<polyline key={h.id} fill="none" stroke={color} strokeWidth={1.6}
        points={aTexto([[i.x, y], [i.x + i.ancho * 0.25, i.y], [i.x + i.ancho * 0.5, i.y + i.alto], [i.x + i.ancho * 0.75, i.y], [i.x + i.ancho, y]])} />];
    }
    case "superficie_desgastada": {
      // Línea sobre el borde de la superficie desgastada (en la figura, el borde incisal).
      return lista.map((z) => {
        const pts = zs[z];
        return <polyline key={`${h.id}${z}`} points={aTexto(pts.slice(0, 2))} fill="none" stroke={color} strokeWidth={2.4} />;
      });
    }
    default:
      return [];   // defecto de esmalte: solo sigla
  }
}

/** Dibujo de un hallazgo de una pieza. */
function porPieza(h: HallazgoDibujo, p: number): ReactNode[] {
  const color = COLOR[h.color];
  const c = corona(p);
  const f = fila(p);
  const sup = esSuperior(p);
  const cx = centroX(p);
  const ladoOclusal = sup ? c.y + c.lado : c.y;   // el borde que mira al plano oclusal
  const k = h.id;
  switch (h.codigo) {
    case "corona":
    case "corona_temporal":
      return [<rect key={k} x={c.x - 2.5} y={c.y - 2.5} width={c.lado + 5} height={c.lado + 5} fill="none" stroke={color} strokeWidth={2} />];
    case "espigo_munon": {
      const i = interior(p);
      return [
        <rect key={`${k}c`} x={i.x} y={c.y + c.lado * 0.3} width={i.ancho} height={c.lado * 0.4} fill="none" stroke={color} strokeWidth={2} />,
        <line key={`${k}r`} x1={cx} x2={cx} y1={sup ? c.y + c.lado * 0.3 : c.y + c.lado * 0.7} y2={f.apiceY + (sup ? 4 : -4)}
          stroke={color} strokeWidth={2} />,
      ];
    }
    case "fractura":
      return [<line key={k} x1={c.x - 2} y1={sup ? c.y + c.lado + 2 : c.y - 2} x2={c.x + c.lado + 2} y2={f.apiceY}
        stroke={color} strokeWidth={2} />];
    case "geminacion":
      return [<circle key={k} cx={cx} cy={f.numeroY + NUMERO / 2} r={9} fill="none" stroke={color} strokeWidth={1.6} />];
    case "giroversion": {
      const y = sup ? ladoOclusal + 6 : ladoOclusal - 6;
      const curva = sup ? 6 : -6;
      return [<path key={k} d={`M ${c.x + 2} ${y} Q ${cx} ${y + curva} ${c.x + c.lado - 2} ${y}`} fill="none" stroke={color}
        strokeWidth={1.6} markerEnd={`url(#flecha-${h.color})`} />];
    }
    case "pieza_ausente":
      return [
        <line key={`${k}a`} x1={c.x - 3} y1={sup ? f.apiceY : c.y - 3} x2={c.x + c.lado + 3} y2={sup ? c.y + c.lado + 3 : f.apiceY}
          stroke={color} strokeWidth={2.2} />,
        <line key={`${k}b`} x1={c.x + c.lado + 3} y1={sup ? f.apiceY : c.y - 3} x2={c.x - 3} y2={sup ? c.y + c.lado + 3 : f.apiceY}
          stroke={color} strokeWidth={2.2} />,
      ];
    case "pieza_en_clavija": {
      const y = sup ? f.apiceY + 1 : f.apiceY - 1;
      const t = sup ? -6 : 6;
      return [<polygon key={k} points={aTexto([[cx - 6, y], [cx + 6, y], [cx, y + t]])} fill="none" stroke={color} strokeWidth={1.6} />];
    }
    case "pieza_en_erupcion": {
      const y0 = sup ? c.y + 4 : c.y + c.lado - 4;
      const d = sup ? 1 : -1;
      return [<polyline key={k} fill="none" stroke={color} strokeWidth={1.6} markerEnd={`url(#flecha-${h.color})`}
        points={aTexto([[cx, y0], [cx - 4, y0 + d * 5], [cx + 4, y0 + d * 10], [cx - 4, y0 + d * 15], [cx, y0 + d * 20]])} />];
    }
    case "pieza_extruida":
    case "pieza_intruida": {
      // Fuera del gráfico, del lado oclusal: la extruida apunta hacia afuera; la intruida, hacia el borde.
      const exterior = sup ? ladoOclusal + 16 : ladoOclusal - 16;
      const borde = sup ? ladoOclusal + 3 : ladoOclusal - 3;
      const [y1, y2] = h.codigo === "pieza_extruida" ? [borde, exterior] : [exterior, borde];
      return [<line key={k} x1={cx} x2={cx} y1={y1} y2={y2} stroke={color} strokeWidth={1.8} markerEnd={`url(#flecha-${h.color})`} />];
    }
    case "pulpotomia": {
      const i = interior(p);
      return [<rect key={k} x={i.x} y={i.y} width={i.ancho} height={Math.max(i.alto, 6)} fill={color} />];
    }
    case "tratamiento_conducto":
      return centrosDeRaiz(p).map((x, n) => (
        <line key={`${k}${n}`} x1={x} x2={x} y1={sup ? c.y : c.y + c.lado} y2={f.apiceY + (sup ? 3 : -3)} stroke={color} strokeWidth={2} />
      ));
    default:
      return [];   // solo sigla
  }
}

/** Dibujo de un hallazgo entre dos piezas, en un rango o en una arcada. */
function porConjunto(h: HallazgoDibujo): ReactNode[] {
  const color = COLOR[h.color];
  const k = h.id;
  if (h.arcada) {
    const filaPerm = h.arcada === "superior" ? fila(11) : fila(41);
    const xs = [centroX(18) - ANCHO / 2, centroX(28) + ANCHO / 2];
    const sup = h.arcada === "superior";
    const apice = filaPerm.apiceY + (sup ? 5 : -5);
    switch (h.codigo) {
      case "edentulo_total": {
        const y = filaPerm.coronaY + CORONA / 2;
        return [<line key={k} x1={xs[0]} x2={xs[1]} y1={y} y2={y} stroke={color} strokeWidth={2} />];
      }
      case "protesis_completa":
        return [-2.5, 2.5].map((d) => <line key={`${k}${d}`} x1={xs[0]} x2={xs[1]} y1={apice + d} y2={apice + d} stroke={color} strokeWidth={1.6} />);
      case "aparato_ortodontico_removible": {
        const pts: [number, number][] = [];
        for (let x = xs[0]!, n = 0; x <= xs[1]!; x += 8, n++) pts.push([x, apice + (n % 2 ? 4 : -4)]);
        return [<polyline key={k} points={aTexto(pts)} fill="none" stroke={color} strokeWidth={1.6} />];
      }
      default:
        return [];
    }
  }
  if (h.pieza === null || h.pieza_hasta === null) return [];
  const [a, b] = centroX(h.pieza) <= centroX(h.pieza_hasta) ? [h.pieza, h.pieza_hasta] : [h.pieza_hasta, h.pieza];
  const fa = fila(a);
  const sup = esSuperior(a);
  const apice = fa.apiceY + (sup ? 5 : -5);
  const xa = centroX(a);
  const xb = centroX(b);
  const medio = (xa + xb) / 2;
  switch (h.codigo) {
    case "aparato_ortodontico_fijo":
      return [
        <line key={`${k}l`} x1={xa} x2={xb} y1={apice} y2={apice} stroke={color} strokeWidth={1.6} />,
        ...[xa, xb].flatMap((x) => [
          <rect key={`${k}${x}r`} x={x - 5} y={apice - 5} width={10} height={10} fill="white" stroke={color} strokeWidth={1.6} />,
          <path key={`${k}${x}c`} d={`M ${x - 5} ${apice} H ${x + 5} M ${x} ${apice - 5} V ${apice + 5}`} stroke={color} strokeWidth={1.2} />,
        ]),
      ];
    case "protesis_parcial_fija":
      return [
        <line key={`${k}l`} x1={xa} x2={xb} y1={apice} y2={apice} stroke={color} strokeWidth={1.8} />,
        ...[xa, xb].map((x) => <line key={`${k}${x}`} x1={x} x2={x} y1={apice - 6} y2={apice + 6} stroke={color} strokeWidth={1.8} />),
      ];
    case "protesis_parcial_removible":
      return [-2.5, 2.5].map((d) => <line key={`${k}${d}`} x1={xa - 8} x2={xb + 8} y1={apice + d} y2={apice + d} stroke={color} strokeWidth={1.6} />);
    case "diastema": {
      const y = fa.coronaY + CORONA / 2;
      return [
        <path key={`${k}a`} d={`M ${medio - 5} ${y - 8} Q ${medio - 1} ${y} ${medio - 5} ${y + 8}`} fill="none" stroke={color} strokeWidth={1.6} />,
        <path key={`${k}b`} d={`M ${medio + 5} ${y - 8} Q ${medio + 1} ${y} ${medio + 5} ${y + 8}`} fill="none" stroke={color} strokeWidth={1.6} />,
      ];
    }
    case "fusion": {
      // 6.1.11: dos circunferencias que se cruzan, encerrando los números de las piezas.
      const y = fa.numeroY + NUMERO / 2;
      const desplazamiento = Math.max(0, (xb - xa - 24) / 2);
      const r = Math.max(15, desplazamiento + 8);
      return [xa + desplazamiento, xb - desplazamiento].map((x, n) => (
        <circle key={`${k}${n}`} cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={1.6} />
      ));
    }
    case "pieza_supernumeraria":
      return [
        <circle key={`${k}c`} cx={medio} cy={apice} r={7} fill="white" stroke={color} strokeWidth={1.6} />,
        <text key={`${k}t`} x={medio} y={apice + 3.5} textAnchor="middle" fontSize={9} fontWeight={700} fill={color}>S</text>,
      ];
    case "transposicion": {
      const y = fa.numeroY + NUMERO / 2;
      return [
        <path key={`${k}a`} d={`M ${xa} ${y - 6} Q ${medio} ${y + 10} ${xb} ${y - 6}`} fill="none" stroke={color} strokeWidth={1.4} markerEnd={`url(#flecha-${h.color})`} />,
        <path key={`${k}b`} d={`M ${xb} ${y + 6} Q ${medio} ${y - 10} ${xa} ${y + 6}`} fill="none" stroke={color} strokeWidth={1.4} markerEnd={`url(#flecha-${h.color})`} />,
      ];
    }
    default:
      return [];
  }
}

type Props = {
  hallazgos: HallazgoDibujo[];
  /** Piezas resaltadas (las que se están registrando). */
  seleccionadas?: readonly number[];
  /** Si se indica, cada pieza es un botón que la marca o desmarca (sin salir de la página). */
  alElegir?: (pieza: number) => void;
  titulo: string;
};

export function Odontograma({ hallazgos, seleccionadas = [], alElegir, titulo }: Props) {
  const siglas = new Map<number, { texto: string; color: "azul" | "rojo" }[]>();
  for (const h of hallazgos) {
    if (h.pieza === null || h.pieza_hasta !== null) continue;
    for (const s of siglasDe(h)) siglas.set(h.pieza, [...(siglas.get(h.pieza) ?? []), { texto: s, color: h.color }]);
  }
  // El implante puede reemplazar varias piezas; aquí se registra pieza por pieza.

  return (
    // Con piezas elegibles es un grupo (un «img» ocultaría sus botones a los lectores de pantalla).
    <svg viewBox={`0 0 ${ANCHO_TOTAL} ${ALTO_TOTAL}`} role={alElegir ? "group" : "img"} aria-label={titulo}
      className="h-auto w-full select-none" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <defs>
        {(["azul", "rojo"] as const).map((c) => (
          <marker key={c} id={`flecha-${c}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={COLOR[c]} />
          </marker>
        ))}
      </defs>
      <rect x={0} y={0} width={ANCHO_TOTAL} height={ALTO_TOTAL} fill="white" />
      {FILAS.flatMap((f) => [...f.piezas]).map((p) => {
        const c = corona(p);
        const fp = fila(p);
        const zs = zonas(p);
        const lista = siglas.get(p) ?? [];
        const dibujo = (
          <g key={p} data-pieza={p}>
            <title>{`Pieza ${p}`}</title>
            {/* Fondo transparente: en SVG solo lo pintado recibe el clic; así toda la columna de la pieza responde. */}
            <rect x={centroX(p) - ANCHO / 2} y={Math.min(fp.recuadroY, c.y) - 2} width={ANCHO}
              height={Math.abs(fp.recuadroY - c.y) + (esSuperior(p) ? CORONA : RECUADRO) + 4} fill="transparent" />
            {seleccionadas.includes(p) && (
              <rect x={centroX(p) - ANCHO / 2 + 1} y={Math.min(fp.recuadroY, c.y) - 2} width={ANCHO - 2}
                height={Math.abs(fp.recuadroY - c.y) + (esSuperior(p) ? CORONA : RECUADRO) + 4} fill="#ccfbf1" />
            )}
            <rect x={centroX(p) - ANCHO / 2 + 3} y={fp.recuadroY} width={ANCHO - 6} height={RECUADRO - 2} fill="white" stroke={NEGRO} strokeWidth={0.8} />
            {lista.length > 0 && (
              <text x={centroX(p)} y={fp.recuadroY + RECUADRO / 2 + 2} textAnchor="middle" fontSize={lista.length > 1 ? 6.5 : 8} fontWeight={700}>
                {lista.map((s, n) => (
                  <tspan key={n} fill={COLOR[s.color]}>{n > 0 ? " " : ""}{s.texto}</tspan>
                ))}
              </text>
            )}
            <text x={centroX(p)} y={fp.numeroY + NUMERO - 3} textAnchor="middle" fontSize={10} fill={NEGRO}>{p}</text>
            {poligonosRaiz(p).map((r, n) => (
              <polygon key={n} points={aTexto(r.puntos)} fill="white" stroke={NEGRO} strokeWidth={0.8} strokeDasharray={r.discontinua ? "2 2" : undefined} />
            ))}
            {(Object.keys(zs) as Zona[]).map((z) => (
              <polygon key={z} points={aTexto(zs[z])} fill="white" stroke={NEGRO} strokeWidth={0.8} />
            ))}
          </g>
        );
        if (!alElegir) return dibujo;
        // Botón de alternancia: marcar varias piezas sin recargar la página.
        return (
          <g key={p} role="button" tabIndex={0} aria-pressed={seleccionadas.includes(p)} aria-label={`Pieza ${p}`}
            className="cursor-pointer outline-none [&:focus-visible>g>rect:first-of-type]:stroke-teal-800 [&:focus-visible>g>rect:first-of-type]:[stroke-width:2.5] [&:focus-visible>g>rect:first-of-type]:[stroke-dasharray:4_2]"
            onClick={() => alElegir(p)}
            onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); alElegir(p); } }}>
            {dibujo}
          </g>
        );
      })}
      {/* Hallazgos encima del gráfico base */}
      <g pointerEvents="none">
        {hallazgos.flatMap((h) => {
          if (h.arcada || h.pieza_hasta !== null) return porConjunto(h);
          if (h.pieza === null) return [];
          return [...porSuperficie(h, h.pieza), ...porPieza(h, h.pieza)];
        })}
      </g>
    </svg>
  );
}
