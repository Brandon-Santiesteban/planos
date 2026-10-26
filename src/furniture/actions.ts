// Store-level furniture actions shared by the 2D tools, the 3D view, the panels and the shortcuts.
import { snapToGrid } from '../geometry/snap';
import {
  deleteFurniture, duplicateFurniture, moveFurniture, rotateFurniture, snapFlushToWall,
} from '../model/furnitureOps';
import type { Vec2 } from '../model/types';
import { useEditor } from '../store/editorStore';
import { notify } from '../ui/toasts';

/** Positions snap to this step unless Alt is held. */
export const FURNITURE_STEP = 0.05;
/** A piece closer than this to a wall sits flush against it. */
export const WALL_SNAP = 0.15;

function activeFloor() {
  const s = useEditor.getState();
  return s.project.floors.find((f) => f.id === s.activeFloorId) ?? s.project.floors[0];
}

function selectedFurnitureId(): string | null {
  const sel = useEditor.getState().selection;
  return sel?.kind === 'furniture' ? sel.id : null;
}

/**
 * Moves a piece during a drag (no history entry: call `checkpoint()` once when the drag starts).
 * With `snap`, the centre goes to the 5 cm grid and a piece parallel to a nearby wall sits flush against it.
 */
export function dragFurnitureTo(id: string, centre: Vec2, snap: boolean): void {
  const { apply, activeFloorId } = useEditor.getState();
  const floor = activeFloor();
  const piece = floor.furniture.find((f) => f.id === id);
  if (!piece) return;
  let to = snap ? snapToGrid(centre, FURNITURE_STEP) : centre;
  if (snap) to = snapFlushToWall(floor.walls, { ...piece, ...to }, WALL_SNAP) ?? to;
  apply((d) => moveFurniture(d, activeFloorId, id, to), { record: false });
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
