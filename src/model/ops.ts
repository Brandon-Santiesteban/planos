// Domain operations. Each mutates a Project draft in place (immer-friendly).
import { fitOpening, wallLength } from '../geometry/walls';
import { polygonArea } from '../geometry/polygons';
import { add, dist, normalize, scale, sub } from '../geometry/vec';
import { createFloor, DEFAULTS } from './defaults';
import { newId } from './ids';
import { normalizeDegrees } from './orientation';
import { quickRoomOutline, uncoveredParts } from './quickRoom';
import type { Background, Floor, Opening, OpeningKind, Project, RoomKind, Vec2, Wall } from './types';

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
function moveJoints(f: Floor, moves: { joint: Joint; to: Vec2 }[]): boolean {
  const next = new Map<string, { a: Vec2; b: Vec2 }>();
  for (const { joint, to } of moves) {
    const w = getWall(f, joint.wallId);
    if (!w) continue;
    const cur = next.get(w.id) ?? { a: w.a, b: w.b };
    next.set(w.id, { ...cur, [joint.end]: to });
  }
  for (const ends of next.values()) if (dist(ends.a, ends.b) < DEFAULTS.minWallLength) return false;
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

export function translateJoints(p: Project, floorId: string, joints: Joint[], delta: Vec2): boolean {
  const f = getFloor(p, floorId);
  return moveJoints(
    f,
    joints.flatMap((joint) => {
      const w = getWall(f, joint.wallId);
      return w ? [{ joint, to: add(w[joint.end], delta) }] : [];
    }),
  );
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

export function addWall(p: Project, floorId: string, a: Vec2, b: Vec2, thickness?: number): string | null {
  if (dist(a, b) < DEFAULTS.minWallLength) return null;
  const id = newId();
  getFloor(p, floorId).walls.push({
    id,
    a: { ...a },
    b: { ...b },
    thickness: thickness ?? DEFAULTS.wallThickness,
    height: null,
  });
  return id;
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

export function setRoofHeight(p: Project, floorId: string, roomId: string, height: number): void {
  const r = getFloor(p, floorId).rooms.find((x) => x.id === roomId);
  if (r && height > 0) r.height = height;
}

export function deleteRoom(p: Project, floorId: string, roomId: string): void {
  const f = getFloor(p, floorId);
  f.rooms = f.rooms.filter((r) => r.id !== roomId);
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
