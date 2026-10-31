// Top-view symbols, drawn in the piece's local frame: centred, width along x, depth along y, front towards +y.
import type { ReactElement } from 'react';
import type { CatalogItem, FurnitureModel } from './catalog';
import { gatePanels } from './gate';

type P = { w: number; d: number; item?: CatalogItem; open?: boolean };
type Builder = (p: P) => ReactElement;

const rect = (x: number, y: number, w: number, h: number, r = 0, key?: string | number, cls = 'mueble-detalle') => (
  <rect key={key} className={cls} x={x} y={y} width={Math.max(w, 0)} height={Math.max(h, 0)} rx={r} />
);
const line = (x1: number, y1: number, x2: number, y2: number, key?: string | number) => (
  <line key={key} className="mueble-detalle" x1={x1} y1={y1} x2={x2} y2={y2} />
);
const circle = (cx: number, cy: number, r: number, key?: string | number) => (
  <circle key={key} className="mueble-detalle" cx={cx} cy={cy} r={r} />
);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

const bed: Builder = ({ w, d, item }) => {
  const pillows = item?.double ? 2 : 1;
  const pw = (w - 0.1 * (pillows + 1)) / pillows;
  return (
    <>
      {rect(-w / 2, -d / 2, w, 0.06)}
      {range(pillows).map((i) => rect(-w / 2 + 0.1 + i * (pw + 0.1), -d / 2 + 0.12, pw, 0.3, 0.06, i))}
      {line(-w / 2, -d / 2 + 0.6, w / 2, -d / 2 + 0.6)}
      {line(-w / 2, -d / 2 + 0.6, -w / 2 + 0.25, -d / 2 + 0.85)}
    </>
  );
};

const sofa: Builder = ({ w, d }) => {
  const arm = Math.min(0.18, w / 6);
  const back = Math.min(0.22, d / 3);
  const seats = Math.max(1, Math.round((w - 2 * arm) / 0.65));
  const sw = (w - 2 * arm) / seats;
  return (
    <>
      {rect(-w / 2, -d / 2, w, back, 0.04)}
      {rect(-w / 2, -d / 2, arm, d, 0.04)}
      {rect(w / 2 - arm, -d / 2, arm, d, 0.04)}
      {range(seats - 1).map((i) => line(-w / 2 + arm + (i + 1) * sw, -d / 2 + back, -w / 2 + arm + (i + 1) * sw, d / 2, i))}
    </>
  );
};

const sofaL: Builder = ({ w, d }) => {
  const back = 0.22;
  const chaise = Math.min(0.9, w / 2);
  return (
    <>
      {rect(-w / 2, -d / 2, w, back, 0.04)}
      {rect(-w / 2, -d / 2, 0.18, Math.min(0.95, d), 0.04)}
      {rect(w / 2 - 0.18, -d / 2, 0.18, d, 0.04)}
      {line(w / 2 - chaise, -d / 2 + back, w / 2 - chaise, d / 2)}
      {line(w / 2 - chaise, -d / 2 + Math.min(0.95, d), -w / 2, -d / 2 + Math.min(0.95, d))}
    </>
  );
};

const chair: Builder = ({ w, d }) => (
  <>
    {rect(-w / 2 + w * 0.08, -d / 2 + d * 0.15, w * 0.84, d * 0.8, Math.min(w, d) * 0.12)}
    {rect(-w / 2, -d / 2, w, d * 0.15, 0.03)}
  </>
);

const roundChair: Builder = ({ w, d }) => (
  <>
    {circle(0, 0.03 * d, Math.min(w, d) * 0.38)}
    {rect(-w * 0.4, -d / 2, w * 0.8, d * 0.14, 0.05)}
  </>
);

const box = (inset = 0.04): Builder => ({ w, d }) => rect(-w / 2 + inset, -d / 2 + inset, w - 2 * inset, d - 2 * inset, 0.02);

const doors = (n?: number): Builder => ({ w, d }) => {
  const count = n ?? Math.max(1, Math.round(w / 0.5));
  return (
    <>
      {line(-w / 2, d / 2 - 0.03, w / 2, d / 2 - 0.03)}
      {range(count - 1).map((i) => line(-w / 2 + ((i + 1) * w) / count, -d / 2, -w / 2 + ((i + 1) * w) / count, d / 2, i))}
    </>
  );
};

/** Chest of drawers seen from above: its drawer columns, and the mirror on top along the back. */
const chest: Builder = ({ w, d, item }) => {
  const cols = Math.max(1, Math.min(3, Math.round(w / 0.7)));
  return (
    <>
      {line(-w / 2, d / 2 - 0.03, w / 2, d / 2 - 0.03)}
      {range(cols - 1).map((i) => line(-w / 2 + ((i + 1) * w) / cols, -d / 2, -w / 2 + ((i + 1) * w) / cols, d / 2, i))}
      {item?.mirrorAbove && line(-Math.min(w * 0.4, 0.5), -d / 2 + 0.05, Math.min(w * 0.4, 0.5), -d / 2 + 0.05, 'espejo')}
    </>
  );
};

/** Light fittings from above: a circle with a cross, the usual plan sign for a light point. */
const lightPoint: Builder = ({ w, d }) => {
  const r = Math.min(w, d) / 2;
  return (
    <>
      {circle(0, 0, r, 'c')}
      {line(-r * 0.7, -r * 0.7, r * 0.7, r * 0.7, 'a')}
      {line(-r * 0.7, r * 0.7, r * 0.7, -r * 0.7, 'b')}
    </>
  );
};

const closet: Builder = ({ w, d }) => (
  <>
    {line(-w / 2, 0, w / 2, 0)}
    {range(Math.max(2, Math.round(w / 0.3))).map((i, _, a) => line(-w / 2 + ((i + 0.5) * w) / a.length, -0.06, -w / 2 + ((i + 0.5) * w) / a.length, 0.06, i))}
    {line(-w / 2, d / 2 - 0.03, w / 2, d / 2 - 0.03)}
  </>
);

const monitor: Builder = ({ w, d }) => (
  <>
    {rect(-w / 2, -d / 2, w, Math.min(0.04, d), 0.01, 'p', 'mueble-detalle lleno')}
    {rect(-0.1, -d / 2 + 0.02, 0.2, d * 0.75, 0.02, 's')}
  </>
);

const tower: Builder = ({ w, d }) => (
  <>{line(-w / 2, d / 2 - 0.04, w / 2, d / 2 - 0.04)}{circle(0, d / 2 - 0.1, Math.min(w, d) * 0.12)}</>
);

const flat: Builder = ({ w, d }) => line(-w / 2, d / 2, w / 2, d / 2);

const shelves: Builder = ({ w, d }) => (
  <>{line(-w / 2, -d / 2, w / 2, d / 2)}{line(-w / 2, d / 2, w / 2, -d / 2)}</>
);

const lamp: Builder = ({ w, d }) => (
  <>{circle(0, 0, Math.min(w, d) * 0.42)}{line(-w / 2, 0, w / 2, 0)}{line(0, -d / 2, 0, d / 2)}</>
);

const table: Builder = ({ w, d, item }) => {
  const seats = item?.withChairs ? item.seats ?? 0 : 0;
  const perSide = Math.max(1, Math.floor(seats / 2));
  const cw = Math.min(0.42, w / perSide - 0.08);
  return (
    <>
      {rect(-w / 2 + 0.05, -d / 2 + 0.05, w - 0.1, d - 0.1, 0.02)}
      {range(perSide).flatMap((i) => {
        const x = -w / 2 + ((i + 0.5) * w) / perSide;
        return [rect(x - cw / 2, -d / 2 - 0.12, cw, 0.08, 0.02, `n${i}`, 'mueble-detalle tenue'), rect(x - cw / 2, d / 2 + 0.04, cw, 0.08, 0.02, `s${i}`, 'mueble-detalle tenue')];
      })}
    </>
  );
};

const rug: Builder = ({ w, d }) => rect(-w / 2 + 0.08, -d / 2 + 0.08, w - 0.16, d - 0.16, 0, undefined, 'mueble-detalle punteado');

const counter: Builder = ({ w, d }) => line(-w / 2, d / 2 - 0.05, w / 2, d / 2 - 0.05);

const sink: Builder = ({ w, d, item }) => {
  const n = item?.double ? 2 : 1;
  const bw = Math.min(0.5, w / n - 0.12);
  return (
    <>
      {range(n).map((i) => {
        const cx = -w / 2 + ((i + 0.5) * w) / n;
        return <ellipse key={i} className="mueble-detalle" cx={cx} cy={0.03 * d} rx={bw / 2} ry={d * 0.3} />;
      })}
      {range(n).map((i) => circle(-w / 2 + ((i + 0.5) * w) / n, -d / 2 + 0.07, 0.025, `g${i}`))}
    </>
  );
};

const kitchenSink: Builder = ({ w, d }) => (
  <>{rect(-Math.min(0.25, w / 2 - 0.06), -d / 2 + 0.1, Math.min(0.5, w - 0.12), d - 0.2, 0.05)}{circle(0, -d / 2 + 0.06, 0.025)}</>
);

const stove: Builder = ({ w, d }) => (
  <>{[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy], i) => circle((sx * w) / 4.4, (sy * d) / 4.4, Math.min(w, d) * 0.15, i))}</>
);

const fridge: Builder = ({ w, d }) => (
  <>{line(-w / 2, d / 2 - 0.06, w / 2, d / 2 - 0.06)}{line(w / 2 - 0.08, d / 2 - 0.06, w / 2 - 0.08, d / 2)}</>
);

const toilet: Builder = ({ w, d }) => (
  <>
    {rect(-w / 2, -d / 2, w, d * 0.28, 0.04)}
    <ellipse className="mueble-detalle" cx={0} cy={-d / 2 + d * 0.28 + d * 0.34} rx={w * 0.42} ry={d * 0.34} />
  </>
);

const shower: Builder = ({ w, d }) => (
  <>{line(-w / 2, -d / 2, w / 2, d / 2)}{line(-w / 2, d / 2, w / 2, -d / 2)}{circle(0, 0, 0.04)}</>
);

const tub: Builder = ({ w, d }) => (
  <>{rect(-w / 2 + 0.08, -d / 2 + 0.08, w - 0.16, d - 0.16, Math.min(w, d) * 0.3)}{circle(-w / 2 + 0.22, 0, 0.03)}</>
);

const washtub: Builder = ({ w, d }) => (
  <>
    {rect(-w / 2 + 0.06, -d / 2 + 0.06, w * 0.5, d - 0.12, 0.03)}
    {range(4).map((i) => line(w * 0.05 + (i * (w * 0.4)) / 4, -d / 2 + 0.08, w * 0.05 + (i * (w * 0.4)) / 4, d / 2 - 0.08, i))}
  </>
);

const washer: Builder = ({ w, d }) => (
  <>{circle(0, 0.04, Math.min(w, d) * 0.32)}{line(-w / 2, -d / 2 + 0.1, w / 2, -d / 2 + 0.1)}</>
);

const plant: Builder = ({ w, d }) => {
  const r = Math.min(w, d) / 2;
  return (
    <>
      {circle(0, 0, r * 0.98)}
      {range(5).map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return circle(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, r * 0.38, i);
      })}
    </>
  );
};

const bench: Builder = ({ w, d }) => <>{range(3).map((i) => line(-w / 2, -d / 2 + ((i + 1) * d) / 4, w / 2, -d / 2 + ((i + 1) * d) / 4, i))}</>;

const car: Builder = ({ w, d }) => (
  <>
    {rect(-w * 0.22, -d / 2 + 0.12, w * 0.5, d - 0.24, 0.2)}
    {line(w * 0.28, -d / 2 + 0.15, w * 0.36, -d / 2 + 0.12)}
    {line(w * 0.28, d / 2 - 0.15, w * 0.36, d / 2 - 0.12)}
    {rect(w / 2 - 0.08, -d / 2 + 0.15, 0.04, 0.25, 0.02, 'l1')}
    {rect(w / 2 - 0.08, d / 2 - 0.4, 0.04, 0.25, 0.02, 'l2')}
  </>
);

const moto: Builder = ({ w, d }) => (
  <>
    {line(-w / 2 + 0.1, 0, w / 2 - 0.1, 0)}
    {line(w * 0.3, -d / 2 + 0.05, w * 0.3, d / 2 - 0.05)}
    {rect(-w * 0.2, -d * 0.18, w * 0.3, d * 0.36, 0.08)}
  </>
);

const pool: Builder = ({ w, d }) => (
  <>
    {rect(-w / 2 + 0.15, -d / 2 + 0.15, w - 0.3, d - 0.3, 0.05, 'agua', 'mueble-detalle agua')}
    {range(3).map((i) => line(-w / 2 + 0.15 + 0.2, -d / 2 + ((i + 1) * d) / 4, w / 2 - 0.35, -d / 2 + ((i + 1) * d) / 4 - 0.05, i))}
  </>
);

const lounger: Builder = ({ w, d }) => (
  <>{rect(-w / 2 + 0.04, -d / 2 + 0.04, w - 0.08, d * 0.32, 0.04)}{line(-w / 2, -d / 2 + d * 0.4, w / 2, -d / 2 + d * 0.4)}</>
);

const umbrella: Builder = ({ w, d }) => (
  <>
    {range(8).map((i) => {
      const a = (i / 8) * Math.PI * 2;
      return line(0, 0, (Math.cos(a) * w) / 2, (Math.sin(a) * d) / 2, i);
    })}
    {circle(0, 0, 0.05)}
  </>
);

const pergola: Builder = ({ w, d }) => {
  const n = Math.max(3, Math.round(w / 0.3));
  return (
    <>
      {range(n).map((i) => line(-w / 2 + ((i + 0.5) * w) / n, -d / 2, -w / 2 + ((i + 0.5) * w) / n, d / 2, i))}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy], i) => rect((sx * w) / 2 - 0.06 - sx * 0.06, (sy * d) / 2 - 0.06 - sy * 0.06, 0.12, 0.12, 0, `p${i}`, 'mueble-detalle lleno'))}
    </>
  );
};

const bar: Builder = ({ w, d, item }) => {
  const n = item?.seats ?? 3;
  return (
    <>
      {line(-w / 2, -d / 2 + 0.15, w / 2, -d / 2 + 0.15)}
      {range(n).map((i) => circle(-w / 2 + ((i + 0.5) * w) / n, d / 2 + 0.22, 0.17, i))}
    </>
  );
};

const grill: Builder = ({ w, d }) => (
  <>
    {rect(-w / 2 + 0.08, -d / 2 + 0.08, w * 0.55, d - 0.16, 0.03)}
    {range(4).map((i) => line(-w / 2 + 0.12, -d / 2 + 0.12 + (i * (d - 0.24)) / 3, -w / 2 + w * 0.55 + 0.04, -d / 2 + 0.12 + (i * (d - 0.24)) / 3, i))}
  </>
);

const planter: Builder = ({ w, d }) => (
  <>
    {rect(-w / 2 + 0.05, -d / 2 + 0.05, w - 0.1, d - 0.1, 0.02)}
    {range(Math.max(2, Math.round(w / 0.3))).map((i, _, a) => circle(-w / 2 + ((i + 0.5) * w) / a.length, 0, Math.min(d * 0.3, 0.14), i))}
  </>
);

const entertainment: Builder = ({ w, d }) => {
  const tw = Math.min(0.45, w / 5);
  return (
    <>
      {rect(-w / 2, -d / 2, tw, d, 0, 'l')}
      {rect(w / 2 - tw, -d / 2, tw, d, 0, 'r')}
      {line(-w / 2 + tw, d / 2 - 0.04, w / 2 - tw, d / 2 - 0.04)}
    </>
  );
};

/** Gathered fabric: a zigzag along the panel. */
const curtain: Builder = ({ w, d }) => {
  const n = Math.max(3, Math.round(w / 0.12));
  const pts = range(n + 1).map((i) => `${-w / 2 + (i * w) / n},${i % 2 ? d / 2 : -d / 2}`).join(' ');
  return <polyline className="mueble-detalle" points={pts} />;
};

const jacuzzi: Builder = ({ w, d }) => (
  <>
    {rect(-w / 2 + 0.1, -d / 2 + 0.1, w - 0.2, d - 0.2, Math.min(w, d) * 0.3)}
    {[-1, 1].map((s) => circle((s * w) / 4, -d / 2 + 0.16, 0.025, s))}
    {circle(w / 2 - 0.22, 0, 0.03, 'g')}
  </>
);

const firePit: Builder = ({ w, d }) => <>{circle(0, 0, Math.min(w, d) * 0.32)}{circle(0, 0, Math.min(w, d) * 0.15, 'c')}</>;

const pouf: Builder = ({ w, d }) => circle(0, 0, Math.min(w, d) * 0.3);

const shelfDots: Builder = ({ w, d }) => (
  <>{line(-w / 2, d / 2 - 0.02, w / 2, d / 2 - 0.02)}{range(Math.max(2, Math.round(w / 0.25))).map((i, _, a) => circle(-w / 2 + ((i + 0.5) * w) / a.length, 0, Math.min(d * 0.25, 0.04), i))}</>
);

const BUILDERS: Record<FurnitureModel, Builder> = {
  piscina: pool, asoleadora: lounger, sombrilla: umbrella, pergola, bar, parrilla: grill, jardinera: planter,
  cama: bed, mesaNoche: doors(1), closet, comoda: chest, escritorio: counter, escritorioL: () => <></>,
  sillaOficina: roundChair, sillaGamer: roundChair, monitor, torre: tower, tablero: flat, estanteria: shelves,
  lampara: lamp, sofa, sofaL, sillon: sofa, mesaCentro: box(0.05), muebleTV: doors(), televisor: flat, alfombra: rug,
  mesa: table, silla: chair, meson: counter, estufa: stove, nevera: fridge, lavaplatos: kitchenSink, alacena: doors(),
  sanitario: toilet, lavamanos: sink, ducha: shower, banera: tub, espejo: flat, lavadero: washtub, lavadora: washer,
  matera: plant, arbol: plant, poste: plant, banca: bench, carro: car, moto,
  centroEntretenimiento: entertainment,
  centroEscritorio: ({ w, d }) => {
    const tw = Math.min(0.4, w / 6);
    const td = Math.min(0.45, d);
    return <>{rect(-w / 2, -d / 2, tw, td, 0, 'l')}{rect(w / 2 - tw, -d / 2, tw, td, 0, 'r')}{line(-w / 2 + tw, -d / 2 + 0.05, w / 2 - tw, -d / 2 + 0.05)}</>;
  }, cortina: curtain, tiraLed: flat, cuadro: flat, repisa: shelfDots, consola: box(0.03),
  jacuzzi, toallero: flat, brasero: firePit, puf: pouf, jardinVertical: shelfDots, vestier: shelfDots,
  luzEmpotrada: lightPoint, colgante: lightPoint, aplique: lightPoint, aire: flat,
  impresora: ({ w, d }) => <>{rect(-w / 2 + 0.03, -d / 2 + 0.03, w - 0.06, d - 0.12)}{line(-w * 0.3, d / 2 - 0.04, w * 0.3, d / 2 - 0.04)}</>,
  canasta: ({ w, d }) => <>{circle(0, 0, Math.min(w, d) / 2)}{circle(0, 0, Math.min(w, d) * 0.35, 'c')}</>,
  porton: ({ w, d, open }) => (
    <>
      {gatePanels(w, open === true).map((pn, i) => rect(pn.x0, (pn.track === 0 ? -d / 2 : 0), pn.x1 - pn.x0, d / 2, 0, i))}
    </>
  ),
};

/** Outline (rounded for organic pieces) plus the piece's symbol, in local coordinates. */
export function FurnitureSymbol({ item, w, d, open }: { item?: CatalogItem; w: number; d: number; open?: boolean }) {
  const model = item?.model;
  const round = model === 'matera' || model === 'lampara' || model === 'sombrilla' || model === 'brasero' || model === 'puf' ? Math.min(w, d) / 2 : model === 'carro' ? 0.35 : model === 'moto' ? 0.2 : 0.02;
  const outline = model === 'escritorioL' ? null : (
    <rect className="mueble-contorno" x={-w / 2} y={-d / 2} width={w} height={d} rx={Math.min(round, w / 2, d / 2)} />
  );
  return (
    <>
      {model === 'escritorioL'
        ? <polygon className="mueble-contorno" points={`${-w / 2},${-d / 2} ${w / 2},${-d / 2} ${w / 2},${-d / 2 + Math.min(0.7, d)} ${-w / 2 + Math.min(0.6, w)},${-d / 2 + Math.min(0.7, d)} ${-w / 2 + Math.min(0.6, w)},${d / 2} ${-w / 2},${d / 2}`} />
        : outline}
      {model ? BUILDERS[model]({ w, d, item, open }) : null}
    </>
  );
}
