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
