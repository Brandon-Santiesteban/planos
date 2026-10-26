import { pointInPolygon } from '../geometry/polygons';
import { dist } from '../geometry/vec';
import { projectOntoWall } from '../geometry/walls';
import type { Floor, Vec2 } from '../model/types';

export type Hit =
  | { kind: 'endpoint'; wallId: string; end: 'a' | 'b' }
  | { kind: 'opening' | 'wall' | 'room'; id: string }
  | null;

/** What is under `p`, by priority: endpoint > opening > wall > room. */
export function hitTest(floor: Floor, p: Vec2, tolerance: number): Hit {
  for (const w of floor.walls) {
    if (dist(w.a, p) <= tolerance) return { kind: 'endpoint', wallId: w.id, end: 'a' };
    if (dist(w.b, p) <= tolerance) return { kind: 'endpoint', wallId: w.id, end: 'b' };
  }
  for (const o of floor.openings) {
    const w = floor.walls.find((x) => x.id === o.wallId);
    if (!w) continue;
    const { offset, distance } = projectOntoWall(w, p);
    if (Math.abs(offset - o.offset) <= o.width / 2 && distance <= w.thickness / 2 + tolerance) {
      return { kind: 'opening', id: o.id };
    }
  }
  for (const w of floor.walls) {
    if (projectOntoWall(w, p).distance <= w.thickness / 2 + tolerance) return { kind: 'wall', id: w.id };
  }
  for (let i = floor.rooms.length - 1; i >= 0; i--) {
    if (pointInPolygon(p, floor.rooms[i].points)) return { kind: 'room', id: floor.rooms[i].id };
  }
  return null;
}
