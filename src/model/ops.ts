// Domain operations. Each mutates a Project draft in place (immer-friendly).
import { fitOpening, wallLength } from '../geometry/walls';
import { polygonArea } from '../geometry/polygons';
import { add, dist, normalize, scale, sub } from '../geometry/vec';
import { createFloor, DEFAULTS } from './defaults';
import { newId } from './ids';
import { normalizeDegrees } from './orientation';
import { quickRoomOutline, uncoveredParts } from './quickRoom';
import type { Background, Floor, Opening, OpeningKind, Project, RoomKind, StairShape, StairUp, Vec2, Wall } from './types';

function getFloor(p: Project, floorId: string): Floor {
  const f = p.floors.find((fl) => fl.id === floorId);
  if (!f) throw new Error(`Planta no encontrada: ${floorId}`);
  return f;
}

function getWall(f: Floor, wallId: string): Wall | undefined {
  return f.walls.find((w) => w.id === wallId);
}

/** A wall end; joints sharing a point move together. */
export type Joint = { wallId: string; end: 'a' | 'b' };

/** Every wall end on the floor sitting at `pt`. Record these at the start of a drag. */
export function jointsAt(f: Floor, pt: Vec2): Joint[] {
  const out: Joint[] = [];
  for (const w of f.walls) {
    if (dist(w.a, pt) <= DEFAULTS.joinTolerance) out.push({ wallId: w.id, end: 'a' });
    if (dist(w.b, pt) <= DEFAULTS.joinTolerance) out.push({ wallId: w.id, end: 'b' });
  }
  return out;
}

/** Moves exactly the given joints; refuses (returns false) if any wall would become too short. */
function moveJoints(f: Floor, moves: { joint: Joint; to: Vec2 }[], mayShrink: string[] = []): boolean {
  const next = new Map<string, { a: Vec2; b: Vec2 }>();
  for (const { joint, to } of moves) {
    const w = getWall(f, joint.wallId);
    if (!w) continue;
    const cur = next.get(w.id) ?? { a: w.a, b: w.b };
    next.set(w.id, { ...cur, [joint.end]: to });
  }
  for (const [id, ends] of next) if (dist(ends.a, ends.b) < DEFAULTS.minWallLength && !mayShrink.includes(id)) return false;
  for (const [id, ends] of next) {
    const w = getWall(f, id)!;
    w.a = { ...ends.a };
    w.b = { ...ends.b };
  }
  refitOpenings(f);
  return true;
}

export function setJoints(p: Project, floorId: string, joints: Joint[], to: Vec2): boolean {
  return moveJoints(getFloor(p, floorId), joints.map((joint) => ({ joint, to })));
}

/** A room corner, by room and position in its outline. */
export type RoomPointRef = { roomId: string; index: number };

/**
 * Gets walls ready to be dragged whole (`joints` from wallJoints). A wall that carries straight on from a dragged one
 * stays where it is (moving its end would turn it diagonal): the two come apart and a short wall joins them, starting
 * at length 0 and growing with the drag. Room sides along the dragged walls get a matching step, so a room keeps to its
 * walls. Returns the joints to move and the room corners that move with them.
 */
export function prepareWallDrag(p: Project, floorId: string, joints: Joint[]): { joints: Joint[]; followers: RoomPointRef[]; steps: string[] } {
  const f = getFloor(p, floorId);
  const ends = new Map<string, number>();
  for (const j of joints) ends.set(j.wallId, (ends.get(j.wallId) ?? 0) | (j.end === 'a' ? 1 : 2));
  const moved = f.walls.filter((w) => ends.get(w.id) === 3);
  const tol = (w: Wall) => w.thickness / 2 + DEFAULTS.joinTolerance;

  const kept: Joint[] = [];
  const steps: string[] = [];
  for (const j of joints) {
    const w = getWall(f, j.wallId);
    if (!w || ends.get(w.id) === 3) {
      kept.push(j);
      continue;
    }
    const at = w[j.end];
    const other = w[j.end === 'a' ? 'b' : 'a'];
    const runsOn = moved.find((m) => (dist(m.a, at) <= DEFAULTS.joinTolerance || dist(m.b, at) <= DEFAULTS.joinTolerance)
      && distToLine(other, m.a, m.b) <= DEFAULTS.joinTolerance);
    if (!runsOn) {
      kept.push(j);
      continue;
    }
    const id = newId(); // the step: from the wall that stays to the one that moves
    f.walls.push({ id, a: { ...at }, b: { ...at }, thickness: runsOn.thickness, height: runsOn.height });
    kept.push({ wallId: id, end: 'b' });
    steps.push(id);
  }

  const onWall = (q: Vec2) => moved.some((w) => distToSegment(q, w.a, w.b) <= tol(w));
  const followers: RoomPointRef[] = [];
  for (const r of f.rooms) {
    const out: { q: Vec2; follows: boolean }[] = [];
    r.points.forEach((a, i) => {
      const b = r.points[(i + 1) % r.points.length];
      out.push({ q: a, follows: onWall(a) });
      const ab = sub(b, a);
      const len2 = ab.x * ab.x + ab.y * ab.y;
      if (!len2) return;
      const cuts: { t: number; entering: boolean }[] = [];
      for (const w of moved) {
        if (distToLine(a, w.a, w.b) > tol(w) || distToLine(b, w.a, w.b) > tol(w)) continue; // not along this wall
        const ts = [w.a, w.b].map((e) => ((e.x - a.x) * ab.x + (e.y - a.y) * ab.y) / len2).sort((x, y) => x - y);
        if (ts[1] <= 0 || ts[0] >= 1) continue;
        if (ts[0] > 1e-6) cuts.push({ t: ts[0], entering: true });
        if (ts[1] < 1 - 1e-6) cuts.push({ t: ts[1], entering: false });
      }
      for (const c of cuts.sort((x, y) => x.t - y.t)) {
        const q = add(a, scale(ab, c.t));
        const pair = [{ q, follows: false }, { q: { ...q }, follows: true }];
        out.push(...(c.entering ? pair : pair.reverse()));
      }
    });
    if (out.length !== r.points.length) r.points = out.map((o) => o.q);
    out.forEach((o, index) => { if (o.follows) followers.push({ roomId: r.id, index }); });
  }
  return { joints: kept, followers, steps };
}

/**
 * Moves wall ends by `delta`. Walls moved whole (both ends) carry the room corners lying on their faces, so rooms keep
 * matching their walls. In a drag, `prepared` comes from prepareWallDrag at its start; without it this is one move.
 */
export function translateJoints(
  p: Project,
  floorId: string,
  joints: Joint[],
  delta: Vec2,
  prepared?: ReturnType<typeof prepareWallDrag>,
): boolean {
  const f = getFloor(p, floorId);
  const before = prepared ? null : structuredClone({ walls: f.walls, rooms: f.rooms });
  const { joints: moving, followers, steps } = prepared ?? prepareWallDrag(p, floorId, joints);
  const ok = moveJoints(
    f,
    moving.flatMap((joint) => {
      const w = getWall(f, joint.wallId);
      return w ? [{ joint, to: add(w[joint.end], delta) }] : [];
    }),
    steps, // a step wall starts at length 0
  );
  if (!ok) {
    if (before) Object.assign(f, before);
    return false;
  }
  for (const { roomId, index } of followers) {
    const q = f.rooms.find((r) => r.id === roomId)?.points[index];
    if (q) Object.assign(q, add(q, delta));
  }
  if (!prepared) tidyRoomOutlines(p, floorId);
  return true;
}

/** After a drag: drops step walls that stayed at length 0, repeated room corners and corners in the middle of a side. */
export function tidyRoomOutlines(p: Project, floorId: string): void {
  const f = getFloor(p, floorId);
  f.walls = f.walls.filter((w) => dist(w.a, w.b) > 1e-6 || f.openings.some((o) => o.wallId === w.id));
  for (const r of f.rooms) {
    let pts = r.points.filter((q, i) => dist(q, r.points[(i + 1) % r.points.length]) > 1e-6);
    pts = pts.filter((q, i) => {
      const a = pts[(i + pts.length - 1) % pts.length];
      const b = pts[(i + 1) % pts.length];
      return distToLine(q, a, b) > 1e-6;
    });
    if (pts.length >= 3 && pts.length !== r.points.length) r.points = pts;
  }
}

function distToLine(q: Vec2, a: Vec2, b: Vec2): number {
  const l = dist(a, b);
  return l ? Math.abs((q.x - a.x) * (b.y - a.y) - (q.y - a.y) * (b.x - a.x)) / l : dist(q, a);
}

function distToSegment(q: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const len2 = ab.x * ab.x + ab.y * ab.y;
  const t = len2 ? Math.max(0, Math.min(1, ((q.x - a.x) * ab.x + (q.y - a.y) * ab.y) / len2)) : 0;
  return dist(q, add(a, { x: ab.x * t, y: ab.y * t }));
}

/** Width (x) and length (y) of a room drawn as an axis-aligned rectangle, or null for any other shape. */
export function rectRoomSize(r: { points: Vec2[] }): { width: number; depth: number } | null {
  if (r.points.length !== 4) return null;
  const xs = [...new Set(r.points.map((q) => Math.round(q.x * 1e4) / 1e4))];
  const ys = [...new Set(r.points.map((q) => Math.round(q.y * 1e4) / 1e4))];
  if (xs.length !== 2 || ys.length !== 2) return null;
  return { width: Math.abs(xs[1] - xs[0]), depth: Math.abs(ys[1] - ys[0]) };
}

/**
 * Resizes a rectangular room by moving its right side (width) or its bottom side (length), together with the walls
 * standing on that side and everything joined to them; the opposite sides stay put.
 */
export function resizeRectRoom(p: Project, floorId: string, roomId: string, size: { width?: number; depth?: number }): boolean {
  const f = getFloor(p, floorId);
  const r = f.rooms.find((x) => x.id === roomId);
  const cur = r && rectRoomSize(r);
  if (!r || !cur) return false;
  const x1 = Math.max(...r.points.map((q) => q.x));
  const y1 = Math.max(...r.points.map((q) => q.y));
  const y0 = Math.min(...r.points.map((q) => q.y));
  const x0 = Math.min(...r.points.map((q) => q.x));
  const shift = (axis: 'x' | 'y', delta: number) => {
    if (Math.abs(delta) < 1e-6) return true;
    const line = axis === 'x' ? x1 : y1;
    const [lo, hi] = axis === 'x' ? [y0, y1] : [x0, x1];
    const other = axis === 'x' ? 'y' : 'x';
    const walls = f.walls.filter((w) => {
      const along = Math.abs(w.a[axis] - w.b[axis]) < 1e-6 && Math.abs(w.a[axis] - (line + Math.sign(line - (axis === 'x' ? x0 : y0)) * w.thickness / 2)) < 0.02;
      const overlap = Math.min(hi, Math.max(w.a[other], w.b[other])) - Math.max(lo, Math.min(w.a[other], w.b[other]));
      return along && overlap > 0.05;
    });
    const step = axis === 'x' ? { x: delta, y: 0 } : { x: 0, y: delta };
    if (!walls.length) {
      for (const q of r.points) if (Math.abs(q[axis] - line) < 1e-6) Object.assign(q, add(q, step));
      return true;
    }
    return translateJoints(p, floorId, walls.flatMap((w) => wallJoints(f, w.id)), step);
  };
  const okW = size.width === undefined || shift('x', size.width - cur.width);
  const okD = size.depth === undefined || shift('y', size.depth - cur.depth);
  return okW && okD;
}

/** Both ends of a wall plus every end joined to them. */
export function wallJoints(f: Floor, wallId: string): Joint[] {
  const w = getWall(f, wallId);
  return w ? [...jointsAt(f, w.a), ...jointsAt(f, w.b)] : [];
}

function wallHeight(f: Floor, w: Wall): number {
  return w.height ?? f.height;
}

/** Top of the tallest opening on a wall (0 if none). */
function openingsTop(f: Floor, wallId: string): number {
  return Math.max(0, ...f.openings.filter((o) => o.wallId === wallId).map((o) => o.sill + o.height));
}

const MIN_OPENING_HEIGHT = 0.3;

/** Re-fits the openings of walls whose length changed; drops those that no longer fit. */
function refitOpenings(f: Floor): void {
  const kept: Opening[] = [];
  for (const o of f.openings) {
    const w = getWall(f, o.wallId);
    if (!w) continue;
    const others = kept.filter((k) => k.wallId === o.wallId);
    const c = fitOpening(wallLength(w), o.offset, o.width, others);
    if (c === null) continue;
    o.offset = c;
    kept.push(o);
  }
  f.openings = kept;
}

export function addWall(p: Project, floorId: string, a: Vec2, b: Vec2, thickness?: number, kind?: Wall['kind']): string | null {
  if (dist(a, b) < DEFAULTS.minWallLength) return null;
  const id = newId();
  getFloor(p, floorId).walls.push({
    id,
    a: { ...a },
    b: { ...b },
    thickness: thickness ?? (kind === 'drywall' ? DEFAULTS.drywallThickness : DEFAULTS.wallThickness),
    height: null,
    ...(kind ? { kind } : {}),
  });
  return id;
}

/**
 * Masonry or drywall. The thickness follows the kind when it still has the other kind's usual value
 * (15 cm ↔ 10 cm); a thickness the user typed is kept.
 */
export function setWallKind(p: Project, floorId: string, wallId: string, kind: 'mamposteria' | 'drywall'): boolean {
  const w = getFloor(p, floorId).walls.find((x) => x.id === wallId);
  if (!w) return false;
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  if (kind === 'drywall') {
    if (near(w.thickness, DEFAULTS.wallThickness)) w.thickness = DEFAULTS.drywallThickness;
    w.kind = 'drywall';
  } else {
    if (near(w.thickness, DEFAULTS.drywallThickness)) w.thickness = DEFAULTS.wallThickness;
    delete w.kind;
  }
  return true;
}

export function updateWall(
  p: Project,
  floorId: string,
  wallId: string,
  patch: Partial<Pick<Wall, 'thickness' | 'height'>>,
): boolean {
  const f = getFloor(p, floorId);
  const w = getWall(f, wallId);
  if (!w) return false;
  if (patch.thickness !== undefined && !(patch.thickness > 0)) return false;
  if (patch.height !== undefined) {
    const h = patch.height ?? f.height;
    if (!(h > 0) || h + 1e-9 < openingsTop(f, wallId)) return false;
  }
  Object.assign(w, patch);
  return true;
}

export function setWallLength(p: Project, floorId: string, wallId: string, length: number): boolean {
  const f = getFloor(p, floorId);
  const w = getWall(f, wallId);
  if (!w) return false;
  const to = add(w.a, scale(normalize(sub(w.b, w.a)), length));
  return moveJoints(f, jointsAt(f, w.b).map((joint) => ({ joint, to })));
}

export function moveWallEndpoint(p: Project, floorId: string, wallId: string, end: 'a' | 'b', to: Vec2): boolean {
  const f = getFloor(p, floorId);
  const w = getWall(f, wallId);
  return w ? setJoints(p, floorId, jointsAt(f, w[end]), to) : false;
}

export function moveWall(p: Project, floorId: string, wallId: string, delta: Vec2): boolean {
  return translateJoints(p, floorId, wallJoints(getFloor(p, floorId), wallId), delta);
}

export function deleteWall(p: Project, floorId: string, wallId: string): void {
  const f = getFloor(p, floorId);
  f.walls = f.walls.filter((w) => w.id !== wallId);
  f.openings = f.openings.filter((o) => o.wallId !== wallId);
}

export function addOpening(p: Project, floorId: string, wallId: string, kind: OpeningKind, offset: number): string | null {
  const f = getFloor(p, floorId);
  const w = getWall(f, wallId);
  if (!w) return null;
  const d = DEFAULTS[kind];
  const height = Math.min(d.height, wallHeight(f, w) - d.sill);
  if (height < MIN_OPENING_HEIGHT) return null;
  const others = f.openings.filter((o) => o.wallId === wallId);
  const c = fitOpening(wallLength(w), offset, d.width, others);
  if (c === null) return null;
  const id = newId();
  f.openings.push({ id, wallId, kind, offset: c, width: d.width, height, sill: d.sill });
  return id;
}

export function updateOpening(
  p: Project,
  floorId: string,
  openingId: string,
  patch: Partial<Pick<Opening, 'offset' | 'width' | 'height' | 'sill'>>,
): boolean {
  const f = getFloor(p, floorId);
  const o = f.openings.find((x) => x.id === openingId);
  if (!o) return false;
  const w = getWall(f, o.wallId);
  if (!w) return false;
  const next = { ...o, ...patch };
  const wallH = wallHeight(f, w);
  if (next.width <= 0 || next.height <= 0 || next.sill < 0 || next.sill + next.height > wallH + 1e-9) return false;
  const others = f.openings.filter((x) => x.wallId === o.wallId && x.id !== o.id);
  const c = fitOpening(wallLength(w), next.offset, next.width, others);
  if (c === null) return false;
  Object.assign(o, next, { offset: c });
  return true;
}

export function deleteOpening(p: Project, floorId: string, openingId: string): void {
  const f = getFloor(p, floorId);
  f.openings = f.openings.filter((o) => o.id !== openingId);
}

export function addRoom(p: Project, floorId: string, points: Vec2[], name: string): string | null {
  if (points.length < 3 || polygonArea(points) < 0.01) return null;
  const id = newId();
  getFloor(p, floorId).rooms.push({ id, name, kind: 'room', points: points.map((q) => ({ ...q })) });
  return id;
}

/**
 * Adds a rectangular room measuring `w` × `d` inside, with walls around it. Walls that would lie on top of
 * existing ones are not duplicated, so neighbouring rooms share them. Returns the room id.
 */
export function addRectRoom(
  p: Project,
  floorId: string,
  origin: Vec2,
  w: number,
  d: number,
  name: string,
  thickness: number = DEFAULTS.wallThickness,
): string | null {
  if (!(w > 0) || !(d > 0)) return null;
  const f = getFloor(p, floorId);
  const { corners, interior } = quickRoomOutline(origin, w, d, thickness);
  for (let i = 0; i < 4; i++) {
    const existing = [...f.walls];
    for (const [a, b] of uncoveredParts(corners[i], corners[(i + 1) % 4], existing, DEFAULTS.minWallLength)) {
      addWall(p, floorId, a, b, thickness);
    }
  }
  return addRoom(p, floorId, interior, name);
}

export function renameRoom(p: Project, floorId: string, roomId: string, name: string): void {
  const r = getFloor(p, floorId).rooms.find((x) => x.id === roomId);
  if (r) r.name = name;
}

export function setRoomKind(p: Project, floorId: string, roomId: string, kind: RoomKind): void {
  const r = getFloor(p, floorId).rooms.find((x) => x.id === roomId);
  if (r) r.kind = kind;
}

export function setStairUp(p: Project, floorId: string, roomId: string, up: StairUp): void {
  const r = getFloor(p, floorId).rooms.find((x) => x.id === roomId);
  if (r) r.up = up;
}

export function setStairShape(p: Project, floorId: string, roomId: string, shape: StairShape): void {
  const r = getFloor(p, floorId).rooms.find((x) => x.id === roomId);
  if (r) r.stairShape = shape;
}

/** Doors: swing to the other side of the wall. */
export function setDoorGlass(p: Project, floorId: string, openingId: string, glass: boolean): void {
  const o = getFloor(p, floorId).openings.find((x) => x.id === openingId);
  if (!o || o.kind !== 'door') return;
  o.glass = glass;
  if (glass) delete o.mirror;
}

/** An open doorway with no door (or back to a plain door). */
export function setDoorVano(p: Project, floorId: string, openingId: string, vano: boolean): void {
  const o = getFloor(p, floorId).openings.find((x) => x.id === openingId);
  if (!o || o.kind !== 'door') return;
  if (vano) {
    o.vano = true;
    delete o.glass;
    delete o.mirror;
  } else delete o.vano;
}

/** A sliding mirror door (or back to a plain door). A door is glass or mirror, not both. */
export function setDoorMirror(p: Project, floorId: string, openingId: string, mirror: boolean): void {
  const o = getFloor(p, floorId).openings.find((x) => x.id === openingId);
  if (!o || o.kind !== 'door') return;
  if (mirror) {
    o.mirror = true;
    delete o.glass;
  } else delete o.mirror;
}

export function toggleDoorFlip(p: Project, floorId: string, openingId: string): void {
  const o = getFloor(p, floorId).openings.find((x) => x.id === openingId);
  if (o && o.kind === 'door') o.flip = !o.flip;
}

export function setRoofHeight(p: Project, floorId: string, roomId: string, height: number): void {
  const r = getFloor(p, floorId).rooms.find((x) => x.id === roomId);
  if (r && height > 0) r.height = height;
}

export function deleteRoom(p: Project, floorId: string, roomId: string): void {
  const f = getFloor(p, floorId);
  f.rooms = f.rooms.filter((r) => r.id !== roomId);
}

/** Deletes several items of one floor at once (a box selection). */
export function deleteItems(p: Project, floorId: string, items: { kind: 'wall' | 'opening' | 'room' | 'furniture'; id: string }[]): void {
  const f = getFloor(p, floorId);
  const ids = (kind: string) => new Set(items.filter((i) => i.kind === kind).map((i) => i.id));
  const walls = ids('wall');
  const openings = ids('opening');
  const rooms = ids('room');
  const furniture = ids('furniture');
  f.walls = f.walls.filter((w) => !walls.has(w.id));
  f.openings = f.openings.filter((o) => !openings.has(o.id) && !walls.has(o.wallId));
  f.rooms = f.rooms.filter((r) => !rooms.has(r.id));
  f.furniture = f.furniture.filter((m) => !furniture.has(m.id));
}

export function addFloor(p: Project): string {
  const used = new Set(p.floors.map((f) => f.name));
  let n = 1;
  while (used.has(`Planta ${n}`)) n++;
  const f = createFloor(`Planta ${n}`);
  p.floors.push(f);
  return f.id;
}

export function renameFloor(p: Project, floorId: string, name: string): void {
  getFloor(p, floorId).name = name;
}

export function setFloorHeight(p: Project, floorId: string, h: number): boolean {
  const f = getFloor(p, floorId);
  if (!(h > 0)) return false;
  if (f.walls.some((w) => w.height === null && h + 1e-9 < openingsTop(f, w.id))) return false;
  f.height = h;
  return true;
}

export function moveFloor(p: Project, floorId: string, dir: -1 | 1): void {
  const i = p.floors.findIndex((f) => f.id === floorId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= p.floors.length) return;
  [p.floors[i], p.floors[j]] = [p.floors[j], p.floors[i]];
}

export function deleteFloor(p: Project, floorId: string): boolean {
  if (p.floors.length <= 1) return false;
  const before = p.floors.length;
  p.floors = p.floors.filter((f) => f.id !== floorId);
  return p.floors.length < before;
}

export function setBackground(p: Project, floorId: string, bg: Background | null): void {
  getFloor(p, floorId).background = bg;
}

export function updateBackground(
  p: Project,
  floorId: string,
  patch: Partial<Pick<Background, 'origin' | 'metresPerPixel' | 'opacity'>>,
): void {
  const bg = getFloor(p, floorId).background;
  if (bg) Object.assign(bg, patch);
}

export function setNorth(p: Project, degrees: number): void {
  p.north = normalizeDegrees(degrees);
}

export function floorElevation(p: Project, floorId: string): number {
  let h = 0;
  for (const f of p.floors) {
    if (f.id === floorId) return h;
    h += f.height;
  }
  return h;
}
