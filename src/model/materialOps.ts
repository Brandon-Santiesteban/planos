// Material and finish operations. Each mutates a Project draft in place (immer-friendly), like ops.ts.
import { normalizeHex } from '../materials/colors';
import { isOutsideFace } from '../materials/wallFaces';
import type { FloorMaterial, Project, RailingType, Room, WallSide } from './types';

type Side = 'left' | 'right';

function floorOf(p: Project, floorId: string) {
  const f = p.floors.find((fl) => fl.id === floorId);
  if (!f) throw new Error(`Planta no encontrada: ${floorId}`);
  return f;
}

function roomOf(p: Project, floorId: string, roomId: string): Room | undefined {
  return floorOf(p, floorId).rooms.find((r) => r.id === roomId);
}

/** Merges a finish/colour patch into one face of a wall. Refuses (false) an invalid colour. */
export function setWallSide(p: Project, floorId: string, wallId: string, side: Side, patch: WallSide): boolean {
  const w = floorOf(p, floorId).walls.find((x) => x.id === wallId);
  if (!w) return false;
  const next: WallSide = { ...patch };
  if (patch.color !== undefined) {
    const c = normalizeHex(patch.color);
    if (!c) return false;
    next.color = c;
  }
  w.sides = { ...w.sides, [side]: { ...w.sides?.[side], ...next } };
  return true;
}

/** Gives every outside face of the floor's walls the same finish and colour; returns how many faces changed. */
export function applySideToFacade(p: Project, floorId: string, side: WallSide): number {
  const f = floorOf(p, floorId);
  let n = 0;
  for (const w of f.walls) {
    for (const s of ['left', 'right'] as const) {
      if (!isOutsideFace(f, w, s)) continue;
      w.sides = { ...w.sides, [s]: { ...side } };
      n++;
    }
  }
  return n;
}

export function setFloorMaterial(p: Project, floorId: string, roomId: string, m: FloorMaterial): void {
  const r = roomOf(p, floorId, roomId);
  if (r) r.floorMaterial = m;
}

export function setFloorColor(p: Project, floorId: string, roomId: string, color: string): boolean {
  const r = roomOf(p, floorId, roomId);
  const c = normalizeHex(color);
  if (!r || !c) return false;
  r.floorColor = c;
  return true;
}

export function setRailing(p: Project, floorId: string, roomId: string, railing: RailingType): void {
  const r = roomOf(p, floorId, roomId);
  if (r) r.railing = railing;
}

/** Colour of a balcony's celosía slats / parapet / glass railing metal. Refuses (false) an invalid colour. */
export function setRailingColor(p: Project, floorId: string, roomId: string, color: string): boolean {
  const r = roomOf(p, floorId, roomId);
  const c = normalizeHex(color);
  if (!r || !c) return false;
  r.railingColor = c;
  return true;
}
