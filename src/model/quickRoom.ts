// Rectangular "quick rooms": interior size in metres, walls added outside it.
import { dist, dot, normalize, sub } from '../geometry/vec';
import type { Vec2, Wall } from './types';

const clean = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Wall centrelines (clockwise from `origin`, the top-left centreline corner) and the interior floor polygon
 * for a room whose inside measures `w` × `d`.
 */
export function quickRoomOutline(origin: Vec2, w: number, d: number, t: number): { corners: Vec2[]; interior: Vec2[] } {
  const W = clean(w + t);
  const D = clean(d + t);
  const o = origin;
  const corners = [
    { x: o.x, y: o.y },
    { x: clean(o.x + W), y: o.y },
    { x: clean(o.x + W), y: clean(o.y + D) },
    { x: o.x, y: clean(o.y + D) },
  ];
  const h = t / 2;
  const interior = [
    { x: clean(o.x + h), y: clean(o.y + h) },
    { x: clean(o.x + h + w), y: clean(o.y + h) },
    { x: clean(o.x + h + w), y: clean(o.y + h + d) },
    { x: clean(o.x + h), y: clean(o.y + h + d) },
  ];
  return { corners, interior };
}

const isVertical = (w: Wall) => Math.abs(w.a.x - w.b.x) < 1e-6;
const isHorizontal = (w: Wall) => Math.abs(w.a.y - w.b.y) < 1e-6;
const overlaps = (a0: number, a1: number, b0: number, b1: number, tol: number) =>
  Math.min(a1, b1) - Math.max(a0, b0) >= -tol;

/** Best shift (smallest) that puts one of `edges` on one of `lines`, or null if none is within `radius`. */
function bestShift(edges: number[], lines: number[], radius: number): number | null {
  let best: number | null = null;
  for (const e of edges) {
    for (const l of lines) {
      const s = l - e;
      if (Math.abs(s) <= radius && (best === null || Math.abs(s) < Math.abs(best))) best = s;
    }
  }
  return best;
}

/**
 * Where to put a quick room whose proposed top-left centreline corner is `proposed`:
 * flush against nearby straight walls (so walls get shared), otherwise on the grid.
 */
export function placeQuickRoom(
  proposed: Vec2,
  w: number,
  d: number,
  t: number,
  walls: Wall[],
  opts: { radius: number; gridStep: number | null },
): Vec2 {
  const W = w + t;
  const D = d + t;
  const r = opts.radius;
  const grid = (v: number) => (opts.gridStep ? Math.round(v / opts.gridStep) * opts.gridStep : v);

  const vertical = walls.filter(isVertical);
  const horizontal = walls.filter(isHorizontal);

  let x = proposed.x;
  let y = proposed.y;
  const xLines = vertical
    .filter((v) => overlaps(y, y + D, Math.min(v.a.y, v.b.y), Math.max(v.a.y, v.b.y), r))
    .map((v) => v.a.x);
  const dx = bestShift([x, x + W], xLines, r);
  x = dx === null ? grid(x) : x + dx;

  const yLines = horizontal
    .filter((h) => overlaps(x, x + W, Math.min(h.a.x, h.b.x), Math.max(h.a.x, h.b.x), r))
    .map((h) => h.a.y);
  const dy = bestShift([y, y + D], yLines, r);
  y = dy === null ? grid(y) : y + dy;

  return { x: clean(x), y: clean(y) };
}

/** Parts of segment a→b not already covered by a collinear wall (each at least `minLength` long). */
export function uncoveredParts(a: Vec2, b: Vec2, walls: Wall[], minLength: number): [Vec2, Vec2][] {
  const L = dist(a, b);
  const u = normalize(sub(b, a));
  const along = (p: Vec2) => dot(sub(p, a), u);
  const off = (p: Vec2) => Math.abs((p.x - a.x) * u.y - (p.y - a.y) * u.x);
  const covered = walls
    .filter((w) => off(w.a) < 1e-3 && off(w.b) < 1e-3)
    .map((w) => [Math.min(along(w.a), along(w.b)), Math.max(along(w.a), along(w.b))] as [number, number])
    .sort((p, q) => p[0] - q[0]);
  const parts: [number, number][] = [];
  let cursor = 0;
  for (const [s, e] of covered) {
    if (e <= cursor) continue;
    if (s > cursor) parts.push([cursor, Math.min(s, L)]);
    cursor = Math.max(cursor, e);
    if (cursor >= L) break;
  }
  if (cursor < L) parts.push([cursor, L]);
  const at = (t: number) => ({ x: clean(a.x + u.x * t), y: clean(a.y + u.y * t) });
  return parts.filter(([s, e]) => e - s >= minLength).map(([s, e]) => [at(s), at(e)]);
}
