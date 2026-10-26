import { polygonArea } from '../../geometry/polygons';
import { createEmptyProject } from '../../model/defaults';
import { useEditor } from '../../store/editorStore';
import type { View } from '../viewport';
import type { ToolContext } from './index';
import { createRoomTool } from './roomTool';

const view: View = { centre: { x: 0, y: 0 }, pxPerMetre: 100 };
const ctx = (): ToolContext => ({ state: useEditor.getState(), view, altKey: false, shiftKey: false });
const s = () => useEditor.getState();
const rooms = () => s().project.floors[0].rooms;
const square = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];

beforeEach(() => s().loadProject(createEmptyProject()));

test('clicking back on the first point closes the room', () => {
  const t = createRoomTool();
  for (const p of square) t.onPointerDown!(p, ctx());
  t.onPointerDown!({ x: 0.02, y: 0.01 }, ctx());
  expect(rooms()).toHaveLength(1);
  expect(rooms()[0].name).toBe('Habitación 1');
  expect(polygonArea(rooms()[0].points)).toBeCloseTo(12);
  expect(s().selection).toEqual({ kind: 'room', id: rooms()[0].id });
});

test('Enter closes the room', () => {
  const t = createRoomTool();
  for (const p of square) t.onPointerDown!(p, ctx());
  t.onKey!('Enter', ctx());
  expect(rooms()).toHaveLength(1);
});

test('two points and Enter create nothing', () => {
  const t = createRoomTool();
  t.onPointerDown!(square[0], ctx());
  t.onPointerDown!(square[1], ctx());
  t.onKey!('Enter', ctx());
  expect(rooms()).toHaveLength(0);
});

test('Escape cancels the room', () => {
  const t = createRoomTool();
  for (const p of square) t.onPointerDown!(p, ctx());
  t.onKey!('Escape', ctx());
  expect(t.preview()).toBeNull();
  t.onKey!('Enter', ctx());
  expect(rooms()).toHaveLength(0);
});

test('the next room is numbered', () => {
  const t = createRoomTool();
  for (const p of square) t.onPointerDown!(p, ctx());
  t.onKey!('Enter', ctx());
  for (const p of square) t.onPointerDown!({ x: p.x + 5, y: p.y }, ctx());
  t.onKey!('Enter', ctx());
  expect(rooms()[1].name).toBe('Habitación 2');
});
