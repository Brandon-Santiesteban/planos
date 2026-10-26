import { calibratedMetresPerPixel } from '../../background/calibrate';
import { add, dist, scale, sub } from '../../geometry/vec';
import { updateBackground } from '../../model/ops';
import { parseLength } from '../../model/units';
import type { Vec2 } from '../../model/types';
import { useEditor } from '../../store/editorStore';
import type { ToolHandler, ToolPreview } from './index';
import { activeFloor } from './index';

const LENGTH_CHAR = /^[0-9.,cm ]$/;

/** Click two points on the background image, type their real distance, press Enter. */
export function createCalibrateTool(): ToolHandler {
  let a: Vec2 | null = null;
  let b: Vec2 | null = null;
  let cursor: Vec2 | null = null;
  let typed = '';

  const reset = () => {
    a = b = cursor = null;
    typed = '';
  };

  function apply() {
    const real = parseLength(typed);
    if (!a || !b || real === null) return;
    const measured = dist(a, b);
    const state = useEditor.getState();
    const bg = activeFloor(state).background;
    if (!bg || measured < 1e-6) return;
    const mpp = calibratedMetresPerPixel(bg.metresPerPixel, measured, real);
    const pixel = scale(sub(a, bg.origin), 1 / bg.metresPerPixel);
    const origin = sub(a, scale(pixel, mpp));
    state.apply((d) => updateBackground(d, state.activeFloorId, { metresPerPixel: mpp, origin }));
    reset();
    state.setTool('select');
  }

  return {
    onPointerDown(p) {
      if (!a || b) {
        a = p;
        b = null;
        typed = '';
      } else {
        b = p;
      }
      cursor = p;
    },
    onPointerMove(p) {
      cursor = p;
    },
    onKey(key) {
      if (key === 'Escape') {
        const busy = a !== null;
        reset();
        return busy;
      }
      if (!b) return false;
      if (key === 'Enter') {
        apply();
        return true;
      }
      if (key === 'Backspace') {
        typed = typed.slice(0, -1);
        return true;
      }
      if (LENGTH_CHAR.test(key)) {
        typed += key;
        return true;
      }
      return false;
    },
    preview(): ToolPreview | null {
      if (!a) return null;
      const end = b ?? cursor ?? a;
      return { kind: 'wall', a, b: end, length: dist(a, end), typed: b ? typed || ' ' : '', typedValid: typed === '' || parseLength(typed) !== null };
    },
    reset,
  };
}

/** Drag anywhere to move the background image of the active floor. */
export function createMoveBackgroundTool(): ToolHandler {
  let last: Vec2 | null = null;
  return {
    onPointerDown(p) {
      if (!activeFloor(useEditor.getState()).background) return;
      last = p;
      useEditor.getState().checkpoint();
    },
    onPointerMove(p) {
      if (!last) return;
      const state = useEditor.getState();
      const bg = activeFloor(state).background;
      if (!bg) return;
      const delta = sub(p, last);
      last = p;
      state.apply((d) => updateBackground(d, state.activeFloorId, { origin: add(bg.origin, delta) }), { record: false });
    },
    onPointerUp() {
      last = null;
    },
    preview: () => null,
    reset() {
      last = null;
    },
  };
}
