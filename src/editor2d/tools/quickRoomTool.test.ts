import { polygonArea } from '../../geometry/polygons';
import { createEmptyProject } from '../../model/defaults';
import { useEditor } from '../../store/editorStore';
import { useGrid } from '../gridSettings';
import type { View } from '../viewport';
import type { ToolContext } from './index';
import { createQuickRoomTool, useQuickRoom } from './quickRoomTool';

const view: View = { centre: { x: 0, y: 0 }, pxPerMetre: 100 };
const ctx = (): ToolContext => ({ state: useEditor.getState(), view, altKey: false, shiftKey: false });
const floor = () => useEditor.getState().project.floors[0];

beforeEach(() => {
  useEditor.getState().loadProject(createEmptyProject());
  useGrid.setState({ visible: true, step: 0.5 });
  useQuickRoom.setState({ width: 3, depth: 4 });
});

test('a click places a room of the chosen interior size, centred on the pointer', () => {
  const t = createQuickRoomTool();
  t.onPointerMove!({ x: 5, y: 5 }, ctx());
  t.onPointerDown!({ x: 5, y: 5 }, ctx());
  expect(floor().walls).toHaveLength(4);
  expect(polygonArea(floor().rooms[0].points)).toBeCloseTo(12);
  expect(floor().rooms[0].name).toBe('Habitación 1');
  expect(useEditor.getState().selection).toEqual({ kind: 'room', id: floor().rooms[0].id });
});

test('R turns the room 90°', () => {
  const t = createQuickRoomTool();
  expect(t.onKey!('r', ctx())).toBe(true);
  expect(useQuickRoom.getState()).toMatchObject({ width: 4, depth: 3 });
});

test('a second room placed next to the first shares the wall', () => {
  const t = createQuickRoomTool();
  t.onPointerDown!({ x: 1.575, y: 2.075 }, ctx()); // origin (0, 0)
  t.onPointerDown!({ x: 4.85, y: 2.1 }, ctx()); // lands ~0.1 m off the shared line → snaps flush
  expect(floor().rooms).toHaveLength(2);
  expect(floor().walls).toHaveLength(7);
});

test('the preview shows the outline and the size', () => {
  const t = createQuickRoomTool();
  t.onPointerMove!({ x: 5, y: 5 }, ctx());
  const pv = t.preview();
  expect(pv?.kind).toBe('quickRoom');
  if (pv?.kind === 'quickRoom') expect(pv.label).toBe('3,00 × 4,00 m');
});

test('Escape is left for the global shortcut', () => {
  expect(createQuickRoomTool().onKey!('Escape', ctx())).toBe(false);
});
