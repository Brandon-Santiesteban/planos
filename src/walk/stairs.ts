// Geometry of a stairs room, shared by the walk physics, the 3D steps and the 2D plan.
import { pointInPolygon } from '../geometry/polygons';
import { add, dot, scale, sub } from '../geometry/vec';
import type { Room, Vec2 } from '../model/types';

/** Tallest step a person climbs comfortably. */
export const MAX_RISER = 0.18;

/**
 * Local frame of a stairs room (its bounding box): `a` runs from the start edge in the up direction
 * (0…length), `c` across it (0…width).
 */
export type StairFrame = { origin: Vec2; u: Vec2; v: Vec2; length: number; width: number };

export function stairFrame(room: Room): StairFrame {
  const xs = room.points.map((p) => p.x);
  const ys = room.points.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const w = maxX - minX;
  const h = maxY - minY;
  switch (room.up ?? 'n') {
    case 's': return { origin: { x: minX, y: minY }, u: { x: 0, y: 1 }, v: { x: 1, y: 0 }, length: h, width: w };
    case 'e': return { origin: { x: minX, y: minY }, u: { x: 1, y: 0 }, v: { x: 0, y: 1 }, length: w, width: h };
    case 'w': return { origin: { x: maxX, y: minY }, u: { x: -1, y: 0 }, v: { x: 0, y: 1 }, length: w, width: h };
    default: return { origin: { x: minX, y: maxY }, u: { x: 0, y: -1 }, v: { x: 1, y: 0 }, length: h, width: w };
  }
}

export const toLocal = (f: StairFrame, p: Vec2) => ({ a: dot(sub(p, f.origin), f.u), c: dot(sub(p, f.origin), f.v) });
export const toPlan = (f: StairFrame, a: number, c: number): Vec2 => add(f.origin, add(scale(f.u, a), scale(f.v, c)));

const isU = (room: Room) => room.stairShape === 'u';

/** U stairs: each flight takes half the width; the landing is as deep as a flight is wide (at most half the length). */
function uLayout(f: StairFrame) {
  const half = f.width / 2;
  const landing = Math.min(half, f.length / 2);
  return { half, landing, run: f.length - landing };
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** How far up the stairs a plan point is, 0 (start) … 1 (next floor); null outside the room. */
export function stairProgress(room: Room, p: Vec2): number | null {
  if (!pointInPolygon(p, room.points)) return null;
  const f = stairFrame(room);
  const { a, c } = toLocal(f, p);
  if (!isU(room)) return f.length > 0 ? clamp01(a / f.length) : 0;
  const { half, run } = uLayout(f);
  if (a >= run || run <= 0) return 0.5;
  return c < half ? 0.5 * clamp01(a / run) : 0.5 + 0.5 * clamp01((run - a) / run);
}

/** The thin wall/railing between the two flights of a U stairs. */
export function stairDivider(room: Room): [Vec2, Vec2] | null {
  if (!isU(room)) return null;
  const f = stairFrame(room);
  const { half, run } = uLayout(f);
  return [toPlan(f, 0, half), toPlan(f, run, half)];
}

/** A step (or the landing) as a box in the local frame; `top` in metres above the floor. */
export type StepBox = { a0: number; a1: number; c0: number; c1: number; top: number };

const risers = (rise: number) => Math.max(1, Math.ceil(rise / MAX_RISER - 1e-9));

export function stairSteps(room: Room, rise: number): StepBox[] {
  const f = stairFrame(room);
  if (!isU(room)) {
    const n = risers(rise);
    const d = f.length / n;
    return Array.from({ length: n }, (_, k) => ({ a0: k * d, a1: (k + 1) * d, c0: 0, c1: f.width, top: ((k + 1) * rise) / n }));
  }
  const { half, run } = uLayout(f);
  const m = risers(rise / 2);
  const d = run / m;
  const out: StepBox[] = [];
  for (let k = 0; k < m; k++) {
    out.push({ a0: k * d, a1: (k + 1) * d, c0: 0, c1: half, top: ((k + 1) * rise) / 2 / m });
    out.push({ a0: run - (k + 1) * d, a1: run - k * d, c0: half, c1: f.width, top: rise / 2 + ((k + 1) * rise) / 2 / m });
  }
  out.push({ a0: run, a1: f.length, c0: 0, c1: f.width, top: rise / 2 });
  return out;
}

/** Plan lines between steps (and the edge of the landing). */
export function stairStepLines(room: Room, rise: number): [Vec2, Vec2][] {
  const f = stairFrame(room);
  if (!isU(room)) {
    const n = risers(rise);
    return Array.from({ length: n - 1 }, (_, k) => {
      const a = ((k + 1) * f.length) / n;
      return [toPlan(f, a, 0), toPlan(f, a, f.width)];
    });
  }
  const { run } = uLayout(f);
  const m = risers(rise / 2);
  const lines: [Vec2, Vec2][] = [];
  for (let k = 1; k < m; k++) lines.push([toPlan(f, (k * run) / m, 0), toPlan(f, (k * run) / m, f.width)]);
  lines.push([toPlan(f, run, 0), toPlan(f, run, f.width)]);
  return lines;
}

/** Walking line from the bottom to the top (draw an arrowhead at its last point). */
export function stairPath(room: Room): Vec2[] {
  const f = stairFrame(room);
  const end = Math.min(0.15, f.length / 4);
  if (!isU(room)) return [toPlan(f, end, f.width / 2), toPlan(f, f.length - end, f.width / 2)];
  const { half, landing, run } = uLayout(f);
  const turn = run + landing / 2;
  return [toPlan(f, end, half / 2), toPlan(f, turn, half / 2), toPlan(f, turn, half * 1.5), toPlan(f, end, half * 1.5)];
}
