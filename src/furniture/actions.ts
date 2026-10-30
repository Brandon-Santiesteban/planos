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

/** Copied furniture travels through the system clipboard as text starting with this, so it survives a reload. */
const CLIP_PREFIX = 'casa-muebles:';

/** The last clipboard text pasted and how many times, so repeated pastes don't pile up. */
let lastPaste: { text: string; count: number } | null = null;

/** Ctrl+C: the selected piece, or the pieces of a box selection, as clipboard text (null if no piece is selected). */
export function copySelectedFurniture(): string | null {
  const { project, activeFloorId, selection, group } = useEditor.getState();
  const floor = project.floors.find((f) => f.id === activeFloorId);
  const ids = new Set([selection, ...group].filter((x) => x?.kind === 'furniture').map((x) => x!.id));
  const pieces = floor?.furniture.filter((f) => ids.has(f.id)) ?? [];
  if (!pieces.length) return null;
  lastPaste = null;
  return CLIP_PREFIX + JSON.stringify({ floorId: activeFloorId, pieces });
}

/**
 * Ctrl+V: pastes the furniture in clipboard text, 30 cm further down and right each time on the same floor (so
 * copies don't pile up), or in the same spot on another floor. The copies end up selected. False if the text holds
 * no furniture.
 */
export function pasteFurniture(text: string): boolean {
  if (!text.startsWith(CLIP_PREFIX)) return false;
  let clip: { floorId: string; pieces: Furniture[] };
  try {
    clip = JSON.parse(text.slice(CLIP_PREFIX.length));
  } catch {
    return false;
  }
  if (!Array.isArray(clip.pieces) || !clip.pieces.length) return false;
  const count = lastPaste?.text === text ? lastPaste.count + 1 : 1;
  const { apply, activeFloorId, select, selectGroup } = useEditor.getState();
  const step = activeFloorId === clip.floorId ? 0.3 * count : 0;
  const ids: string[] = [];
  apply((d) => {
    for (const { id: _old, ...rest } of clip.pieces) {
      void _old;
      ids.push(addFurniture(d, activeFloorId, { ...rest, x: rest.x + step, y: rest.y + step }));
    }
  });
  lastPaste = { text, count };
  if (ids.length === 1) select({ kind: 'furniture', id: ids[0] });
  else selectGroup(ids.map((id) => ({ kind: 'furniture' as const, id })));
  return true;
}

/**
 * Ctrl+C / Ctrl+V on the page through the browser's own copy and paste events (they also come from the Edit menu
 * and work over any link). Text fields keep their normal copy and paste.
 */
export function startFurnitureClipboard(): () => void {
  const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  const onCopy = (e: ClipboardEvent) => {
    if (typing(e.target) || typing(document.activeElement)) return;
    const text = copySelectedFurniture();
    if (!text) {
      if (!window.getSelection()?.toString()) notify({ kind: 'info', text: 'Selecciona un mueble para copiarlo' });
      return;
    }
    e.clipboardData?.setData('text/plain', text);
    e.preventDefault();
    const n = (JSON.parse(text.slice(CLIP_PREFIX.length)) as { pieces: unknown[] }).pieces.length;
    notify({ kind: 'ok', text: n === 1 ? 'Mueble copiado: Ctrl+V para pegarlo' : `${n} muebles copiados: Ctrl+V para pegarlos` });
  };
  const onPaste = (e: ClipboardEvent) => {
    if (typing(e.target) || typing(document.activeElement)) return;
    e.preventDefault();
    if (!pasteFurniture(e.clipboardData?.getData('text/plain') ?? '')) notify({ kind: 'info', text: 'Primero copia un mueble con Ctrl+C' });
  };
  document.addEventListener('copy', onCopy);
  document.addEventListener('paste', onPaste);
  return () => {
    document.removeEventListener('copy', onCopy);
    document.removeEventListener('paste', onPaste);
  };
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
