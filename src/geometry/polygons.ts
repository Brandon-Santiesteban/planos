import type { Vec2 } from '../model/types';

function signedArea(pts: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export function polygonArea(pts: Vec2[]): number {
  return Math.abs(signedArea(pts));
}

/** Width and height of an axis-aligned rectangle, or null for any other shape. */
export function rectangleSize(pts: Vec2[]): { w: number; h: number } | null {
  if (pts.length !== 4) return null;
  const xs = new Set(pts.map((p) => Math.round(p.x * 1e6)));
  const ys = new Set(pts.map((p) => Math.round(p.y * 1e6)));
  if (xs.size !== 2 || ys.size !== 2) return null;
  const [x0, x1] = [...xs].map((v) => v / 1e6);
  const [y0, y1] = [...ys].map((v) => v / 1e6);
  return { w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
}

export function pointInPolygon(p: Vec2, pts: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function polygonCentroid(pts: Vec2[]): Vec2 {
  const area = signedArea(pts);
  if (Math.abs(area) < 1e-12) {
    const n = pts.length || 1;
    return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const cross = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}
