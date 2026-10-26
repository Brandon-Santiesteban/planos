import { polygonCentroid } from '../geometry/polygons';
import { floorElevation } from '../model/ops';
import type { Project } from '../model/types';

/** Real-time point lights are expensive; beyond this many the view would stutter. */
export const MAX_ROOM_LIGHTS = 16;
const BELOW_CEILING = 0.25;

export type RoomLight = { x: number; y: number; z: number; roomId: string };

/** A warm ceiling light in the middle of every (non-balcony) room of the visible floors. */
export function roomLights(p: Project, visibleFloorIds: string[]): RoomLight[] {
  const out: RoomLight[] = [];
  for (const f of p.floors) {
    if (!visibleFloorIds.includes(f.id)) continue;
    const y = floorElevation(p, f.id) + f.height - BELOW_CEILING;
    for (const r of f.rooms) {
      if (r.kind !== 'room') continue;
      const c = polygonCentroid(r.points);
      out.push({ x: c.x, y, z: c.y, roomId: r.id });
    }
  }
  return out.slice(0, MAX_ROOM_LIGHTS);
}

export type OutdoorLight = { x: number; y: number; z: number; kind: 'soffit' | 'post'; key: string };

const SOFFIT_HEIGHT = 2.4;
const POST_HEIGHT = 0.45;
const POST_INSET = 0.15;

/**
 * Warm ambient lights outside: a soffit/wall light over every balcony or fenced garden,
 * plus short garden posts at the corners of the ones on the ground.
 */
export function outdoorLights(p: Project, visibleFloorIds: string[]): OutdoorLight[] {
  const out: OutdoorLight[] = [];
  for (const f of p.floors) {
    if (!visibleFloorIds.includes(f.id)) continue;
    const base = floorElevation(p, f.id);
    for (const r of f.rooms) {
      if (r.kind !== 'balcony') continue;
      const c = polygonCentroid(r.points);
      out.push({ x: c.x, y: base + SOFFIT_HEIGHT, z: c.y, kind: 'soffit', key: `${r.id}-s` });
      if (base > 0) continue;
      r.points.forEach((q, i) => {
        const dx = c.x - q.x;
        const dy = c.y - q.y;
        const d = Math.hypot(dx, dy) || 1;
        out.push({ x: q.x + (dx / d) * POST_INSET, y: POST_HEIGHT, z: q.y + (dy / d) * POST_INSET, kind: 'post', key: `${r.id}-p${i}` });
      });
    }
  }
  return out;
}
