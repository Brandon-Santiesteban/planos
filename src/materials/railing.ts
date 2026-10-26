import type { RailingType } from '../model/types';
import { normalizeHex } from './colors';

/** A horizontal band of a railing along an open balcony edge: from z0 to z1 above the floor, `depth` thick. */
export type RailingPart = { material: 'glass' | 'metal' | 'wall' | 'coping' | 'wood'; z0: number; z1: number; depth: number };

const GAP = 0.025;

/** Horizontal slats `slat` high filling z0…z1 from the top down, the lowest one trimmed to fit. */
function slats(z0: number, z1: number, slat: number): RailingPart[] {
  const out: RailingPart[] = [];
  for (let top = z1; top - z0 > GAP + 0.02; top -= slat + GAP) {
    out.push({ material: 'wood', z0: Math.max(z0, top - slat), z1: top, depth: 0.03 });
  }
  return out;
}

export const RAIL_METAL = '#1E1E1E';
export const RAIL_WOOD = '#8A5A3B';

/**
 * Colours of a railing: `band` paints the slats (celosía) or the parapet (muro; the low wall under a fence keeps the wall colour),
 * `metal` the posts and handrail. The room's railing colour replaces the slats/parapet, or the metal of a glass railing.
 */
export function railingColors(type: RailingType | undefined, color: string | undefined, wallColor: string): { band: string; metal: string } {
  const own = color ? normalizeHex(color) : null;
  const t = type ?? 'vidrio';
  return {
    band: (t !== 'vidrio' && own) || (t === 'celosia' ? RAIL_WOOD : wallColor),
    metal: (t === 'vidrio' && own) || RAIL_METAL,
  };
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
            ...slats(0.6 + GAP, 2, 0.1),
          ],
        };
      }
      return { height: 1, posts: true, parts: slats(0, 1, 0.07) };
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
