import { createEmptyProject } from '../../model/defaults';
import { addOpening, addWall } from '../../model/ops';
import { useEditor } from '../../store/editorStore';
import type { View } from '../viewport';
import type { ToolContext } from './index';
import { createSelectTool } from './selectTool';

const view: View = { centre: { x: 0, y: 0 }, pxPerMetre: 100 };
const ctx = (): ToolContext => ({ state: useEditor.getState(), view, altKey: false, shiftKey: false });
const s = () => useEditor.getState();
const walls = () => s().project.floors[0].walls;

beforeEach(() => {
  s().loadProject(createEmptyProject());
  s().apply((d) => {
    const f = d.floors[0].id;
    const w = addWall(d, f, { x: 0, y: 0 }, { x: 4, y: 0 })!;
    addWall(d, f, { x: 4, y: 0 }, { x: 4, y: 3 });
    addOpening(d, f, w, 'window', 2);
  });
});

test('clicking a wall selects it', () => {
  const t = createSelectTool();
  t.onPointerDown!({ x: 3.2, y: 0.03 }, ctx());
  t.onPointerUp!({ x: 3.2, y: 0.03 }, ctx());
  expect(s().selection).toEqual({ kind: 'wall', id: walls()[0].id });
});

test('clicking empty space clears the selection', () => {
  const t = createSelectTool();
  s().select({ kind: 'wall', id: walls()[0].id });
  t.onPointerDown!({ x: 9, y: 9 }, ctx());
  t.onPointerUp!({ x: 9, y: 9 }, ctx());
  expect(s().selection).toBeNull();
});

test('dragging a box over empty space selects everything inside it, and Supr deletes it all', () => {
  const t = createSelectTool();
  t.onPointerDown!({ x: -1, y: -1 }, ctx());
  t.onPointerMove!({ x: 5, y: 4 }, ctx());
  expect(t.preview()).toEqual({ kind: 'box', a: { x: -1, y: -1 }, b: { x: 5, y: 4 } });
  t.onPointerUp!({ x: 5, y: 4 }, ctx());
  expect(s().group.map((g) => g.kind).sort()).toEqual(['opening', 'wall', 'wall']);
  expect(t.onKey!('Delete', ctx())).toBe(true);
  expect(walls()).toHaveLength(0);
  expect(s().project.floors[0].openings).toHaveLength(0);
  s().undo();
  expect(walls()).toHaveLength(2);
});

test('a box only takes what lies wholly inside it', () => {
  const t = createSelectTool();
  t.onPointerDown!({ x: 3, y: -1 }, ctx());
  t.onPointerMove!({ x: 5, y: 4 }, ctx());
  t.onPointerUp!({ x: 5, y: 4 }, ctx());
  expect(s().selection).toEqual({ kind: 'wall', id: walls()[1].id });
  expect(s().group).toEqual([]);
});

test('dragging a shared corner moves both walls and undoes in one step', () => {
  const t = createSelectTool();
  t.onPointerDown!({ x: 4, y: 0 }, ctx());
  t.onPointerMove!({ x: 4.5, y: 0 }, ctx());
  t.onPointerMove!({ x: 5, y: 1 }, ctx());
  t.onPointerUp!({ x: 5, y: 1 }, ctx());
  expect(walls()[0].b).toEqual({ x: 5, y: 1 });
  expect(walls()[1].a).toEqual({ x: 5, y: 1 });
  s().undo();
  expect(walls()[0].b).toEqual({ x: 4, y: 0 });
  expect(walls()[1].a).toEqual({ x: 4, y: 0 });
});

test('dragging a wall body translates it', () => {
  const t = createSelectTool();
  t.onPointerDown!({ x: 1, y: 0 }, ctx());
  t.onPointerMove!({ x: 1, y: 0.5 }, ctx());
  t.onPointerMove!({ x: 1, y: 1 }, ctx());
  t.onPointerUp!({ x: 1, y: 1 }, ctx());
  expect(walls()[0].a).toEqual({ x: 0, y: 1 });
});

test('a click without movement records no history', () => {
  const t = createSelectTool();
  const before = s().past.length;
  t.onPointerDown!({ x: 1, y: 0 }, ctx());
  t.onPointerUp!({ x: 1, y: 0 }, ctx());
  expect(s().past.length).toBe(before);
});

test('Delete removes the selected wall and its openings', () => {
  const t = createSelectTool();
  s().select({ kind: 'wall', id: walls()[0].id });
  expect(t.onKey!('Delete', ctx())).toBe(true);
  expect(walls()).toHaveLength(1);
  expect(s().project.floors[0].openings).toHaveLength(0);
  expect(s().selection).toBeNull();
});
