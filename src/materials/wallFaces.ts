import type { BufferGeometry } from 'three';
import { pointInPolygon } from '../geometry/polygons';
import { add, dist, lerp, normalize, perp, scale, sub } from '../geometry/vec';
import { DEFAULTS } from '../model/defaults';
import type { Floor, Room, Vec2, Wall } from '../model/types';

export type Side = 'left' | 'right';

/**
 * BoxGeometry material groups are +X, −X, +Y, −Y, +Z, −Z. A wall box is yawed so local +X runs from a to b;
 * local +Z then points along perp(d), the `left` face.
 */
export const BOX_FACE = { left: 4, right: 5 } as const;

/** Unit normal of a face in plan coordinates. */
export function faceNormal(w: Wall, side: Side): Vec2 {
  const n = perp(normalize(sub(w.b, w.a)));
  return side === 'left' ? n : scale(n, -1);
}

/** A solid box of wall (see wallPieces): u along the wall from `a`, z up from the floor. */
type Piece = { u0: number; u1: number; z0: number; z1: number };

/**
 * Rewrites the UVs of the two side faces of a wall piece's BoxGeometry in metres (u along the wall, v up),
 * so textures repeat by real size and line up across the pieces around openings.
 */
export function applyMetricUVs(g: BufferGeometry, piece: Piece): void {
  const uv = g.getAttribute('uv');
  const pos = g.getAttribute('position');
  const index = g.index;
  const w = piece.u1 - piece.u0;
  const h = piece.z1 - piece.z0;
  for (const side of ['left', 'right'] as const) {
    const group = g.groups[BOX_FACE[side]];
    const seen = new Set<number>();
    for (let k = group.start; k < group.start + group.count; k++) {
      const i = index ? index.getX(k) : k;
      if (seen.has(i)) continue;
      seen.add(i);
      const along = piece.u0 + pos.getX(i) + w / 2;
      uv.setXY(i, side === 'left' ? along : -along, piece.z0 + pos.getY(i) + h / 2);
    }
  }
  uv.needsUpdate = true;
}

const HAIR = 0.003;

/**
 * How far a wall box extends past one end so corners close: half its thickness when another wall meets it there,
 * a hair less so the end cap hides inside the other wall instead of fighting with its face;
 * nothing when it continues straight into another wall (both meet flush, even with different finishes).
 */
export function wallEndExtension(walls: Wall[], wall: Wall, end: 'a' | 'b'): number {
  const p = wall[end];
  const d = normalize(end === 'b' ? sub(wall.b, wall.a) : sub(wall.a, wall.b)); // pointing out of this end
  let connected = false;
  for (const o of walls) {
    if (o.id === wall.id) continue;
    let away: Vec2 | null = null; // direction of the other wall leaving the joint
    if (dist(o.a, p) <= DEFAULTS.joinTolerance) away = normalize(sub(o.b, o.a));
    else if (dist(o.b, p) <= DEFAULTS.joinTolerance) away = normalize(sub(o.a, o.b));
    if (!away) continue;
    connected = true;
    if (away.x * d.x + away.y * d.y > 1 - 1e-6) return 0; // straight continuation
  }
  return connected ? Math.max(0, wall.thickness / 2 - HAIR) : 0;
}

/** The room (not a roof covering) on one face of a wall, probing a little beyond the face at a few points along it. */
export function faceRoom(floor: Floor, wall: Wall, side: Side): Room | null {
  const n = faceNormal(wall, side);
  const off = wall.thickness / 2 + 0.05;
  const rooms = floor.rooms.filter((r) => r.kind !== 'roof');
  for (const t of [0.5, 0.25, 0.75, 0.1, 0.9]) {
    const probe = add(lerp(wall.a, wall.b, t), scale(n, off));
    const hit = rooms.find((r) => pointInPolygon(probe, r.points));
    if (hit) return hit;
  }
  return null;
}

/** Where a face looks: the room name, or "Exterior". */
export function faceLabel(floor: Floor, wall: Wall, side: Side): string {
  return faceRoom(floor, wall, side)?.name ?? 'Exterior';
}

/** A face is part of the facade when it looks at no room, or onto a balcony. */
export function isOutsideFace(floor: Floor, wall: Wall, side: Side): boolean {
  const r = faceRoom(floor, wall, side);
  return !r || r.kind === 'balcony';
}
