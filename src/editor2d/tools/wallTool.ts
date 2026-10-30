import { snapAngle } from '../../geometry/snap';
import { add, dist, normalize, scale, sub } from '../../geometry/vec';
import { addWall } from '../../model/ops';
import { parseLength } from '../../model/units';
import type { Vec2 } from '../../model/types';
import { useEditor } from '../../store/editorStore';
import { create } from 'zustand';
import type { ToolContext, ToolHandler, ToolPreview } from './index';
import { snapForTool } from './index';

/** Kind of the walls the wall tool draws (chosen in the side panel while the tool is active). */
export const useWallKind = create<{ kind: 'mamposteria' | 'drywall' }>()(() => ({ kind: 'mamposteria' }));

const LENGTH_START = /^[0-9.,]$/;
const LENGTH_CHAR = /^[0-9.,cm ]$/;

export function createWallTool(): ToolHandler {
  let start: Vec2 | null = null;
  let cursor: Vec2 | null = null;
  let typed = '';

  function target(p: Vec2, ctx: ToolContext): Vec2 {
    let q = snapForTool(p, ctx).point;
    if (start && ctx.shiftKey) q = snapAngle(start, q, 45);
    return q;
  }

  function commit(end: Vec2) {
    if (!start) return;
    const from = start;
    const { activeFloorId, apply } = useEditor.getState();
    let created = false;
    apply((d) => {
      created = addWall(d, activeFloorId, from, end, undefined, useWallKind.getState().kind === 'drywall' ? 'drywall' : undefined) !== null;
    });
    if (created) start = end;
    typed = '';
  }

  return {
    onPointerDown(p, ctx) {
      const q = target(p, ctx);
      if (!start) {
        start = q;
        cursor = q;
        return;
      }
      commit(q);
    },
    onPointerMove(p, ctx) {
      cursor = target(p, ctx);
    },
    onDoubleClick() {
      this.reset();
    },
    onKey(key) {
      if (key === 'Escape') {
        const busy = start !== null;
        this.reset();
        return busy;
      }
      if (!start) return false;
      if (key === 'Enter') {
        const length = parseLength(typed);
        if (length !== null && cursor && dist(start, cursor) > 1e-9) {
          commit(add(start, scale(normalize(sub(cursor, start)), length)));
        }
        return true;
      }
      if (key === 'Backspace') {
        typed = typed.slice(0, -1);
        return true;
      }
      if ((typed === '' ? LENGTH_START : LENGTH_CHAR).test(key)) {
        typed += key;
        return true;
      }
      return false;
    },
    preview(): ToolPreview | null {
      if (!cursor) return null;
      if (!start) return { kind: 'marker', at: cursor };
      return {
        kind: 'wall',
        a: start,
        b: cursor,
        length: dist(start, cursor),
        typed,
        typedValid: typed === '' || parseLength(typed) !== null,
      };
    },
    reset() {
      start = null;
      cursor = null;
      typed = '';
    },
  };
}
