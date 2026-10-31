import { alongAxis, snapToGrid, straighten } from '../../geometry/snap';
import { dist, sub } from '../../geometry/vec';
import { projectOntoWall } from '../../geometry/walls';
import { deleteFurniture } from '../../model/furnitureOps';
import {
  deleteItems, deleteOpening, deleteRoom, deleteWall, type Joint, jointsAt, prepareWallDrag, setJoints, tidyRoomOutlines,
  translateJoints, updateOpening, wallJoints,
} from '../../model/ops';
import type { Floor, Vec2 } from '../../model/types';
import { beginFurnitureDrag, dragFurnitureTo, type FurnitureDrag, rotateSelectedFurniture } from '../../furniture/actions';
import { type Item, useEditor } from '../../store/editorStore';
import { notify } from '../../ui/toasts';
import { hitTest } from '../hitTest';
import type { ToolContext, ToolHandler } from './index';
import { activeFloor, MOVE_STEP, snapForTool } from './index';

const HIT_PX = 8;
const DRAG_START_PX = 3;

type Drag =
  | { kind: 'endpoint'; wallId: string; end: 'a' | 'b'; joints: Joint[] }
  | { kind: 'wall'; wallId: string; applied: Vec2; joints: Joint[]; prepared?: ReturnType<typeof prepareWallDrag> }
  | { kind: 'opening'; openingId: string; wallId: string }
  | { kind: 'furniture'; drag: FurnitureDrag }
  | { kind: 'box'; roomId: string | null; to: Vec2 };

/** Everything of the floor lying wholly inside the box a–b. */
export function itemsInBox(floor: Floor, a: Vec2, b: Vec2): Item[] {
  const [x0, x1, y0, y1] = [Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.y, b.y), Math.max(a.y, b.y)];
  const inside = (q: Vec2) => q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1;
  const items: Item[] = [];
  for (const w of floor.walls) if (inside(w.a) && inside(w.b)) items.push({ kind: 'wall', id: w.id });
  for (const o of floor.openings) {
    const w = floor.walls.find((x) => x.id === o.wallId);
    if (!w) continue;
    const len = dist(w.a, w.b) || 1;
    const t = o.offset / len;
    if (inside({ x: w.a.x + (w.b.x - w.a.x) * t, y: w.a.y + (w.b.y - w.a.y) * t })) items.push({ kind: 'opening', id: o.id });
  }
  for (const r of floor.rooms) if (r.points.every(inside)) items.push({ kind: 'room', id: r.id });
  for (const f of floor.furniture) if (inside(f)) items.push({ kind: 'furniture', id: f.id });
  return items;
}

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
      // On empty ground or inside a room, dragging draws a selection box; a plain click selects the room.
      if (!hit || hit.kind === 'room') {
        drag = { kind: 'box', roomId: hit ? hit.id : null, to: p };
        return;
      }
      if (hit.kind === 'endpoint') {
        select({ kind: 'wall', id: hit.wallId });
        const w = floor.walls.find((x) => x.id === hit.wallId)!;
        drag = { kind: 'endpoint', wallId: hit.wallId, end: hit.end, joints: jointsAt(floor, w[hit.end]) };
      } else if (hit.kind === 'wall') {
        select({ kind: 'wall', id: hit.id });
        drag = { kind: 'wall', wallId: hit.id, applied: { x: 0, y: 0 }, joints: wallJoints(floor, hit.id) };
      } else if (hit.kind === 'opening') {
        select({ kind: 'opening', id: hit.id });
        const o = floor.openings.find((x) => x.id === hit.id)!;
        drag = { kind: 'opening', openingId: hit.id, wallId: o.wallId };
      } else if (hit.kind === 'furniture') {
        select({ kind: 'furniture', id: hit.id });
        const fd = beginFurnitureDrag(hit.id);
        drag = fd && { kind: 'furniture', drag: fd };
      }
    },

    onPointerMove(p, ctx: ToolContext) {
      if (!drag || !downAt) return;
      const store = useEditor.getState();
      if (drag.kind === 'box') {
        drag.to = p;
        started ||= dist(p, downAt) * ctx.view.pxPerMetre >= DRAG_START_PX;
        return;
      }
      if (!started) {
        if (dist(p, downAt) * ctx.view.pxPerMetre < DRAG_START_PX) return;
        store.checkpoint();
        started = true;
        const d = drag;
        if (d.kind === 'wall') {
          const floorId = store.activeFloorId;
          store.apply((draft) => { d.prepared = prepareWallDrag(draft, floorId, d.joints); }, { record: false });
        }
      }
      const floorId = store.activeFloorId;
      const floor = activeFloor(store);
      const d = drag;
      if (d.kind === 'furniture') {
        const s0 = d.drag.start;
        const by = sub(p, downAt);
        const move = ctx.shiftKey ? alongAxis(by) : by;
        dragFurnitureTo(d.drag, { x: s0.x + move.x, y: s0.y + move.y }, ctx.state.snapping && !ctx.altKey);
      } else if (d.kind === 'endpoint') {
        const wall = floor.walls.find((w) => w.id === d.wallId);
        if (!wall) return;
        const snapped = snapForTool(p, ctx, [], wall[d.end], MOVE_STEP);
        // The wall stays straight (Shift: in steps of 45°), unless the end lands on another wall's corner.
        const other = wall[d.end === 'a' ? 'b' : 'a'];
        const to = snapped.kind === 'endpoint' && !ctx.shiftKey ? snapped.point : straighten(other, snapped.point, ctx.shiftKey);
        store.apply((draft) => void setJoints(draft, floorId, d.joints, to), { record: false });
      } else if (d.kind === 'wall') {
        let total = sub(p, downAt);
        if (ctx.shiftKey) total = alongAxis(total); // Shift: only sideways or only up and down
        if (ctx.state.snapping && !ctx.altKey) total = snapToGrid(total, MOVE_STEP);
        const step = sub(total, d.applied);
        if (step.x === 0 && step.y === 0) return;
        let moved = false;
        store.apply((draft) => {
          moved = translateJoints(draft, floorId, d.joints, step, d.prepared);
        }, { record: false });
        if (moved) d.applied = total;
      } else {
        const wall = floor.walls.find((w) => w.id === d.wallId);
        if (!wall) return;
        let offset = projectOntoWall(wall, p).offset;
        if (ctx.state.snapping && !ctx.altKey) offset = Math.round(offset / MOVE_STEP) * MOVE_STEP;
        store.apply((draft) => void updateOpening(draft, floorId, d.openingId, { offset }), { record: false });
      }
    },

    onPointerUp(p, ctx) {
      if (drag?.kind === 'wall' && started) {
        const floorId = ctx.state.activeFloorId;
        useEditor.getState().apply((draft) => tidyRoomOutlines(draft, floorId), { record: false });
      }
      if (drag?.kind === 'box' && downAt) {
        const { select, selectGroup } = useEditor.getState();
        if (started) selectGroup(itemsInBox(activeFloor(ctx.state), downAt, p));
        else select(drag.roomId ? { kind: 'room', id: drag.roomId } : null);
      }
      drag = null;
      downAt = null;
      started = false;
    },

    onKey(key, ctx) {
      if (key.toLowerCase() === 'r') return rotateSelectedFurniture(ctx.shiftKey ? -90 : 90);
      if (key !== 'Delete' && key !== 'Backspace') return false;
      const { selection, group, activeFloorId, apply, select } = useEditor.getState();
      if (group.length) {
        apply((d) => deleteItems(d, activeFloorId, group));
        select(null);
        notify({ kind: 'info', text: `${group.length} elementos eliminados`, action: { label: 'Deshacer', run: () => useEditor.getState().undo() } });
        return true;
      }
      if (!selection) return false;
      apply((d) => {
        if (selection.kind === 'wall') deleteWall(d, activeFloorId, selection.id);
        else if (selection.kind === 'opening') deleteOpening(d, activeFloorId, selection.id);
        else if (selection.kind === 'furniture') deleteFurniture(d, activeFloorId, selection.id);
        else deleteRoom(d, activeFloorId, selection.id);
      });
      select(null);
      return true;
    },

    preview: () =>
      drag?.kind === 'box' && started && downAt ? { kind: 'box', a: downAt, b: drag.to } : null,
    reset() {
      drag = null;
      downAt = null;
      started = false;
    },
  };
}
