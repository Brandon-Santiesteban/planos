import type { Vec2 } from '../model/types';
import { dist } from './vec';

// Rounds to micrometres to drop floating-point noise such as 3.4000000000000004.
const clean = (n: number) => Math.round(n * 1e6) / 1e6;

export function snapToGrid(p: Vec2, step: number): Vec2 {
  return { x: clean(Math.round(p.x / step) * step), y: clean(Math.round(p.y / step) * step) };
}

/** Rotates `to` around `from` to the nearest multiple of stepDeg, keeping the length. */
export function snapAngle(from: Vec2, to: Vec2, stepDeg: number): Vec2 {
  const length = dist(from, to);
  const step = (stepDeg * Math.PI) / 180;
  const angle = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / step) * step;
  return { x: from.x + Math.cos(angle) * length, y: from.y + Math.sin(angle) * length };
}

/**
 * Keeps a wall straight while one of its ends moves: with `lock` (Shift) its direction goes to the nearest multiple
 * of 45°; otherwise a wall within `tolDeg` of horizontal or vertical becomes exactly so (a few degrees off is always
 * a slip of the hand).
 */
export function straighten(from: Vec2, to: Vec2, lock: boolean, tolDeg = 3): Vec2 {
  if (lock) {
    const q = snapAngle(from, to, 45);
    // Horizontal and vertical stay on the exact line; diagonals keep the angle.
    if (Math.abs(q.x - from.x) < 1e-9) return { x: from.x, y: to.y };
    if (Math.abs(q.y - from.y) < 1e-9) return { x: to.x, y: from.y };
    return { x: clean(q.x), y: clean(q.y) };
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const deg = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
  if (deg < tolDeg) return { x: to.x, y: from.y };
  if (deg > 90 - tolDeg) return { x: from.x, y: to.y };
  return to;
}

/** A drag held to its main direction (Shift): only along x or only along y. */
export function alongAxis(v: Vec2): Vec2 {
  return Math.abs(v.x) >= Math.abs(v.y) ? { x: v.x, y: 0 } : { x: 0, y: v.y };
}

export function snapPoint(
  p: Vec2,
  ctx: { gridStep: number; endpoints: Vec2[]; radius: number },
): { point: Vec2; kind: 'endpoint' | 'grid' } {
  let best: Vec2 | null = null;
  let bestDist = ctx.radius;
  for (const e of ctx.endpoints) {
    const d = dist(p, e);
    if (d <= bestDist) {
      best = e;
      bestDist = d;
    }
  }
  if (best) return { point: { x: best.x, y: best.y }, kind: 'endpoint' };
  return { point: snapToGrid(p, ctx.gridStep), kind: 'grid' };
}
