// The person walking through the house: where they start and how one frame of input moves them.
import { polygonCentroid } from '../geometry/polygons';
import { add, len, scale } from '../geometry/vec';
import { floorElevation } from '../model/ops';
import type { Project, Vec2 } from '../model/types';
import type { Selection } from '../store/editorStore';
import { levelAt, moveWithCollisions, segmentsAt, type Segment } from './physics';

export const WALK_SPEED = 1.4;
export const RUN_SPEED = 3;
export const BODY_RADIUS = 0.25;
const LOOK_SPEED = 0.0025; // radians per pixel of mouse movement
const MAX_PITCH = 1.45;

/** yaw 0 looks towards the top of the plan (−y); positive yaw turns left. */
export type Walker = { pos: Vec2; feet: number; yaw: number; pitch: number };
/** forward/right in −1…1 */
export type WalkInput = { forward: number; right: number; run: boolean };

export function walkStart(project: Project, activeFloorId: string, selection: Selection): Walker {
  const floor = project.floors.find((f) => f.id === activeFloorId) ?? project.floors[0];
  const chosen = selection?.kind === 'room' ? floor.rooms.find((r) => r.id === selection.id) : undefined;
  const room = chosen ?? floor.rooms.find((r) => r.kind === 'room') ?? floor.rooms[0];
  const pos = room ? polygonCentroid(room.points) : { x: 0, y: 0 };
  const feet = levelAt(project, pos, floorElevation(project, floor.id)).feet;
  return { pos, feet, yaw: 0, pitch: 0 };
}

export function stepWalker(w: Walker, input: WalkInput, dt: number, project: Project, perFloor: Segment[][]): Walker {
  const forward = { x: -Math.sin(w.yaw), y: -Math.cos(w.yaw) };
  const right = { x: Math.cos(w.yaw), y: -Math.sin(w.yaw) };
  const wish = add(scale(forward, input.forward), scale(right, input.right));
  const l = len(wish);
  if (l < 1e-9) return w;
  const delta = scale(wish, ((input.run ? RUN_SPEED : WALK_SPEED) * dt) / Math.max(1, l));
  const pos = moveWithCollisions(w.pos, delta, segmentsAt(project, perFloor, w.feet), BODY_RADIUS);
  return { ...w, pos, feet: levelAt(project, pos, w.feet).feet };
}

/** Mouse movement in pixels: right turns right, up looks up. */
export function look(w: Walker, dx: number, dy: number): Walker {
  const pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, w.pitch - dy * LOOK_SPEED));
  return { ...w, yaw: w.yaw - dx * LOOK_SPEED, pitch };
}
