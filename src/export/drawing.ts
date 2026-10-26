// A floor plan as a flat list of drawing primitives, in metres and plan coordinates (x right, y down).
// Shared by the PDF and DXF exporters so both show exactly the same drawing.
import { polygonArea, polygonCentroid } from '../geometry/polygons';
import { add, lerp, normalize, perp, scale, sub } from '../geometry/vec';
import { isEndConnected, wallFootprint, wallLength } from '../geometry/walls';
import type { Floor, Furniture, Opening, Room, Vec2, Wall } from '../model/types';
import { formatArea, formatMetres } from '../model/units';

export const LAYERS = ['MUROS', 'HUECOS', 'HABITACIONES', 'MUEBLES', 'COTAS', 'TEXTOS'] as const;
export type Layer = (typeof LAYERS)[number];

export interface Poly { type: 'poly'; layer: Layer; points: Vec2[]; closed: boolean; fill?: boolean; dashed?: boolean }
export interface Line { type: 'line'; layer: Layer; a: Vec2; b: Vec2 }
/** Swept from `start` to `end` (degrees, start < end) with angles measured like atan2 in plan coordinates. */
export interface Arc { type: 'arc'; layer: Layer; center: Vec2; radius: number; start: number; end: number }
/** Centred on `at`. `angle` in degrees as atan2 in plan coordinates, always kept upright (−90, 90]. */
export interface Text { type: 'text'; layer: Layer; at: Vec2; text: string; height: number; angle: number }
export type Prim = Poly | Line | Arc | Text;

export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

export interface Drawing { prims: Prim[]; bounds: Bounds | null }

export interface DrawingOptions {
  /** Display name for a piece of furniture (the catalog's); defaults to its type id made readable. */
  furnitureName?: (f: Furniture) => string;
}

// Sizes on the drawing, in metres (at 1:50 a 0,2 m text is 4 mm on paper).
const TEXT = { room: 0.2, area: 0.14, dimension: 0.13, furniture: 0.1 };
const DIM = { gap: 0.05, offset: 0.4, overshoot: 0.08, tick: 0.14, textGap: 0.12 };
const TREAD = 0.28;

const deg = (v: Vec2) => (Math.atan2(v.y, v.x) * 180) / Math.PI;

function upright(angle: number): number {
  let a = angle;
  while (a > 90 + 1e-9) a -= 180;
  while (a <= -90 + 1e-9) a += 180;
  return a;
}

/** Wall outline split at its doors and windows; the end pieces honour connected ends. */
function wallPieces(walls: Wall[], w: Wall, openings: Opening[]): Poly[] {
  const len = wallLength(w);
  const extA = isEndConnected(walls, w.id, 'a');
  const extB = isEndConnected(walls, w.id, 'b');
  const cuts = openings
    .filter((o) => o.wallId === w.id)
    .map((o) => [Math.max(0, o.offset - o.width / 2), Math.min(len, o.offset + o.width / 2)])
    .sort((p, q) => p[0] - q[0]);
  const spans: [number, number][] = [];
  let from = 0;
  for (const [s, e] of cuts) {
    if (s > from + 1e-6) spans.push([from, s]);
    from = Math.max(from, e);
  }
  if (len > from + 1e-6) spans.push([from, len]);
  const d = normalize(sub(w.b, w.a));
  return spans.map(([s, e]) => {
    const piece: Wall = { ...w, a: add(w.a, scale(d, s)), b: add(w.a, scale(d, e)) };
    const fp = wallFootprint(piece, s === 0 && extA, e === len && extB);
    return { type: 'poly', layer: 'MUROS', points: fp, closed: true, fill: true };
  });
}

function openingSymbol(w: Wall, o: Opening): Prim[] {
  const d = normalize(sub(w.b, w.a));
  const n = scale(perp(d), o.flip ? -1 : 1);
  const half = w.thickness / 2;
  const start = add(w.a, scale(d, o.offset - o.width / 2));
  const end = add(w.a, scale(d, o.offset + o.width / 2));
  if (o.kind === 'window') {
    return [half, -half, w.thickness / 8, -w.thickness / 8].map((k) => ({
      type: 'line', layer: 'HUECOS', a: add(start, scale(n, k)), b: add(end, scale(n, k)),
    }));
  }
  // Door: leaf hinged at the start, opened 90° towards n, with its swing.
  const hinge = add(start, scale(n, half));
  const tip = add(hinge, scale(n, o.width));
  const a0 = deg(d);
  const a1 = deg(n);
  // the sweep from the closed position to the open leaf is +90° (or −90° when flipped)
  const [s, e] = o.flip ? [a1, a0] : [a0, a1];
  return [
    { type: 'line', layer: 'HUECOS', a: hinge, b: tip },
    { type: 'arc', layer: 'HUECOS', center: hinge, radius: o.width, start: s, end: e < s ? e + 360 : e },
  ];
}

/** Where a line x = c (axis 'x') or y = c (axis 'y') crosses the polygon, as inside segments. */
function clip(points: Vec2[], axis: 'x' | 'y', c: number): [Vec2, Vec2][] {
  const other = axis === 'x' ? 'y' : 'x';
  const hits: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    if (p[axis] > c !== q[axis] > c) hits.push(p[other] + ((c - p[axis]) / (q[axis] - p[axis])) * (q[other] - p[other]));
  }
  hits.sort((a, b) => a - b);
  const out: [Vec2, Vec2][] = [];
  const at = (v: number): Vec2 => (axis === 'x' ? { x: c, y: v } : { x: v, y: c });
  for (let i = 0; i + 1 < hits.length; i += 2) out.push([at(hits[i]), at(hits[i + 1])]);
  return out;
}

function stairs(r: Room): Line[] {
  const minX = Math.min(...r.points.map((p) => p.x));
  const maxX = Math.max(...r.points.map((p) => p.x));
  const minY = Math.min(...r.points.map((p) => p.y));
  const maxY = Math.max(...r.points.map((p) => p.y));
  const up = r.up ?? 'n';
  const along: 'x' | 'y' = up === 'n' || up === 's' ? 'y' : 'x';
  const [lo, hi] = along === 'y' ? [minY, maxY] : [minX, maxX];
  const count = Math.max(1, Math.round((hi - lo) / TREAD));
  const step = (hi - lo) / count;
  const lines: Line[] = [];
  for (let i = 1; i < count; i++) {
    for (const [a, b] of clip(r.points, along, lo + i * step)) lines.push({ type: 'line', layer: 'HABITACIONES', a, b });
  }
  // Arrow pointing up the flight.
  const inset = Math.min(0.2, (hi - lo) / 4);
  const mid = along === 'y' ? (minX + maxX) / 2 : (minY + maxY) / 2;
  const toward = up === 'n' || up === 'w' ? -1 : 1;
  const from = toward < 0 ? hi - inset : lo + inset;
  const to = toward < 0 ? lo + inset : hi - inset;
  const pt = (t: number, s: number): Vec2 => (along === 'y' ? { x: mid + s, y: t } : { x: t, y: mid + s });
  const head = Math.min(0.15, Math.abs(to - from) / 3);
  lines.push(
    { type: 'line', layer: 'HABITACIONES', a: pt(from, 0), b: pt(to, 0) },
    { type: 'line', layer: 'HABITACIONES', a: pt(to, 0), b: pt(to - toward * head, -head * 0.6) },
    { type: 'line', layer: 'HABITACIONES', a: pt(to, 0), b: pt(to - toward * head, head * 0.6) },
  );
  return lines;
}

function roomPrims(r: Room): Prim[] {
  const out: Prim[] = [{ type: 'poly', layer: 'HABITACIONES', points: r.points, closed: true, dashed: r.kind === 'roof' || undefined }];
  if (r.kind === 'stairs') out.push(...stairs(r));
  // A roof is only outlined: its label would sit on top of the room underneath.
  if (r.kind !== 'roof') {
    const c = polygonCentroid(r.points);
    out.push(
      { type: 'text', layer: 'TEXTOS', at: { x: c.x, y: c.y - 0.12 }, text: r.name, height: TEXT.room, angle: 0 },
      { type: 'text', layer: 'TEXTOS', at: { x: c.x, y: c.y + 0.15 }, text: formatArea(polygonArea(r.points)), height: TEXT.area, angle: 0 },
    );
  }
  return out;
}

const readable = (type: string) => {
  const s = type.replace(/[-_]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function furniturePrims(f: Furniture, name: string): Prim[] {
  const t = (f.rotation * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
    const x = (sx * f.width) / 2;
    const y = (sy * f.depth) / 2;
    return { x: f.x + x * cos - y * sin, y: f.y + x * sin + y * cos };
  });
  return [
    { type: 'poly', layer: 'MUEBLES', points: corners, closed: true },
    { type: 'text', layer: 'MUEBLES', at: { x: f.x, y: f.y }, text: name, height: TEXT.furniture, angle: 0 },
  ];
}

/** Dimension on the −perp side of the wall (like the editor): line, extension lines, oblique ticks and length. */
function dimension(w: Wall): Prim[] {
  const d = normalize(sub(w.b, w.a));
  const out = scale(perp(d), -1);
  const half = w.thickness / 2;
  const at = (p: Vec2, k: number) => add(p, scale(out, k));
  const off = half + DIM.offset;
  const a = at(w.a, off);
  const b = at(w.b, off);
  const tick = scale(normalize(add(d, out)), DIM.tick / 2);
  const angle = upright(deg(d));
  return [
    { type: 'line', layer: 'COTAS', a, b },
    { type: 'line', layer: 'COTAS', a: at(w.a, half + DIM.gap), b: at(w.a, off + DIM.overshoot) },
    { type: 'line', layer: 'COTAS', a: at(w.b, half + DIM.gap), b: at(w.b, off + DIM.overshoot) },
    { type: 'line', layer: 'COTAS', a: sub(a, tick), b: add(a, tick) },
    { type: 'line', layer: 'COTAS', a: sub(b, tick), b: add(b, tick) },
    {
      type: 'text', layer: 'COTAS', at: at(lerp(w.a, w.b, 0.5), off + DIM.textGap),
      text: formatMetres(wallLength(w)).replace(' m', ''), height: TEXT.dimension, angle,
    },
  ];
}

export function buildDrawing(floor: Floor, opts: DrawingOptions = {}): Drawing {
  const name = opts.furnitureName ?? ((f: Furniture) => readable(f.type));
  const prims: Prim[] = [];
  for (const r of floor.rooms) prims.push(...roomPrims(r));
  for (const f of floor.furniture) prims.push(...furniturePrims(f, name(f)));
  for (const w of floor.walls) prims.push(...wallPieces(floor.walls, w, floor.openings));
  for (const o of floor.openings) {
    const w = floor.walls.find((x) => x.id === o.wallId);
    if (w) prims.push(...openingSymbol(w, o));
  }
  for (const w of floor.walls) prims.push(...dimension(w));
  return { prims, bounds: drawingBounds(prims) };
}

/** Rough width of a text (for bounds and fitting). */
export const textWidth = (t: Text) => t.text.length * t.height * 0.6;

export function drawingBounds(prims: Prim[]): Bounds | null {
  let b: Bounds | null = null;
  const grow = (p: Vec2, r = 0) => {
    b ??= { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    b.minX = Math.min(b.minX, p.x - r);
    b.minY = Math.min(b.minY, p.y - r);
    b.maxX = Math.max(b.maxX, p.x + r);
    b.maxY = Math.max(b.maxY, p.y + r);
  };
  for (const p of prims) {
    if (p.type === 'poly') p.points.forEach((q) => grow(q));
    else if (p.type === 'line') { grow(p.a); grow(p.b); }
    else if (p.type === 'arc') grow(p.center, p.radius);
    else grow(p.at, Math.max(textWidth(p) / 2, p.height));
  }
  return b;
}

/** Moves every primitive by (dx, dy). */
export function translate(prims: Prim[], dx: number, dy: number): Prim[] {
  const m = (p: Vec2) => ({ x: p.x + dx, y: p.y + dy });
  return prims.map((p) => {
    if (p.type === 'poly') return { ...p, points: p.points.map(m) };
    if (p.type === 'line') return { ...p, a: m(p.a), b: m(p.b) };
    if (p.type === 'arc') return { ...p, center: m(p.center) };
    return { ...p, at: m(p.at) };
  });
}

/**
 * North arrow of total length `size` centred on `c`, in the same units as `c`.
 * `north` = degrees clockwise from the top of the plan to geographic north. The tip is the first point.
 */
export function northArrow(c: Vec2, size: number, north: number, layer: Layer = 'TEXTOS'): Prim[] {
  const t = (north * Math.PI) / 180;
  const dir = { x: Math.sin(t), y: -Math.cos(t) };
  const side = perp(dir);
  const tip = add(c, scale(dir, size / 2));
  const back = sub(c, scale(dir, size / 2));
  return [
    {
      type: 'poly', layer, closed: true, fill: true,
      points: [tip, add(back, scale(side, size * 0.22)), sub(c, scale(dir, size * 0.25)), sub(back, scale(side, size * 0.22))],
    },
    { type: 'text', layer, at: add(c, scale(dir, size / 2 + size * 0.22)), text: 'N', height: size * 0.25, angle: 0 },
  ];
}
