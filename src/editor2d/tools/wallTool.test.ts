import { wallLength } from '../../geometry/walls';
import { createEmptyProject } from '../../model/defaults';
import { useEditor } from '../../store/editorStore';
import type { View } from '../viewport';
import type { ToolContext } from './index';
import { createWallTool } from './wallTool';

const view: View = { centre: { x: 0, y: 0 }, pxPerMetre: 100 };
const ctx = (extra: Partial<ToolContext> = {}): ToolContext => ({
  state: useEditor.getState(), view, altKey: false, shiftKey: false, ...extra,
});
const walls = () => useEditor.getState().project.floors[0].walls;
const type = (t: ReturnType<typeof createWallTool>, text: string) => {
  for (const ch of text) t.onKey!(ch, ctx());
};

beforeEach(() => useEditor.getState().loadProject(createEmptyProject()));

test('two clicks create a wall', () => {
  const t = createWallTool();
  t.onPointerDown!({ x: 0, y: 0 }, ctx());
  t.onPointerDown!({ x: 4, y: 0 }, ctx());
  expect(walls()).toHaveLength(1);
  expect(wallLength(walls()[0])).toBeCloseTo(4);
});

test('walls chain from the previous end', () => {
  const t = createWallTool();
  t.onPointerDown!({ x: 0, y: 0 }, ctx());
  t.onPointerDown!({ x: 4, y: 0 }, ctx());
  t.onPointerDown!({ x: 4, y: 3 }, ctx());
  expect(walls()).toHaveLength(2);
  expect(walls()[1].a).toEqual({ x: 4, y: 0 });
});

test('typed length creates a wall in the cursor direction', () => {
  const t = createWallTool();
  t.onPointerDown!({ x: 0, y: 0 }, ctx());
  t.onPointerMove!({ x: 2, y: 0.01 }, ctx());
  type(t, '3,5');
  t.onKey!('Enter', ctx());
  expect(walls()).toHaveLength(1);
  expect(wallLength(walls()[0])).toBeCloseTo(3.5);
  expect(walls()[0].b.y).toBeCloseTo(0, 2);
});

test('invalid typed length creates nothing', () => {
  const t = createWallTool();
  t.onPointerDown!({ x: 0, y: 0 }, ctx());
  t.onPointerMove!({ x: 2, y: 0 }, ctx());
  type(t, '3,,5');
  t.onKey!('Enter', ctx());
  expect(walls()).toHaveLength(0);
  const pv = t.preview();
  expect(pv?.kind === 'wall' && pv.typedValid).toBe(false);
});

test('letters are not captured as a length', () => {
  const t = createWallTool();
  t.onPointerDown!({ x: 0, y: 0 }, ctx());
  expect(t.onKey!('a', ctx())).toBe(false);
  t.onKey!('Enter', ctx());
  expect(walls()).toHaveLength(0);
});

test('clicking the same point twice creates nothing', () => {
  const t = createWallTool();
  t.onPointerDown!({ x: 1, y: 1 }, ctx());
  t.onPointerDown!({ x: 1, y: 1 }, ctx());
  expect(walls()).toHaveLength(0);
});

test('Escape ends the chain', () => {
  const t = createWallTool();
  t.onPointerDown!({ x: 0, y: 0 }, ctx());
  t.onKey!('Escape', ctx());
  expect(t.preview()).toBeNull();
  t.onPointerDown!({ x: 4, y: 0 }, ctx());
  expect(walls()).toHaveLength(0);
});

test('snaps the end to a nearby existing endpoint', () => {
  const t = createWallTool();
  t.onPointerDown!({ x: 0, y: 0 }, ctx());
  t.onPointerDown!({ x: 4, y: 0 }, ctx());
  t.onKey!('Escape', ctx());
  t.onPointerDown!({ x: 4.03, y: 3 }, ctx());
  t.onPointerDown!({ x: 4.04, y: 0.05 }, ctx()); // within 12 px of (4, 0)
  expect(walls()[1].b).toEqual({ x: 4, y: 0 });
});

test('points land on the visible grid nodes, diagonals included', () => {
  const t = createWallTool(); // 100 px/m → 0.5 m grid
  t.onPointerDown!({ x: 0.2, y: 0.1 }, ctx());
  t.onPointerDown!({ x: 3.3, y: 2.2 }, ctx());
  expect(walls()[0].a).toEqual({ x: 0, y: 0 });
  expect(walls()[0].b).toEqual({ x: 3.5, y: 2 });
});

test('before the first click the tool shows the grid node it will use', () => {
  const t = createWallTool();
  t.onPointerMove!({ x: 1.2, y: 0.9 }, ctx());
  expect(t.preview()).toEqual({ kind: 'marker', at: { x: 1, y: 1 } });
});

test('Shift locks the angle to 45° steps', () => {
  const t = createWallTool();
  t.onPointerDown!({ x: 0, y: 0 }, ctx());
  t.onPointerDown!({ x: 3, y: 0.4 }, ctx({ shiftKey: true, altKey: true }));
  expect(walls()[0].b.y).toBeCloseTo(0);
});
