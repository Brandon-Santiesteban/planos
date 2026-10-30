// Store-level furniture actions shared by the 2D tools, the 3D view, the panels and the shortcuts.
import { snapToGrid } from '../geometry/snap';
import {
  addFurniture, deleteFurniture, dropElevation, duplicateFurniture, isStacked, piecesOnTop, rotateFurniture, snapFlushToWall,
  updateFurniture,
} from '../model/furnitureOps';
import type { Furniture, Vec2 } from '../model/types';
import { useEditor } from '../store/editorStore';
import { notify } from '../ui/toasts';

/** Positions snap to this step unless Alt is held. */
export const FURNITURE_STEP = 0.05;
/** A piece closer than this to a wall sits flush against it. */
export const WALL_SNAP = 0.15;

function selectedFurnitureId(): string | null {
  const sel = useEditor.getState().selection;
  return sel?.kind === 'furniture' ? sel.id : null;
}

/** A piece being dragged, with whatever rests on it (a monitor on a desk moves with the desk). */
export interface FurnitureDrag {
  id: string;
  floorId: string;
  start: Vec2;
  elevation: number;
  wasStacked: boolean;
  riders: { id: string; start: Vec2; elevation: number }[];
}

export function beginFurnitureDrag(id: string, floorId = useEditor.getState().activeFloorId): FurnitureDrag | null {
  const floor = useEditor.getState().project.floors.find((f) => f.id === floorId);
  const piece = floor?.furniture.find((f) => f.id === id);
  if (!floor || !piece) return null;
  const riders = piecesOnTop(floor.furniture, piece).map((rid) => {
    const r = floor.furniture.find((f) => f.id === rid)!;
    return { id: rid, start: { x: r.x, y: r.y }, elevation: r.elevation };
  });
  return {
    id, floorId, start: { x: piece.x, y: piece.y }, elevation: piece.elevation, wasStacked: isStacked(floor.furniture, piece), riders,
  };
}

/**
 * Moves a dragged piece (no history entry: call `checkpoint()` once when the drag starts).
 * With `snap`, the centre goes to the 5 cm grid and a piece parallel to a nearby wall sits flush against it.
 * With `stack` (3D), it lands on top of the piece under it.
 */
export function dragFurnitureTo(drag: FurnitureDrag, centre: Vec2, snap: boolean, stack = false): void {
  const { apply, project } = useEditor.getState();
  const floor = project.floors.find((f) => f.id === drag.floorId);
  const piece = floor?.furniture.find((f) => f.id === drag.id);
  if (!floor || !piece) return;
  let to = snap ? snapToGrid(centre, FURNITURE_STEP) : centre;
  if (snap) to = snapFlushToWall(floor.walls, { ...piece, ...to }, WALL_SNAP) ?? to;
  const ignore = drag.riders.map((r) => r.id);
  const elevation = stack
    ? dropElevation(floor.furniture, { ...piece, elevation: drag.elevation }, to, drag.wasStacked, ignore)
    : drag.elevation;
  const dx = to.x - drag.start.x;
  const dy = to.y - drag.start.y;
  const dz = elevation - drag.elevation;
  apply((d) => {
    updateFurniture(d, drag.floorId, drag.id, { x: to.x, y: to.y, elevation });
    for (const r of drag.riders) {
      updateFurniture(d, drag.floorId, r.id, { x: r.start.x + dx, y: r.start.y + dy, elevation: r.elevation + dz });
    }
  }, { record: false });
}

/** Turns the selected piece; false when no piece is selected (so the key can do something else). */
export function rotateSelectedFurniture(delta: number): boolean {
  const id = selectedFurnitureId();
  if (!id) return false;
  const { apply, activeFloorId } = useEditor.getState();
  apply((d) => rotateFurniture(d, activeFloorId, id, delta));
  return true;
}

/** Ctrl+D: copies the selected piece and selects the copy. */
export function duplicateSelectedFurniture(): boolean {
  const id = selectedFurnitureId();
  if (!id) return false;
  const { apply, activeFloorId, select } = useEditor.getState();
  let copy: string | null = null;
  apply((d) => {
    copy = duplicateFurniture(d, activeFloorId, id);
  });
  if (copy) select({ kind: 'furniture', id: copy });
  return copy !== null;
}

/** Pieces copied with Ctrl+C (kept as they were then), the floor they came from and how many times pasted. */
let clipboard: { pieces: Furniture[]; floorId: string; pasted: number } | null = null;

/** Ctrl+C: remembers the selected piece, or the pieces of a box selection. */
export function copySelectedFurniture(): boolean {
  const { project, activeFloorId, selection, group } = useEditor.getState();
  const floor = project.floors.find((f) => f.id === activeFloorId);
  const ids = new Set([selection, ...group].filter((x) => x?.kind === 'furniture').map((x) => x!.id));
  const pieces = floor?.furniture.filter((f) => ids.has(f.id)) ?? [];
  if (!pieces.length) return false;
  clipboard = { pieces: structuredClone(pieces), floorId: activeFloorId, pasted: 0 };
  notify({ kind: 'ok', text: pieces.length === 1 ? 'Mueble copiado: Ctrl+V para pegarlo' : `${pieces.length} muebles copiados: Ctrl+V para pegarlos` });
  return true;
}

/**
 * Ctrl+V: pastes a copy of what was copied, 30 cm further down and right each time on the same floor (so copies
 * don't pile up), or in the same spot on another floor. The copies end up selected.
 */
export function pasteFurniture(): boolean {
  if (!clipboard) return false;
  const clip = clipboard;
  const { apply, activeFloorId, select, selectGroup } = useEditor.getState();
  const step = activeFloorId === clip.floorId ? 0.3 * (clip.pasted + 1) : 0;
  const ids: string[] = [];
  apply((d) => {
    for (const { id: _old, ...rest } of clip.pieces) {
      void _old;
      ids.push(addFurniture(d, activeFloorId, { ...structuredClone(rest), x: rest.x + step, y: rest.y + step }));
    }
  });
  clip.pasted++;
  if (ids.length === 1) select({ kind: 'furniture', id: ids[0] });
  else selectGroup(ids.map((id) => ({ kind: 'furniture' as const, id })));
  return true;
}

/** Deletes the selected piece right away and offers Deshacer. */
export function removeSelectedFurniture(): boolean {
  const id = selectedFurnitureId();
  if (!id) return false;
  const { apply, activeFloorId, select } = useEditor.getState();
  apply((d) => deleteFurniture(d, activeFloorId, id));
  select(null);
  notify({ kind: 'info', text: 'Mueble eliminado', action: { label: 'Deshacer', run: () => useEditor.getState().undo() } });
  return true;
}
