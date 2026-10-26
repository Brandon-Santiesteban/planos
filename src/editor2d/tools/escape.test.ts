import { createEmptyProject } from '../../model/defaults';
import { useEditor } from '../../store/editorStore';
import type { View } from '../viewport';
import { createCalibrateTool } from './calibrateTool';
import type { ToolContext } from './index';
import { createOpeningTool } from './openingTool';
import { createRoomTool } from './roomTool';
import { createWallTool } from './wallTool';

const view: View = { centre: { x: 0, y: 0 }, pxPerMetre: 100 };
const ctx = (): ToolContext => ({ state: useEditor.getState(), view, altKey: false, shiftKey: false });
beforeEach(() => useEditor.getState().loadProject(createEmptyProject()));

test.each([
  ['wall', createWallTool],
  ['room', createRoomTool],
  ['door', () => createOpeningTool('door')],
  ['calibrate', createCalibrateTool],
])('%s tool lets Escape through when idle', (_name, make) => {
  expect(make().onKey!('Escape', ctx())).toBe(false);
});

test('wall tool still consumes Escape while drawing', () => {
  const t = createWallTool();
  t.onPointerDown!({ x: 0, y: 0 }, ctx());
  expect(t.onKey!('Escape', ctx())).toBe(true);
});
