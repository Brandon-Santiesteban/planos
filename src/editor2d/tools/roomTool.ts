import { dist } from '../../geometry/vec';
import { addRoom } from '../../model/ops';
import type { Vec2 } from '../../model/types';
import { useEditor } from '../../store/editorStore';
import type { ToolContext, ToolHandler, ToolPreview } from './index';
import { activeFloor, SNAP_RADIUS_PX, snapForTool } from './index';

export function createRoomTool(): ToolHandler {
  let points: Vec2[] = [];
  let cursor: Vec2 | null = null;

  function close(ctx?: ToolContext) {
    const state = ctx?.state ?? useEditor.getState();
    const name = `Habitación ${activeFloor(state).rooms.length + 1}`;
    const pts = points;
    const { apply, activeFloorId, select } = useEditor.getState();
    let id: string | null = null;
    apply((d) => {
      id = addRoom(d, activeFloorId, pts, name);
    });
    if (id) select({ kind: 'room', id });
    points = [];
    cursor = null;
  }

  return {
    onPointerDown(p, ctx) {
      const q = snapForTool(p, ctx, points).point;
      if (points.length >= 3 && dist(q, points[0]) <= SNAP_RADIUS_PX / ctx.view.pxPerMetre) {
        close(ctx);
        return;
      }
      if (points.length && dist(q, points[points.length - 1]) < 1e-6) return;
      points.push(q);
      cursor = q;
    },
    onPointerMove(p, ctx) {
      cursor = snapForTool(p, ctx, points).point;
    },
    onDoubleClick(_p, ctx) {
      if (points.length >= 3) close(ctx);
    },
    onKey(key, ctx) {
      if (key === 'Escape') {
        const busy = points.length > 0;
        this.reset();
        return busy;
      }
      if (key === 'Enter' && points.length) {
        close(ctx);
        return true;
      }
      if (key === 'Backspace' && points.length) {
        points.pop();
        return true;
      }
      return false;
    },
    preview(): ToolPreview | null {
      if (!points.length || !cursor) return null;
      return { kind: 'polygon', points, cursor };
    },
    reset() {
      points = [];
      cursor = null;
    },
  };
}
