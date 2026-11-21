// A floor plan as a flat list of drawing primitives, in metres and plan coordinates (x right, y down).
// Shared by the PDF and DXF exporters so both show exactly the same drawing.
import { pointInPolygon, polygonArea, polygonCentroid } from '../geometry/polygons';
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
/** Centred on `at`. `angle` in degrees as atan2 in plan coordinates, kept readable: [−90, 90). */
export interface Text { type: 'text'; layer: Layer; at: Vec2; text: string; height: number; angle: number }
export type Prim = Poly | Line | Arc | Text;

export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

export interface Drawing { prims: Prim[]; bounds: Bounds | null }

export interface DrawingOptions {
  /** Display name for a piece of furniture (the catalog's); defaults to its type id made readable. */
  furnitureName?: (f: Furniture) => string;
  /**
   * Plot scale denominator (100 for 1:100). When given, texts and dimension furniture (ticks, gaps, offsets)
   * are sized in paper millimetres (PAPER_MM) and converted to metres at this scale, so they read the same at
   * any scale. Without it, the old fixed sizes in metres are used.
   */
  scale?: number;
  /** Furniture outlines and names (default true). */
  furniture?: boolean;
  /** A dimension along every wall (default true). */
  wallDimensions?: boolean;
  /** Chained dimension strings plus an overall dimension outside each side of the building (default false). */
  exteriorDimensions?: boolean;
  /**
   * Room labels that fit (default false): a label too wide for a tall narrow room turns to run along it, and an
   * outdoor space whose label still does not fit, or that lies under an indoor room, is left unlabelled.
   */
  fitLabels?: boolean;
}

// Sizes on the drawing, in metres (at 1:50 a 0,2 m text is 4 mm on paper).
const TEXT = { room: 0.2, area: 0.14, dimension: 0.13, furniture: 0.1 };
const DIM = { gap: 0.05, offset: 0.4, overshoot: 0.08, tick: 0.14, textGap: 0.12 };

/** Sizes on paper, in mm, used when a scale is given: text cap heights and dimension furniture. */
export const PAPER_MM = {
  text: { room: 2.5, area: 1.8, dimension: 2, furniture: 1.5 },
  dim: {
    gap: 1.5, // between the building (or wall face) and the start of an extension line
    offset: 6, // wall dimensions: from the wall face to the dimension line
    overshoot: 1.5, // extension lines run past the dimension line
    tick: 2.5, // oblique tick length
    textGap: 1, // between the dimension line and its text
    first: 10, // exterior chains: from the building to the first string
    step: 8, // exterior chains: between strings
  },
};

interface Sizes { text: typeof TEXT; dim: typeof DIM & { first: number; step: number } }

/** Sizes in metres for the drawing: from paper mm when a scale is given, else the old metre sizes. */
function sizesFor(scale?: number): Sizes {
  if (!scale) return { text: TEXT, dim: { ...DIM, first: 0.6, step: 0.45 } };
  const m = (mm: number) => (mm * scale) / 1000;
  const t = PAPER_MM.text;
  const d = PAPER_MM.dim;
  return {
    text: { room: m(t.room), area: m(t.area), dimension: m(t.dimension), furniture: m(t.furniture) },
    dim: { gap: m(d.gap), offset: m(d.offset), overshoot: m(d.overshoot), tick: m(d.tick), textGap: m(d.textGap), first: m(d.first), step: m(d.step) },
  };
}
const TREAD = 0.28;

const deg = (v: Vec2) => (Math.atan2(v.y, v.x) * 180) / Math.PI;

/** Keeps text readable from the bottom or the right of the sheet: angle in [−90, 90). */
function upright(angle: number): number {
  let a = angle;
  while (a >= 90 - 1e-9) a -= 180;
  while (a < -90 - 1e-9) a += 180;
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

function roomPrims(r: Room, text: Sizes['text'] = TEXT, fit?: { others: Room[] }): Prim[] {
  const out: Prim[] = [{ type: 'poly', layer: 'HABITACIONES', points: r.points, closed: true, dashed: r.kind === 'roof' || undefined }];
  if (r.kind === 'stairs') out.push(...stairs(r));
  // A roof is only outlined: its label would sit on top of the room underneath.
  if (r.kind === 'roof') return out;
  const c = polygonCentroid(r.points);
  const area = formatArea(polygonArea(r.points));
  let angle = 0;
  if (fit) {
    const xs = r.points.map((p) => p.x);
    const ys = r.points.map((p) => p.y);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    const need = Math.max(r.name.length * text.room * 0.78, area.length * text.area * 0.78) * 1.05;
    const tall = text.room * 1.2 + text.area * 2.2;
    const fitsFlat = need <= w && tall <= h;
    const fitsUp = need <= h && tall <= w;
    if (!fitsFlat && fitsUp) angle = -90;
    const outdoor = r.kind === 'exterior';
    const covered = outdoor && fit.others.some((o) => o !== r && o.kind !== 'exterior' && o.kind !== 'roof' && pointInPolygon(c, o.points));
    if (outdoor && ((!fitsFlat && !fitsUp) || covered || !pointInPolygon(c, r.points))) return out;
  }
  // name above the centre, area below; turned, "above" is towards −x
  const off = (k: number): Vec2 => (angle === 0 ? { x: c.x, y: c.y + k } : { x: c.x + k, y: c.y });
  out.push(
    { type: 'text', layer: 'TEXTOS', at: off(-text.room * 0.6), text: r.name, height: text.room, angle },
    { type: 'text', layer: 'TEXTOS', at: off(text.area * 1.07), text: area, height: text.area, angle },
  );
  return out;
}

const readable = (type: string) => {
  const s = type.replace(/[-_]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function furniturePrims(f: Furniture, name: string, height = TEXT.furniture): Prim[] {
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
    { type: 'text', layer: 'MUEBLES', at: { x: f.x, y: f.y }, text: name, height, angle: 0 },
  ];
}

/** Dimension on the −perp side of the wall (like the editor): line, extension lines, oblique ticks and length. */
function dimension(w: Wall, sz: Sizes = sizesFor()): Prim[] {
  const DIM = sz.dim;
  const TEXT = sz.text;
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
  const sz = sizesFor(opts.scale);
  const prims: Prim[] = [];
  for (const r of floor.rooms) prims.push(...roomPrims(r, sz.text, opts.fitLabels ? { others: floor.rooms } : undefined));
  if (opts.furniture !== false) for (const f of floor.furniture) prims.push(...furniturePrims(f, name(f), sz.text.furniture));
  for (const w of floor.walls) prims.push(...wallPieces(floor.walls, w, floor.openings));
  for (const o of floor.openings) {
    const w = floor.walls.find((x) => x.id === o.wallId);
    if (w) prims.push(...openingSymbol(w, o));
  }
  if (opts.wallDimensions !== false) for (const w of floor.walls) prims.push(...dimension(w, sz));
  if (opts.exteriorDimensions) prims.push(...exteriorDimensions(floor, { scale: opts.scale }));
  if (opts.fitLabels) {
    const kept = dropClashingOutdoorLabels(floor, prims);
    return { prims: kept, bounds: drawingBounds(kept) };
  }
  return { prims, bounds: drawingBounds(prims) };
}

/** Box of a text, as [minX, minY, maxX, maxY]. */
function textBox(t: Text): [number, number, number, number] {
  // Helvetica runs ≈ 0.78 cap heights per character; plus a little clearance
  const w = (t.text.length * t.height * 0.78) / 2 + t.height * 0.3;
  const h = t.height * 0.8;
  return Math.abs(t.angle) > 45 ? [t.at.x - h, t.at.y - w, t.at.x + h, t.at.y + w] : [t.at.x - w, t.at.y - h, t.at.x + w, t.at.y + h];
}
const overlaps = (a: number[], b: number[]) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/** Outdoor spaces whose label would sit on a dimension lose the label (the area schedule still lists them). */
function dropClashingOutdoorLabels(floor: Floor, prims: Prim[]): Prim[] {
  const dims = prims.flatMap((p) => {
    if (p.layer !== 'COTAS') return [];
    if (p.type === 'text') return [textBox(p)];
    if (p.type === 'line') return [[Math.min(p.a.x, p.b.x), Math.min(p.a.y, p.b.y), Math.max(p.a.x, p.b.x), Math.max(p.a.y, p.b.y)]];
    return [];
  });
  if (dims.length === 0) return prims;
  const outdoor = new Set(floor.rooms.filter((r) => r.kind === 'exterior').map((r) => r.name));
  const labels = prims.filter((p): p is Text => p.type === 'text' && p.layer === 'TEXTOS');
  const drop = new Set<Prim>();
  for (let i = 0; i + 1 < labels.length; i++) {
    const [name, area] = [labels[i], labels[i + 1]];
    if (!outdoor.has(name.text) || !area.text.endsWith('m²')) continue;
    if ([name, area].some((t) => dims.some((d) => overlaps(textBox(t), d)))) { drop.add(name); drop.add(area); }
    i++;
  }
  return prims.filter((p) => !drop.has(p));
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

// ---- exterior dimensioning -------------------------------------------------------------------

type Side = 'n' | 's' | 'w' | 'e';
interface Extent { lo: number; hi: number; clo: number; chi: number }

const MIN_WALL = 0.6; // shorter walls are posts, left out of the building outline
const MERGE = 0.04; // points closer than 4 cm are one point (dimensions read to the centimetre, kept clean)

function uniqueSorted(values: number[]): number[] {
  const out: number[] = [];
  for (const v of [...values].sort((a, b) => a - b)) if (!out.length || v - out[out.length - 1] > MERGE) out.push(v);
  return out;
}

const sameChain = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= MERGE);

/**
 * Chained dimension strings outside each side of the building (the walls' outer outline), nearest first:
 * 1. openings and corners of the facade walls seen from that side,
 * 2. corners plus the axes of the walls that meet the facade,
 * 3. the overall length.
 * A string that would repeat the next one is left out. All on layer COTAS, sized like `DrawingOptions.scale`.
 */
export function exteriorDimensions(floor: Floor, opts: { scale?: number } = {}): Prim[] {
  // Posts and stubs (gate pillars, columns) would set the outline on their own: only real walls count.
  const all = floor.walls;
  const walls = all.filter((w) => wallLength(w) >= MIN_WALL);
  if (walls.length === 0) return [];
  const sz = sizesFor(opts.scale);
  const fps = walls.map((w) => wallFootprint(w, isEndConnected(all, w.id, 'a'), isEndConnected(all, w.id, 'b')));
  const box = drawingBounds(fps.map((points) => ({ type: 'poly', layer: 'MUROS', points, closed: true }) as Poly))!;
  const out: Prim[] = [];
  for (const side of ['n', 's', 'w', 'e'] as Side[]) out.push(...sideDimensions(walls, floor.openings, fps, box, side, sz));
  return out;
}

function sideDimensions(walls: Wall[], openings: Opening[], fps: Vec2[][], box: Bounds, side: Side, sz: Sizes): Prim[] {
  const horizontal = side === 'n' || side === 's';
  const outward = side === 'n' || side === 'w' ? -1 : 1;
  const al = (p: Vec2) => (horizontal ? p.x : p.y);
  const ac = (p: Vec2) => (horizontal ? p.y : p.x);
  const pt = (along: number, across: number): Vec2 => (horizontal ? { x: along, y: across } : { x: across, y: along });
  const face = horizontal ? (outward < 0 ? box.minY : box.maxY) : (outward < 0 ? box.minX : box.maxX);
  const [boxLo, boxHi] = horizontal ? [box.minX, box.maxX] : [box.minY, box.maxY];
  if (boxHi - boxLo < MERGE) return [];

  const ext: Extent[] = fps.map((fp) => {
    const a = fp.map(al);
    const c = fp.map(ac);
    return { lo: Math.min(...a), hi: Math.max(...a), clo: Math.min(...c), chi: Math.max(...c) };
  });
  const parallel = (w: Wall) => Math.abs(ac(w.a) - ac(w.b)) < 1e-3 && Math.abs(al(w.a) - al(w.b)) > 1e-3;
  const perpendicular = (w: Wall) => Math.abs(al(w.a) - al(w.b)) < 1e-3 && Math.abs(ac(w.a) - ac(w.b)) > 1e-3;
  const eps = 0.02;
  // Facade: walk along the side and see which wall is met first coming from outside. A run of the same wall
  // longer than MIN_RUN is a visible piece of facade; walls deeper than MAX_DEPTH behind the face (seen through a
  // passage between two buildings) are not part of it.
  const STEP = 0.05;
  const MIN_RUN = 0.3;
  const MAX_DEPTH = 3;
  const runs: { i: number; lo: number; hi: number }[] = [];
  for (let x = boxLo + STEP / 2; x < boxHi; x += STEP) {
    let best = -1;
    let bestFace = 0;
    ext.forEach((o, j) => {
      if (!(o.lo < x && o.hi > x)) return;
      const f = outward < 0 ? o.clo : -o.chi;
      if (best < 0 || f < bestFace - 1e-6) { best = j; bestFace = f; }
    });
    if (best >= 0 && Math.abs((outward < 0 ? bestFace : -bestFace) - face) > MAX_DEPTH) best = -1;
    const last = runs[runs.length - 1];
    if (last && last.i === best && x - last.hi < STEP * 1.5) last.hi = x;
    else runs.push({ i: best, lo: x, hi: x });
  }
  const seen = runs.filter((r) => r.i >= 0 && r.hi - r.lo + STEP >= MIN_RUN);
  const facade = [...new Set(seen.map((r) => r.i))].map((i) => ({ w: walls[i], e: ext[i], i }));
  const snap = (v: number, e: Extent) => (Math.abs(v - e.lo) < STEP ? e.lo : Math.abs(v - e.hi) < STEP ? e.hi : v);
  const corners = [boxLo, boxHi, ...seen.flatMap((r) => [snap(r.lo - STEP / 2, ext[r.i]), snap(r.hi + STEP / 2, ext[r.i])])];
  const visible = (i: number, v: number) => seen.some((r) => r.i === i && v >= r.lo - STEP && v <= r.hi + STEP);
  const openingEdges = facade.flatMap(({ w, i }) => {
    if (!parallel(w)) return [];
    const d = normalize(sub(w.b, w.a));
    return openings
      .filter((o) => o.wallId === w.id)
      .map((o) => [o.offset - o.width / 2, o.offset + o.width / 2].map((k) => al(add(w.a, scale(d, k)))))
      .filter(([p, q]) => visible(i, p) && visible(i, q))
      .flat();
  });
  const axes: number[] = [];
  walls.forEach((w, j) => {
    if (!perpendicular(w)) return;
    const e = ext[j];
    const meets = facade.some(({ w: fw, e: f }) => parallel(fw) && e.lo < f.hi - eps && e.hi > f.lo + eps && e.clo <= f.chi + eps && e.chi >= f.clo - eps);
    const axis = al(w.a);
    if (meets && corners.every((c) => Math.abs(c - axis) > w.thickness + MERGE)) axes.push(axis);
  });

  const overall = uniqueSorted([boxLo, boxHi]);
  const chains: number[][] = [];
  for (const c of [uniqueSorted([...corners, ...openingEdges]), uniqueSorted([...corners, ...axes]), overall]) {
    if (c.length < 2) continue;
    const last = chains[chains.length - 1];
    if (last && sameChain(last, c)) continue;
    chains.push(c);
  }
  // the overall string is always last: drop an earlier string that is the same
  const strings = chains.filter((c, i) => i === chains.length - 1 || !sameChain(c, overall));

  const { dim, text } = sz;
  const h = text.dimension;
  const angle = horizontal ? 0 : -90;
  const tick = { x: (dim.tick / 2) * Math.SQRT1_2, y: -(dim.tick / 2) * Math.SQRT1_2 };
  const lineAt = (k: number) => face + outward * (dim.first + k * dim.step);
  const prims: Prim[] = [];
  // extension lines: one per point, out to the furthest string that uses it
  const reach = new Map<number, number>();
  strings.forEach((c, k) => c.forEach((v) => {
    const key = [...reach.keys()].find((r) => Math.abs(r - v) <= MERGE) ?? v;
    reach.set(key, Math.max(reach.get(key) ?? 0, k));
  }));
  for (const [v, k] of reach) {
    prims.push({ type: 'line', layer: 'COTAS', a: pt(v, face + outward * dim.gap), b: pt(v, lineAt(k) + outward * dim.overshoot) });
  }
  strings.forEach((c, k) => {
    const y = lineAt(k);
    prims.push({ type: 'line', layer: 'COTAS', a: pt(c[0], y), b: pt(c[c.length - 1], y) });
    for (const v of c) {
      const p = pt(v, y);
      prims.push({ type: 'line', layer: 'COTAS', a: sub(p, tick), b: add(p, tick) });
    }
    // Text on the top / left of the line. A segment too short for its text puts it on the other side, and the
    // next short one back on top, so neighbours do not overlap.
    let prevShortBelow = false;
    for (let i = 0; i + 1 < c.length; i++) {
      const len = c[i + 1] - c[i];
      const label = formatMetres(len).replace(' m', '');
      const fits = label.length * h * 0.78 + 2 * dim.textGap <= len;
      const below: boolean = !fits && !prevShortBelow;
      prevShortBelow = below;
      const sideSign = below ? 1 : -1;
      prims.push({
        type: 'text', layer: 'COTAS', at: pt((c[i] + c[i + 1]) / 2, y + sideSign * (dim.textGap + h / 2)),
        text: label, height: h, angle,
      });
    }
  });
  return prims;
}

// ---- area schedule ---------------------------------------------------------------------------

export interface AreaRow { name: string; area: number }
export interface AreaGroup { title: string; rows: AreaRow[]; subtotal: number }
/** Rooms of a floor and their areas (m²), grouped. `total` = interior spaces + terraces and balconies. */
export interface AreaSchedule { groups: AreaGroup[]; total: number }

export function areaSchedule(floor: Floor): AreaSchedule {
  const group = (title: string, kinds: Room['kind'][]): AreaGroup => {
    const rows = floor.rooms.filter((r) => kinds.includes(r.kind)).map((r) => ({ name: r.name, area: polygonArea(r.points) }));
    return { title, rows, subtotal: rows.reduce((s, r) => s + r.area, 0) };
  };
  const interior = group('Espacios interiores', ['room', 'stairs']);
  const terraces = group('Terrazas y balcones', ['balcony']);
  const outside = group('Zonas exteriores', ['exterior']);
  return { groups: [interior, terraces, outside].filter((g) => g.rows.length > 0), total: interior.subtotal + terraces.subtotal };
}
