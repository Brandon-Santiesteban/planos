import type { Vec2 } from '../model/types';

export type View = { centre: Vec2; pxPerMetre: number };
export type Size = { w: number; h: number };

export const MIN_PX_PER_METRE = 10;
export const MAX_PX_PER_METRE = 2000;

export function screenToWorld(v: View, size: Size, s: Vec2): Vec2 {
  return {
    x: v.centre.x + (s.x - size.w / 2) / v.pxPerMetre,
    y: v.centre.y + (s.y - size.h / 2) / v.pxPerMetre,
  };
}

export function worldToScreen(v: View, size: Size, p: Vec2): Vec2 {
  return {
    x: (p.x - v.centre.x) * v.pxPerMetre + size.w / 2,
    y: (p.y - v.centre.y) * v.pxPerMetre + size.h / 2,
  };
}

/** Zooms by `factor` keeping the world point under `screenPt` fixed. */
export function zoomAt(v: View, size: Size, screenPt: Vec2, factor: number): View {
  const pxPerMetre = Math.min(MAX_PX_PER_METRE, Math.max(MIN_PX_PER_METRE, v.pxPerMetre * factor));
  const anchor = screenToWorld(v, size, screenPt);
  return {
    pxPerMetre,
    centre: {
      x: anchor.x - (screenPt.x - size.w / 2) / pxPerMetre,
      y: anchor.y - (screenPt.y - size.h / 2) / pxPerMetre,
    },
  };
}

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

const DEFAULT_VIEW: View = { centre: { x: 4, y: 3 }, pxPerMetre: 60 };

/** View that shows `b` centred, using 70% of the space (15% margin each side). */
export function fitView(b: Bounds | null, size: Size): View {
  if (!b) return DEFAULT_VIEW;
  const w = Math.max(b.maxX - b.minX, 1);
  const h = Math.max(b.maxY - b.minY, 1);
  const pxPerMetre = Math.min(MAX_PX_PER_METRE, Math.max(MIN_PX_PER_METRE, Math.min((size.w * 0.7) / w, (size.h * 0.7) / h)));
  return { centre: { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 }, pxPerMetre };
}
