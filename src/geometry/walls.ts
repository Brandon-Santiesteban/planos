import { DEFAULTS } from '../model/defaults';
import type { Vec2, Wall } from '../model/types';
import { add, dist, dot, normalize, perp, scale, sub } from './vec';

export function wallLength(w: Wall): number {
  return dist(w.a, w.b);
}

export function isEndConnected(walls: Wall[], wallId: string, end: 'a' | 'b'): boolean {
  const wall = walls.find((w) => w.id === wallId);
  if (!wall) return false;
  const p = wall[end];
  return walls.some(
    (w) => w.id !== wallId && (dist(w.a, p) <= DEFAULTS.joinTolerance || dist(w.b, p) <= DEFAULTS.joinTolerance),
  );
}

/** 4-point outline: a-left, b-left, b-right, a-right. Extended ends grow by thickness/2. */
export function wallFootprint(w: Wall, extendA: boolean, extendB: boolean): Vec2[] {
  const d = normalize(sub(w.b, w.a));
  const half = w.thickness / 2;
  const n = scale(perp(d), half);
  const a = extendA ? sub(w.a, scale(d, half)) : w.a;
  const b = extendB ? add(w.b, scale(d, half)) : w.b;
  return [add(a, n), add(b, n), sub(b, n), sub(a, n)];
}

/** Clamps an opening centre inside the wall; null if it cannot fit or overlaps another opening. */
export function fitOpening(
  wallLen: number,
  offset: number,
  width: number,
  others: { offset: number; width: number }[],
): number | null {
  const min = DEFAULTS.openingMargin + width / 2;
  const max = wallLen - DEFAULTS.openingMargin - width / 2;
  if (min > max + 1e-9) return null;
  const c = Math.min(Math.max(offset, min), max);
  const overlaps = others.some((o) => Math.abs(c - o.offset) < (width + o.width) / 2 - 1e-9);
  return overlaps ? null : c;
}

export function projectOntoWall(w: Wall, p: Vec2): { offset: number; distance: number } {
  const d = normalize(sub(w.b, w.a));
  const rel = sub(p, w.a);
  const offset = Math.min(Math.max(dot(rel, d), 0), wallLength(w));
  const closest = add(w.a, scale(d, offset));
  return { offset, distance: dist(p, closest) };
}
