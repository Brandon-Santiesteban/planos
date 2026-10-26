import { snapToGrid } from '../../geometry/snap';
import { dist, sub } from '../../geometry/vec';
import { projectOntoWall } from '../../geometry/walls';
import { DEFAULTS } from '../../model/defaults';
import { deleteOpening, deleteRoom, deleteWall, moveWall, moveWallEndpoint, updateOpening } from '../../model/ops';
import type { Vec2 } from '../../model/types';
import { useEditor } from '../../store/editorStore';
import { hitTest } from '../hitTest';
import type { ToolContext, ToolHandler } from './index';
import { activeFloor, snapForTool } from './index';

const HIT_PX = 8;
const DRAG_START_PX = 3;

type Drag =
  | { kind: 'endpoint'; wallId: string; end: 'a' | 'b' }
  | { kind: 'wall'; wallId: string; applied: Vec2 }
  | { kind: 'opening'; openingId: string; wallId: string };

export function createSelectTool(): ToolHandler {
  let drag: Drag | null = null;
  let downAt: Vec2 | null = null;
  let started = false;

  return {
    onPointerDown(p, ctx) {
      const floor = activeFloor(ctx.state);
      const hit = hitTest(floor, p, HIT_PX / ctx.view.pxPerMetre);
      const { select } = useEditor.getState();
      downAt = p;
      started = false;
      drag = null;
      if (!hit) return select(null);
      if (hit.kind === 'endpoint') {
        select({ kind: 'wall', id: hit.wallId });
        drag = { kind: 'endpoint', wallId: hit.wallId, end: hit.end };
      } else if (hit.kind === 'wall') {
        select({ kind: 'wall', id: hit.id });
        drag = { kind: 'wall', wallId: hit.id, applied: { x: 0, y: 0 } };
      } else if (hit.kind === 'opening') {
        select({ kind: 'opening', id: hit.id });
        const o = floor.openings.find((x) => x.id === hit.id)!;
        drag = { kind: 'opening', openingId: hit.id, wallId: o.wallId };
      } else {
        select({ kind: 'room', id: hit.id });
      }
    },

    onPointerMove(p, ctx: ToolContext) {
      if (!drag || !downAt) return;
      const store = useEditor.getState();
      if (!started) {
        if (dist(p, downAt) * ctx.view.pxPerMetre < DRAG_START_PX) return;
        store.checkpoint();
        started = true;
      }
      const floorId = store.activeFloorId;
      const floor = activeFloor(store);
      const d = drag;
      if (d.kind === 'endpoint') {
        const wall = floor.walls.find((w) => w.id === d.wallId);
        if (!wall) return;
        const to = snapForTool(p, ctx, [], wall[d.end]).point;
        store.apply((draft) => moveWallEndpoint(draft, floorId, d.wallId, d.end, to), { record: false });
      } else if (d.kind === 'wall') {
        let total = sub(p, downAt);
        if (ctx.state.snapping && !ctx.altKey) total = snapToGrid(total, DEFAULTS.gridStep);
        const step = sub(total, d.applied);
        if (step.x === 0 && step.y === 0) return;
        store.apply((draft) => moveWall(draft, floorId, d.wallId, step), { record: false });
        d.applied = total;
      } else {
        const wall = floor.walls.find((w) => w.id === d.wallId);
        if (!wall) return;
        let offset = projectOntoWall(wall, p).offset;
        if (ctx.state.snapping && !ctx.altKey) offset = Math.round(offset / DEFAULTS.gridStep) * DEFAULTS.gridStep;
        store.apply((draft) => void updateOpening(draft, floorId, d.openingId, { offset }), { record: false });
      }
    },

    onPointerUp() {
      drag = null;
      downAt = null;
      started = false;
    },

    onKey(key) {
      if (key !== 'Delete' && key !== 'Backspace') return false;
      const { selection, activeFloorId, apply, select } = useEditor.getState();
      if (!selection) return false;
      apply((d) => {
        if (selection.kind === 'wall') deleteWall(d, activeFloorId, selection.id);
        else if (selection.kind === 'opening') deleteOpening(d, activeFloorId, selection.id);
        else deleteRoom(d, activeFloorId, selection.id);
      });
      select(null);
      return true;
    },

    preview: () => null,
    reset() {
      drag = null;
      downAt = null;
      started = false;
    },
  };
}
