// Furniture operations. Like ops.ts, each one mutates a Project draft in place (immer-friendly).
// Rotation is in degrees, clockwise in plan; the front of a piece is its local +y (see src/furniture/catalog.ts).
import { catalogItem } from '../furniture/catalog';
import { dot, len, normalize, perp, sub } from '../geometry/vec';
import { newId } from './ids';
import type { Floor, Furniture, Project, Vec2, Wall } from './types';

const HEX = /^#[0-9a-fA-F]{6}$/;

/** 0 ≤ deg < 360, rounded to hundredths so repeated turns don't drift. */
export const normalizeRotation = (deg: number) => {
  const r = Math.round((((deg % 360) + 360) % 360) * 100) / 100;
  return r === 360 ? 0 : r;
};

function getFloor(p: Project, floorId: string): Floor {
  const f = p.floors.find((fl) => fl.id === floorId);
  if (!f) throw new Error(`Planta no encontrada: ${floorId}`);
  return f;
}

const find = (p: Project, floorId: string, id: string) => getFloor(p, floorId).furniture.find((x) => x.id === id);

/** A new piece with the catalog sizes, centred at `at`. Unknown types get a 50 cm box. */
export function furnitureFromCatalog(type: string, at: Vec2, rotation = 0): Omit<Furniture, 'id'> {
  const c = catalogItem(type);
  return {
    type,
    x: at.x,
    y: at.y,
    rotation: normalizeRotation(rotation),
    width: c?.width ?? 0.5,
    depth: c?.depth ?? 0.5,
    height: c?.height ?? 0.5,
    elevation: c?.elevation ?? 0,
    color: c?.color,
  };
}

export function addFurniture(p: Project, floorId: string, init: Omit<Furniture, 'id'>): string {
  const id = newId();
  const piece: Furniture = { ...init, id, rotation: normalizeRotation(init.rotation) };
  if (piece.color === undefined) delete piece.color;
  getFloor(p, floorId).furniture.push(piece);
  return id;
}

/** Depth and height a piece takes up once tipped over about its width axis. */
export function tiltedSize(f: { depth: number; height: number; tilt?: number }): { depth: number; height: number } {
  const t = ((f.tilt ?? 0) * Math.PI) / 180;
  const c = Math.abs(Math.cos(t));
  const s = Math.abs(Math.sin(t));
  return { depth: f.depth * c + f.height * s, height: f.height * c + f.depth * s };
}

export type FurniturePatch = Partial<Pick<Furniture, 'x' | 'y' | 'rotation' | 'tilt' | 'width' | 'depth' | 'height' | 'elevation' | 'color'>>;

/** Applies a patch; refuses (false) sizes that aren't positive, negative elevations or a colour that isn't #rrggbb. */
export function updateFurniture(p: Project, floorId: string, id: string, patch: FurniturePatch): boolean {
  const f = find(p, floorId, id);
  if (!f) return false;
  for (const k of ['width', 'depth', 'height'] as const) {
    const v = patch[k];
    if (v !== undefined && !(v > 0 && Number.isFinite(v))) return false;
  }
  if (patch.elevation !== undefined && !(patch.elevation >= 0 && Number.isFinite(patch.elevation))) return false;
  if (patch.color !== undefined && !HEX.test(patch.color)) return false;
  for (const k of ['x', 'y', 'rotation', 'tilt'] as const) if (patch[k] !== undefined && !Number.isFinite(patch[k])) return false;
  Object.assign(f, patch);
  if (patch.rotation !== undefined) f.rotation = normalizeRotation(patch.rotation);
  if (patch.tilt !== undefined) {
    const t = normalizeRotation(patch.tilt);
    if (t) f.tilt = t;
    else delete f.tilt;
  }
  return true;
}

export function moveFurniture(p: Project, floorId: string, id: string, to: Vec2): void {
  const f = find(p, floorId, id);
  if (f) {
    f.x = to.x;
    f.y = to.y;
  }
}

export function rotateFurniture(p: Project, floorId: string, id: string, delta: number): void {
  const f = find(p, floorId, id);
  if (f) f.rotation = normalizeRotation(f.rotation + delta);
}

export function setGateOpen(p: Project, floorId: string, id: string, open: boolean): void {
  const f = p.floors.find((fl) => fl.id === floorId)?.furniture.find((x) => x.id === id);
  if (f) f.open = open;
}

export function deleteFurniture(p: Project, floorId: string, id: string): void {
  const fl = getFloor(p, floorId);
  fl.furniture = fl.furniture.filter((x) => x.id !== id);
}

/** Copies a piece 30 cm down and to the right of the original. Returns the copy's id. */
export function duplicateFurniture(p: Project, floorId: string, id: string, offset: Vec2 = { x: 0.3, y: 0.3 }): string | null {
  const f = find(p, floorId, id);
  if (!f) return null;
  const { id: _old, ...rest } = f;
  void _old;
  return addFurniture(p, floorId, { ...rest, x: f.x + offset.x, y: f.y + offset.y });
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Local (x along width, y along depth) → plan. */
export function toPlan(f: Pick<Furniture, 'x' | 'y' | 'rotation'>, local: Vec2): Vec2 {
  const c = Math.cos(rad(f.rotation));
  const s = Math.sin(rad(f.rotation));
  return { x: f.x + local.x * c - local.y * s, y: f.y + local.x * s + local.y * c };
}

/** Footprint corners, clockwise from the back-left. */
export function furnitureCorners(f: Pick<Furniture, 'x' | 'y' | 'rotation' | 'width' | 'depth'>): Vec2[] {
  const w = f.width / 2;
  const d = f.depth / 2;
  return [{ x: -w, y: -d }, { x: w, y: -d }, { x: w, y: d }, { x: -w, y: d }].map((q) => toPlan(f, q));
}

/** True when `pt` is on the piece's footprint (grown by `tolerance`). */
export function pointInFurniture(f: Furniture, pt: Vec2, tolerance = 0): boolean {
  const c = Math.cos(rad(f.rotation));
  const s = Math.sin(rad(f.rotation));
  const dx = pt.x - f.x;
  const dy = pt.y - f.y;
  const lx = dx * c + dy * s;
  const ly = -dx * s + dy * c;
  return Math.abs(lx) <= f.width / 2 + tolerance && Math.abs(ly) <= tiltedSize(f).depth / 2 + tolerance;
}

/** Top of the highest piece (other than `selfId`) whose footprint contains `at`; null if there is none. */
export function stackElevation(pieces: Furniture[], at: Vec2, selfId: string | null): number | null {
  let best: number | null = null;
  for (const f of pieces) {
    if (f.id === selfId || !pointInFurniture(f, at)) continue;
    const top = f.elevation + f.height;
    if (best === null || top > best) best = top;
  }
  return best;
}

/** True when the piece rests on top of another one. */
export function isStacked(pieces: Furniture[], f: Furniture): boolean {
  const below = stackElevation(pieces, f, f.id);
  return below !== null && f.elevation > 0.005 && Math.abs(below - f.elevation) < 0.01;
}

/**
 * Elevation of a piece dropped at `at` (3D editing): on top of the highest piece below it; with nothing below,
 * back on the floor if it was stacked, else unchanged (a whiteboard keeps its height on the wall).
 */
export function dropElevation(pieces: Furniture[], f: Furniture, at: Vec2, wasStacked: boolean, ignore: string[] = []): number {
  const below = stackElevation(pieces.filter((p) => !ignore.includes(p.id)), at, f.id);
  if (below !== null) return below;
  return wasStacked ? 0 : f.elevation;
}

/** Ids of the pieces resting on `f`, and on those, and so on (they move together with it). */
export function piecesOnTop(pieces: Furniture[], f: Furniture): string[] {
  const out: string[] = [];
  const visit = (base: Furniture) => {
    for (const p of pieces) {
      if (p.id === f.id || out.includes(p.id)) continue;
      if (Math.abs(p.elevation - (base.elevation + base.height)) < 0.01 && pointInFurniture(base, p)) {
        out.push(p.id);
        visit(p);
      }
    }
  };
  visit(f);
  return out;
}

/** Pieces in drawing / picking order: lower ones first. */
export function byElevation(pieces: Furniture[]): Furniture[] {
  return pieces.map((f, i) => ({ f, i })).sort((a, b) => a.f.elevation - b.f.elevation || a.i - b.i).map((x) => x.f);
}

/** The piece under `pt` (highest first), if any. */
export function furnitureAt(pieces: Furniture[], pt: Vec2, tolerance = 0): Furniture | null {
  const ordered = byElevation(pieces);
  for (let i = ordered.length - 1; i >= 0; i--) if (pointInFurniture(ordered[i], pt, tolerance)) return ordered[i];
  return null;
}

/** Signed distance of `p` from the wall's centreline along its +perp, and the offset along it (unclamped). */
function wallFrame(w: Wall, p: Vec2) {
  const d = normalize(sub(w.b, w.a));
  const n = perp(d);
  const rel = sub(p, w.a);
  return { d, n, along: dot(rel, d), side: dot(rel, n), length: len(sub(w.b, w.a)) };
}

/** Half the extent of a rotated piece along a unit direction. */
function halfExtent(width: number, depth: number, rotation: number, dir: Vec2): number {
  const ax = { x: Math.cos(rad(rotation)), y: Math.sin(rad(rotation)) };
  const ay = { x: -ax.y, y: ax.x };
  return (Math.abs(dot(ax, dir)) * width + Math.abs(dot(ay, dir)) * depth) / 2;
}

/** Rotation (degrees) whose front (local +y) points along `dir`. */
const facing = (dir: Vec2) => normalizeRotation((Math.atan2(-dir.x, dir.y) * 180) / Math.PI);

/**
 * Placement near walls: when the piece, turned with its back to the nearest wall (plus the user's own `userRotation`),
 * ends up within `maxGap` of the wall's face, returns it flush against that face. Null when no wall is close.
 */
export function snapToWalls(
  walls: Wall[], centre: Vec2, width: number, depth: number, userRotation: number, maxGap: number,
): { x: number; y: number; rotation: number } | null {
  let best: { x: number; y: number; rotation: number; gap: number } | null = null;
  for (const w of walls) {
    const fr = wallFrame(w, centre);
    if (fr.length === 0 || fr.along < 0 || fr.along > fr.length) continue;
    const sign = fr.side >= 0 ? 1 : -1;
    const out = { x: fr.n.x * sign, y: fr.n.y * sign }; // from the wall towards the piece
    const rotation = normalizeRotation(facing(out) + userRotation);
    const half = halfExtent(width, depth, rotation, out);
    const gap = Math.abs(fr.side) - w.thickness / 2 - half;
    if (Math.abs(gap) > maxGap || Math.abs(fr.side) < w.thickness / 2) continue;
    if (best && Math.abs(gap) >= Math.abs(best.gap)) continue;
    const dist = w.thickness / 2 + half;
    best = {
      x: w.a.x + fr.d.x * fr.along + out.x * dist,
      y: w.a.y + fr.d.y * fr.along + out.y * dist,
      rotation,
      gap,
    };
  }
  return best && { x: best.x, y: best.y, rotation: best.rotation };
}

/** While dragging: pushes a piece that is parallel to a nearby wall flush against it, keeping its rotation. */
export function snapFlushToWall(walls: Wall[], f: Furniture, maxGap: number): Vec2 | null {
  let best: { x: number; y: number; gap: number } | null = null;
  for (const w of walls) {
    const fr = wallFrame(w, f);
    if (fr.length === 0 || fr.along < 0 || fr.along > fr.length) continue;
    const wallDeg = (Math.atan2(fr.d.y, fr.d.x) * 180) / Math.PI;
    const rel = normalizeRotation(f.rotation - wallDeg) % 90;
    if (Math.min(rel, 90 - rel) > 0.5) continue; // not parallel
    const sign = fr.side >= 0 ? 1 : -1;
    const out = { x: fr.n.x * sign, y: fr.n.y * sign };
    const half = halfExtent(f.width, tiltedSize(f).depth, f.rotation, out);
    const gap = Math.abs(fr.side) - w.thickness / 2 - half;
    if (Math.abs(gap) > maxGap || Math.abs(fr.side) < w.thickness / 2) continue;
    if (best && Math.abs(gap) >= Math.abs(best.gap)) continue;
    best = { x: f.x - out.x * gap, y: f.y - out.y * gap, gap };
  }
  return best && { x: best.x, y: best.y };
}
