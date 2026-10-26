import { create } from 'zustand';
import { snapToGrid } from '../geometry/snap';
import { addFurniture, furnitureFromCatalog, normalizeRotation, snapToWalls, stackElevation } from '../model/furnitureOps';
import { useEditor } from '../store/editorStore';
import { activeFloor, type ToolContext, type ToolHandler } from '../editor2d/tools';
import type { Vec2 } from '../model/types';
import { FURNITURE_STEP, WALL_SNAP } from './actions';
import { type Category, catalogItem } from './catalog';

export interface Ghost { x: number; y: number; rotation: number }

/** Muebles tool state: the chosen catalog piece, its extra turn (R) and the ghost under the pointer. */
export const usePlacement = create<{
  itemId: string | null;
  rotation: number;
  ghost: Ghost | null;
  category: Category | null;
  query: string;
}>()(() => ({ itemId: null, rotation: 0, ghost: null, category: null, query: '' }));

function ghostAt(p: Vec2, ctx: ToolContext): Ghost | null {
  const { itemId, rotation } = usePlacement.getState();
  const item = itemId ? catalogItem(itemId) : undefined;
  if (!item) return null;
  const snap = ctx.state.snapping && !ctx.altKey;
  const at = snap ? snapToGrid(p, FURNITURE_STEP) : p;
  if (snap) {
    const s = snapToWalls(activeFloor(ctx.state).walls, at, item.width, item.depth, rotation, WALL_SNAP);
    if (s) return s;
  }
  return { x: at.x, y: at.y, rotation: normalizeRotation(rotation) };
}

/** Choose a piece in the catalog panel; a ghost follows the pointer, click places it, R turns it. */
export function createPlaceFurnitureTool(): ToolHandler {
  let last: Vec2 | null = null;
  return {
    onPointerMove(p, ctx) {
      last = p;
      usePlacement.setState({ ghost: ghostAt(p, ctx) });
    },
    onPointerDown(p, ctx) {
      const g = ghostAt(p, ctx);
      const { itemId } = usePlacement.getState();
      const item = itemId ? catalogItem(itemId) : undefined;
      if (!g || !item) return;
      const { apply, activeFloorId } = useEditor.getState();
      const below = item.onTop ? stackElevation(activeFloor(useEditor.getState()).furniture, g, null) : null;
      apply((d) => {
        const init = furnitureFromCatalog(item.id, g, g.rotation);
        addFurniture(d, activeFloorId, { ...init, elevation: below ?? init.elevation });
      });
      usePlacement.setState({ ghost: g });
    },
    onKey(key, ctx) {
      if (key.toLowerCase() !== 'r' || !usePlacement.getState().itemId) return false;
      usePlacement.setState((s) => ({ rotation: normalizeRotation(s.rotation + (ctx.shiftKey ? -90 : 90)) }));
      if (last) usePlacement.setState({ ghost: ghostAt(last, ctx) });
      return true;
    },
    preview: () => null,
    reset() {
      last = null;
      usePlacement.setState({ ghost: null });
    },
  };
}
