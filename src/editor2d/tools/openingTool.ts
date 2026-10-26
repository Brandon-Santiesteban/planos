import { add, normalize, scale, sub } from '../../geometry/vec';
import { fitOpening, projectOntoWall, wallLength } from '../../geometry/walls';
import { DEFAULTS } from '../../model/defaults';
import { addOpening } from '../../model/ops';
import type { OpeningKind, Vec2, Wall } from '../../model/types';
import { useEditor } from '../../store/editorStore';
import type { ToolContext, ToolHandler, ToolPreview } from './index';
import { activeFloor } from './index';

const MAX_DISTANCE = 0.3;

type Target = { wall: Wall; offset: number | null; at: Vec2 };

export function createOpeningTool(kind: OpeningKind): ToolHandler {
  let hover: Target | null = null;

  function find(p: Vec2, ctx: ToolContext): Target | null {
    const floor = activeFloor(ctx.state);
    let best: { wall: Wall; offset: number; distance: number } | null = null;
    for (const w of floor.walls) {
      const r = projectOntoWall(w, p);
      if (r.distance <= MAX_DISTANCE && (!best || r.distance < best.distance)) best = { wall: w, ...r };
    }
    if (!best) return null;
    let raw = best.offset;
    if (ctx.state.snapping && !ctx.altKey) raw = Math.round(raw / DEFAULTS.gridStep) * DEFAULTS.gridStep;
    const others = floor.openings.filter((o) => o.wallId === best.wall.id);
    const offset = fitOpening(wallLength(best.wall), raw, DEFAULTS[kind].width, others);
    const d = normalize(sub(best.wall.b, best.wall.a));
    return { wall: best.wall, offset, at: add(best.wall.a, scale(d, offset ?? best.offset)) };
  }

  return {
    onPointerMove(p, ctx) {
      hover = find(p, ctx);
    },
    onPointerDown(p, ctx) {
      const t = find(p, ctx);
      hover = t;
      if (!t || t.offset === null) return;
      const { apply, activeFloorId, select } = useEditor.getState();
      let id: string | null = null;
      apply((d) => {
        id = addOpening(d, activeFloorId, t.wall.id, kind, t.offset!);
      });
      if (id) select({ kind: 'opening', id });
    },
    onKey(key) {
      if (key !== 'Escape') return false;
      hover = null;
      return true;
    },
    preview(): ToolPreview | null {
      if (!hover) return null;
      const d = normalize(sub(hover.wall.b, hover.wall.a));
      const half = scale(d, DEFAULTS[kind].width / 2);
      return { kind: 'marker', at: hover.at, valid: hover.offset !== null, segment: [sub(hover.at, half), add(hover.at, half)] };
    },
    reset() {
      hover = null;
    },
  };
}
