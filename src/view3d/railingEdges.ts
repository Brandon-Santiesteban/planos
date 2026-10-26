import type { Room, Vec2, Wall } from '../model/types';
import { edgeTouchesWall } from './wallPieces';

/** Edges of a balcony that get a railing: not against a wall and not marked open (`openEdges`). */
export function railingEdges(room: Room, walls: Wall[]): { index: number; a: Vec2; b: Vec2 }[] {
  const open = new Set(room.openEdges ?? []);
  return room.points
    .map((a, index) => ({ index, a, b: room.points[(index + 1) % room.points.length] }))
    .filter((e) => !open.has(e.index) && !edgeTouchesWall([e.a, e.b], walls));
}
