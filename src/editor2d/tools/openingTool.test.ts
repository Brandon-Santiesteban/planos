import { createEmptyProject } from '../../model/defaults';
import { addWall } from '../../model/ops';
import { useEditor } from '../../store/editorStore';
import type { View } from '../viewport';
import type { ToolContext } from './index';
import { createOpeningTool } from './openingTool';

const view: View = { centre: { x: 0, y: 0 }, pxPerMetre: 100 };
const ctx = (): ToolContext => ({ state: useEditor.getState(), view, altKey: false, shiftKey: false });
const s = () => useEditor.getState();
const openings = () => s().project.floors[0].openings;

beforeEach(() => {
  s().loadProject(createEmptyProject());
  s().apply((d) => {
    addWall(d, d.floors[0].id, { x: 0, y: 0 }, { x: 4, y: 0 });
    addWall(d, d.floors[0].id, { x: 0, y: 2 }, { x: 0.6, y: 2 });
  });
});

test('clicking near a wall adds a door there', () => {
  const t = createOpeningTool('door');
  t.onPointerDown!({ x: 2, y: 0.1 }, ctx());
  expect(openings()).toHaveLength(1);
  expect(openings()[0]).toMatchObject({ kind: 'door', width: 0.8 });
  expect(openings()[0].offset).toBeCloseTo(2);
});

test('clicking far from every wall adds nothing', () => {
  const t = createOpeningTool('door');
  t.onPointerDown!({ x: 2, y: 1 }, ctx());
  expect(openings()).toHaveLength(0);
});

test('a door does not fit in a 0.6 m wall', () => {
  const t = createOpeningTool('door');
  t.onPointerMove!({ x: 0.3, y: 2 }, ctx());
  const pv = t.preview();
  expect(pv?.kind === 'marker' && pv.valid).toBe(false);
  t.onPointerDown!({ x: 0.3, y: 2 }, ctx());
  expect(openings()).toHaveLength(0);
});

test('window tool adds a window with window defaults', () => {
  const t = createOpeningTool('window');
  t.onPointerDown!({ x: 1, y: -0.05 }, ctx());
  expect(openings()[0]).toMatchObject({ kind: 'window', width: 1.2, sill: 0.9 });
});
