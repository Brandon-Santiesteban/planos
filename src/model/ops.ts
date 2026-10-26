// Domain operations. Each mutates a Project draft in place (immer-friendly).
import { fitOpening, wallLength } from '../geometry/walls';
import { polygonArea } from '../geometry/polygons';
import { add, dist, normalize, scale, sub } from '../geometry/vec';
import { createFloor, DEFAULTS } from './defaults';
import { newId } from './ids';
import type { Floor, Opening, OpeningKind, Project, RoomKind, Vec2, Wall } from './types';

function getFloor(p: Project, floorId: string): Floor {
  const f = p.floors.find((fl) => fl.id === floorId);
  if (!f) throw new Error(`Planta no encontrada: ${floorId}`);
  return f;
}

function getWall(f: Floor, wallId: string): Wall | undefined {
  return f.walls.find((w) => w.id === wallId);
}

/** Moves every wall endpoint on the floor that sits at `from` to `to`. */
function moveEndpointsAt(f: Floor, from: Vec2, to: Vec2): void {
  for (const w of f.walls) {
    if (dist(w.a, from) <= DEFAULTS.joinTolerance) w.a = { ...to };
    if (dist(w.b, from) <= DEFAULTS.joinTolerance) w.b = { ...to };
  }
}

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
): void {
  const w = getWall(getFloor(p, floorId), wallId);
  if (w) Object.assign(w, patch);
}

export function setWallLength(p: Project, floorId: string, wallId: string, length: number): void {
  const f = getFloor(p, floorId);
  const w = getWall(f, wallId);
  if (!w || length < DEFAULTS.minWallLength) return;
  const to = add(w.a, scale(normalize(sub(w.b, w.a)), length));
  moveEndpointsAt(f, w.b, to);
  refitOpenings(f);
}

export function moveWallEndpoint(p: Project, floorId: string, wallId: string, end: 'a' | 'b', to: Vec2): void {
  const f = getFloor(p, floorId);
  const w = getWall(f, wallId);
  if (!w) return;
  const other = end === 'a' ? w.b : w.a;
  if (dist(other, to) < DEFAULTS.minWallLength) return;
  moveEndpointsAt(f, w[end], to);
  refitOpenings(f);
}

export function moveWall(p: Project, floorId: string, wallId: string, delta: Vec2): void {
  const f = getFloor(p, floorId);
  const w = getWall(f, wallId);
  if (!w) return;
  const a = { ...w.a };
  const b = { ...w.b };
  moveEndpointsAt(f, a, add(a, delta));
  moveEndpointsAt(f, b, add(b, delta));
  refitOpenings(f);
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
  const others = f.openings.filter((o) => o.wallId === wallId);
  const c = fitOpening(wallLength(w), offset, d.width, others);
  if (c === null) return null;
  const id = newId();
  f.openings.push({ id, wallId, kind, offset: c, width: d.width, height: d.height, sill: d.sill });
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
  const wallH = w.height ?? f.height;
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

export function renameRoom(p: Project, floorId: string, roomId: string, name: string): void {
  const r = getFloor(p, floorId).rooms.find((x) => x.id === roomId);
  if (r) r.name = name;
}

export function setRoomKind(p: Project, floorId: string, roomId: string, kind: RoomKind): void {
  const r = getFloor(p, floorId).rooms.find((x) => x.id === roomId);
  if (r) r.kind = kind;
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

export function setFloorHeight(p: Project, floorId: string, h: number): void {
  if (h > 0) getFloor(p, floorId).height = h;
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

export function floorElevation(p: Project, floorId: string): number {
  let h = 0;
  for (const f of p.floors) {
    if (f.id === floorId) return h;
    h += f.height;
  }
  return h;
}
