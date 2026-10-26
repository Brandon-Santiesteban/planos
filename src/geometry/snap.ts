import type { Vec2 } from '../model/types';
import { dist } from './vec';

export function snapToGrid(p: Vec2, step: number): Vec2 {
  return { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step };
}

/** Rotates `to` around `from` to the nearest multiple of stepDeg, keeping the length. */
export function snapAngle(from: Vec2, to: Vec2, stepDeg: number): Vec2 {
  const length = dist(from, to);
  const step = (stepDeg * Math.PI) / 180;
  const angle = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / step) * step;
  return { x: from.x + Math.cos(angle) * length, y: from.y + Math.sin(angle) * length };
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
