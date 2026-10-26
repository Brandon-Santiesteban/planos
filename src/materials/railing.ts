import type { RailingType } from '../model/types';

/** A horizontal band of a railing along an open balcony edge: from z0 to z1 above the floor, `depth` thick. */
export type RailingPart = { material: 'glass' | 'metal' | 'wall' | 'coping' | 'wood'; z0: number; z1: number; depth: number };

const SLAT = 0.07;
const GAP = 0.025;

/** Horizontal slats filling z0…z1 from the top down, the lowest one trimmed to fit. */
function slats(z0: number, z1: number): RailingPart[] {
  const out: RailingPart[] = [];
  for (let top = z1; top - z0 > GAP + 0.02; top -= SLAT + GAP) {
    out.push({ material: 'wood', z0: Math.max(z0, top - SLAT), z1: top, depth: 0.03 });
  }
  return out;
}

/**
 * The bands of each railing kind. On the ground floor (a front garden, for example) a celosía is
 * a 2 m privacy fence on a 0,6 m low wall; everything else is 1 m high.
 */
export function railingParts(type: RailingType | undefined, groundFloor: boolean): { height: number; posts: boolean; parts: RailingPart[] } {
  switch (type ?? 'vidrio') {
    case 'muro':
      return {
        height: 1,
        posts: false,
        parts: [
          { material: 'wall', z0: 0, z1: 0.95, depth: 0.15 },
          { material: 'coping', z0: 0.95, z1: 1, depth: 0.2 },
        ],
      };
    case 'celosia':
      if (groundFloor) {
        return {
          height: 2,
          posts: true,
          parts: [
            { material: 'wall', z0: 0, z1: 0.6, depth: 0.15 },
            ...slats(0.6 + GAP, 2),
          ],
        };
      }
      return { height: 1, posts: true, parts: slats(0, 1) };
    default:
      return {
        height: 1,
        posts: true,
        parts: [
          { material: 'glass', z0: 0.03, z1: 0.95, depth: 0.015 },
          { material: 'metal', z0: 0.95, z1: 1, depth: 0.06 },
        ],
      };
  }
}
