import { createEmptyProject } from '../model/defaults';
import { addWall } from '../model/ops';
import type { ToolContext } from '../editor2d/tools';
import type { View } from '../editor2d/viewport';
import { useEditor } from '../store/editorStore';
import { createPlaceFurnitureTool, usePlacement } from './placeTool';

const view: View = { centre: { x: 0, y: 0 }, pxPerMetre: 100 };
const ctx = (over: Partial<ToolContext> = {}): ToolContext => ({ state: useEditor.getState(), view, altKey: false, shiftKey: false, ...over });
const s = () => useEditor.getState();
const pieces = () => s().project.floors[0].furniture;

beforeEach(() => {
  s().loadProject(createEmptyProject());
  s().apply((d) => void addWall(d, d.floors[0].id, { x: 0, y: 0 }, { x: 4, y: 0 }));
  usePlacement.setState({ itemId: null, rotation: 0, ghost: null });
});

test('without a chosen piece nothing happens', () => {
  const t = createPlaceFurnitureTool();
  t.onPointerMove!({ x: 2, y: 2 }, ctx());
  t.onPointerDown!({ x: 2, y: 2 }, ctx());
  expect(usePlacement.getState().ghost).toBeNull();
  expect(pieces()).toHaveLength(0);
});

test('the ghost follows the pointer and a click places the piece', () => {
  usePlacement.setState({ itemId: 'escritorio' });
  const t = createPlaceFurnitureTool();
  t.onPointerMove!({ x: 2.013, y: 2.026 }, ctx());
  expect(usePlacement.getState().ghost).toEqual({ x: 2.01, y: 2.03, rotation: 0 });
  t.onPointerDown!({ x: 2.013, y: 2.026 }, ctx());
  expect(pieces()).toHaveLength(1);
  expect(pieces()[0]).toMatchObject({ type: 'escritorio', x: 2.01, y: 2.03, rotation: 0, elevation: 0 });
  s().undo();
  expect(pieces()).toHaveLength(0);
});

test('R turns the ghost', () => {
  usePlacement.setState({ itemId: 'escritorio' });
  const t = createPlaceFurnitureTool();
  expect(t.onKey!('r', ctx())).toBe(true);
  t.onPointerMove!({ x: 2, y: 2 }, ctx());
  expect(usePlacement.getState().ghost!.rotation).toBe(90);
});

test('near a wall the ghost sits flush with its back to it', () => {
  usePlacement.setState({ itemId: 'escritorio' }); // 0.70 deep; the wall face is at y = 0.075
  const t = createPlaceFurnitureTool();
  t.onPointerMove!({ x: 2, y: 0.5 }, ctx());
  const g = usePlacement.getState().ghost!;
  expect(g.rotation).toBe(0);
  expect(g.y).toBeCloseTo(0.425);
});

test('a monitor placed over a desk sits on it', () => {
  usePlacement.setState({ itemId: 'escritorio' });
  const t = createPlaceFurnitureTool();
  t.onPointerDown!({ x: 2, y: 2 }, ctx());
  s().apply((d) => void (d.floors[0].furniture[0].height = 0.8));
  usePlacement.setState({ itemId: 'monitor' });
  t.onPointerDown!({ x: 2, y: 2 }, ctx());
  expect(pieces()[1].elevation).toBeCloseTo(0.8);
});
