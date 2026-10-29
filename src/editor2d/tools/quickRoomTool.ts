import { create } from 'zustand';
import { DEFAULTS } from '../../model/defaults';
import { addRectRoom } from '../../model/ops';
import { placeQuickRoom, quickRoomOutline } from '../../model/quickRoom';
import type { Vec2 } from '../../model/types';
import { formatMetres } from '../../model/units';
import { useEditor } from '../../store/editorStore';
import { useGrid } from '../gridSettings';
import type { ToolContext, ToolHandler, ToolPreview } from './index';
import { activeFloor } from './index';

/** Interior size of the next quick room, in metres. */
export const useQuickRoom = create<{ width: number; depth: number; name: string }>()(() => ({ width: 3, depth: 4, name: '' }));

const SNAP_PX = 20;
const T = DEFAULTS.wallThickness;

/** Ready-made rectangular room that follows the pointer; click to place it, R to turn it. */
export function createQuickRoomTool(): ToolHandler {
  let origin: Vec2 | null = null;

  function place(p: Vec2, ctx: ToolContext): Vec2 {
    const { width, depth } = useQuickRoom.getState();
    const proposed = { x: p.x - (width + T) / 2, y: p.y - (depth + T) / 2 };
    const snap = ctx.state.snapping && !ctx.altKey;
    const grid = useGrid.getState();
    return placeQuickRoom(proposed, width, depth, T, activeFloor(ctx.state).walls, {
      radius: snap ? SNAP_PX / ctx.view.pxPerMetre : 0,
      gridStep: snap && grid.visible ? grid.step : null,
    });
  }

  return {
    onPointerMove(p, ctx) {
      origin = place(p, ctx);
    },
    onPointerDown(p, ctx) {
      origin = place(p, ctx);
      const at = origin;
      const { width, depth, name: typed } = useQuickRoom.getState();
      const { apply, activeFloorId, select } = useEditor.getState();
      const name = typed.trim() || `Habitación ${activeFloor(useEditor.getState()).rooms.length + 1}`;
      let id: string | null = null;
      apply((d) => {
        id = addRectRoom(d, activeFloorId, at, width, depth, name);
      });
      if (id) select({ kind: 'room', id });
      // Each name is for one room: the next one asks for its own.
      if (typed) useQuickRoom.setState({ name: '' });
    },
    onKey(key) {
      if (key.toLowerCase() !== 'r') return false;
      const { width, depth } = useQuickRoom.getState();
      useQuickRoom.setState({ width: depth, depth: width });
      return true;
    },
    preview(): ToolPreview | null {
      if (!origin) return null;
      const { width, depth } = useQuickRoom.getState();
      const { corners, interior } = quickRoomOutline(origin, width, depth, T);
      return {
        kind: 'quickRoom',
        corners,
        interior,
        thickness: T,
        label: `${formatMetres(width).replace(' m', '')} × ${formatMetres(depth)}`,
      };
    },
    reset() {
      origin = null;
    },
  };
}
