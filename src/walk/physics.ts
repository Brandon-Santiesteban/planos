// Walking a person through the house: what blocks them and how high their feet are.
import { add, dist, dot, len, normalize, perp, scale, sub } from '../geometry/vec';
import { isEndConnected, wallLength } from '../geometry/walls';
import { floorElevation } from '../model/ops';
import type { Floor, Project, Vec2 } from '../model/types';
import { wallPieces } from '../view3d/wallPieces';
import { stairDivider, stairProgress } from './stairs';

export const EYE_HEIGHT = 1.65;
/** Body band above the feet that walls must leave free to pass: a low sill or a door head doesn't matter. */
const BODY_LOW = 0.2;
const BODY_HIGH = 1.6;
const MAX_SUBSTEP = 0.1;
/** A ramp is "the one you're on" when its height is this close to your feet. */
const STEP_TOLERANCE = 0.6;
const DIVIDER_HALF = 0.03;
const EPS = 1e-6;

/** A blocking strip: the segment a–b grown by `half` on each side. */
export type Segment = { a: Vec2; b: Vec2; half: number };

/** Wall parts that block a person on this floor (doors are gaps; wall under a window sill blocks), plus U-stairs dividers. */
export function blockingSegments(floor: Floor): Segment[] {
  const out: Segment[] = [];
  for (const w of floor.walls) {
    const half = w.thickness / 2;
    const d = normalize(sub(w.b, w.a));
    const pieces = wallPieces(
      wallLength(w),
      w.height ?? floor.height,
      floor.openings.filter((o) => o.wallId === w.id),
      isEndConnected(floor.walls, w.id, 'a') ? half : 0,
      isEndConnected(floor.walls, w.id, 'b') ? half : 0,
    )
      .filter((p) => p.z0 < BODY_HIGH && p.z1 > BODY_LOW)
      .sort((x, y) => x.u0 - y.u0);
    const merged: { u0: number; u1: number }[] = [];
    for (const p of pieces) {
      const last = merged.at(-1);
      if (last && p.u0 <= last.u1 + EPS) last.u1 = Math.max(last.u1, p.u1);
      else merged.push({ u0: p.u0, u1: p.u1 });
    }
    for (const m of merged) out.push({ a: add(w.a, scale(d, m.u0)), b: add(w.a, scale(d, m.u1)), half });
  }
  for (const r of floor.rooms) {
    if (r.kind !== 'stairs') continue;
    const div = stairDivider(r);
    if (div) out.push({ a: div[0], b: div[1], half: DIVIDER_HALF });
  }
  return out;
}

function closestOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 === 0) return a;
  const t = Math.min(1, Math.max(0, dot(sub(p, a), ab) / l2));
  return add(a, scale(ab, t));
}

/** Pushes a circle of `radius` out of every segment it overlaps. */
function resolve(p: Vec2, segments: Segment[], radius: number): Vec2 {
  let q = p;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const s of segments) {
      const c = closestOnSegment(q, s.a, s.b);
      const min = radius + s.half;
      const d = dist(q, c);
      if (d >= min - EPS) continue;
      const away = d > EPS ? scale(sub(q, c), 1 / d) : normalize(perp(sub(s.b, s.a)));
      q = add(c, scale(away, min));
      moved = true;
    }
    if (!moved) break;
  }
  return q;
}

/** Moves a person (a circle of `radius`) by `delta`, sliding along walls; sub-steps so it never tunnels. */
export function moveWithCollisions(pos: Vec2, delta: Vec2, segments: Segment[], radius: number): Vec2 {
  const n = Math.max(1, Math.ceil(len(delta) / MAX_SUBSTEP));
  // Track the correction separately so a free move lands exactly on pos + delta.
  let corr: Vec2 = { x: 0, y: 0 };
  let p = pos;
  for (let i = 1; i <= n; i++) {
    const nominal = add(pos, scale(delta, i / n));
    const target = add(nominal, corr);
    p = segments.length ? resolve(target, segments, radius) : target;
    corr = sub(p, nominal);
  }
  return p;
}

export type Level = { floorIndex: number; feet: number };

/**
 * Height of the feet at a plan point. On a stairs room the feet follow its ramp up to the next floor; of all
 * the ramps there (stacked stairs) the one continuous with `prevFeet` wins. Elsewhere you stay on the floor
 * nearest `prevFeet`.
 */
export function levelAt(project: Project, pos: Vec2, prevFeet: number): Level {
  const elev = project.floors.map((f) => floorElevation(project, f.id));
  let best: Level | null = null;
  let bestGap = STEP_TOLERANCE;
  const top = project.floors.length - 1;
  for (let i = 0; i <= top; i++) {
    // Stairs on the top floor still climb their floor's height (the 3D draws them), towards a future floor.
    const rise = project.floors[i].height;
    for (const r of project.floors[i].rooms) {
      if (r.kind !== 'stairs') continue;
      const t = stairProgress(r, pos);
      if (t === null) continue;
      const feet = elev[i] + t * rise;
      const gap = Math.abs(feet - prevFeet);
      if (gap > bestGap) continue;
      bestGap = gap;
      best = { floorIndex: t < 0.5 ? i : Math.min(i + 1, top), feet };
    }
  }
  if (best) return best;
  let floorIndex = 0;
  elev.forEach((e, i) => {
    if (Math.abs(e - prevFeet) < Math.abs(elev[floorIndex] - prevFeet)) floorIndex = i;
  });
  return { floorIndex, feet: elev[floorIndex] };
}

/** Walls of every floor that overlap the body of someone standing at `feet`. */
export function segmentsAt(project: Project, perFloor: Segment[][], feet: number): Segment[] {
  const lo = feet + BODY_LOW;
  const hi = feet + BODY_HIGH;
  const out: Segment[] = [];
  project.floors.forEach((f, i) => {
    const base = floorElevation(project, f.id);
    if (base < hi && base + f.height > lo) out.push(...perFloor[i]);
  });
  return out;
}
