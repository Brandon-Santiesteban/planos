import { createEmptyProject } from '../../model/defaults';
import { setBackground } from '../../model/ops';
import { useEditor } from '../../store/editorStore';
import type { View } from '../viewport';
import { createCalibrateTool } from './calibrateTool';
import type { ToolContext } from './index';

const view: View = { centre: { x: 0, y: 0 }, pxPerMetre: 100 };
const ctx = (): ToolContext => ({ state: useEditor.getState(), view, altKey: false, shiftKey: false });
const s = () => useEditor.getState();
const bg = () => s().project.floors[0].background!;

beforeEach(() => {
  s().loadProject(createEmptyProject());
  s().apply((d) =>
    setBackground(d, d.floors[0].id, {
      dataUrl: 'data:image/png;base64,AAAA', origin: { x: 0, y: 0 }, metresPerPixel: 0.01, opacity: 0.5, widthPx: 1000, heightPx: 800,
    }),
  );
});

function measure(t: ReturnType<typeof createCalibrateTool>, text: string) {
  t.onPointerDown!({ x: 1, y: 1 }, ctx());
  t.onPointerDown!({ x: 3, y: 1 }, ctx());
  for (const ch of text) t.onKey!(ch, ctx());
  t.onKey!('Enter', ctx());
}

test('calibrating scales the image and keeps the first point fixed', () => {
  const t = createCalibrateTool();
  measure(t, '4');
  expect(bg().metresPerPixel).toBeCloseTo(0.02);
  // world (1,1) was image pixel (100,100); it must still be at world (1,1)
  expect(bg().origin.x + 100 * bg().metresPerPixel).toBeCloseTo(1);
  expect(bg().origin.y + 100 * bg().metresPerPixel).toBeCloseTo(1);
});

test('an invalid real length changes nothing', () => {
  const t = createCalibrateTool();
  measure(t, '0');
  expect(bg().metresPerPixel).toBe(0.01);
  expect(bg().origin).toEqual({ x: 0, y: 0 });
});

test('calibration is one undo step', () => {
  const t = createCalibrateTool();
  measure(t, '4');
  s().undo();
  expect(bg().metresPerPixel).toBe(0.01);
});
