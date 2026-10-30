import { createEmptyProject } from '../model/defaults';
import { addFurniture, furnitureFromCatalog } from '../model/furnitureOps';
import { addFloor, addOpening, addRoom, addWall } from '../model/ops';
import { hitTest } from '../editor2d/hitTest';
import { createSelectTool } from '../editor2d/tools/selectTool';
import type { ToolContext } from '../editor2d/tools';
import type { View } from '../editor2d/viewport';
import { useEditor } from '../store/editorStore';
import { copySelectedFurniture, duplicateSelectedFurniture, pasteFurniture } from './actions';

const view: View = { centre: { x: 0, y: 0 }, pxPerMetre: 100 };
const ctx = (over: Partial<ToolContext> = {}): ToolContext => ({ state: useEditor.getState(), view, altKey: false, shiftKey: false, ...over });
const s = () => useEditor.getState();
const pieces = () => s().project.floors[0].furniture;

let deskId = '';
beforeEach(() => {
  s().loadProject(createEmptyProject());
  s().apply((d) => {
    const f = d.floors[0].id;
    const w = addWall(d, f, { x: 0, y: 0 }, { x: 4, y: 0 })!;
    addOpening(d, f, w, 'door', 3);
    addRoom(d, f, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }], 'Oficina');
    deskId = addFurniture(d, f, furnitureFromCatalog('escritorio', { x: 1, y: 1.5 })); // 1.4 × 0.7
  });
});

test('furniture is hit above the room and below walls', () => {
  const floor = s().project.floors[0];
  expect(hitTest(floor, { x: 1.5, y: 1.6 }, 0.05)).toEqual({ kind: 'furniture', id: deskId });
  expect(hitTest(floor, { x: 3, y: 2.5 }, 0.05)).toEqual({ kind: 'room', id: floor.rooms[0].id });
  expect(hitTest(floor, { x: 2, y: 0.02 }, 0.05)?.kind).toBe('wall');
});

test('a monitor on the desk is picked before the desk', () => {
  let mon = '';
  s().apply((d) => void (mon = addFurniture(d, d.floors[0].id, furnitureFromCatalog('monitor', { x: 1, y: 1.4 }))));
  expect(hitTest(s().project.floors[0], { x: 1, y: 1.4 }, 0.05)).toEqual({ kind: 'furniture', id: mon });
});

test('dragging a piece snaps to 5 cm and undoes in one step', () => {
  const t = createSelectTool();
  t.onPointerDown!({ x: 1, y: 1.5 }, ctx());
  expect(s().selection).toEqual({ kind: 'furniture', id: deskId });
  t.onPointerMove!({ x: 1.5, y: 1.5 }, ctx());
  t.onPointerMove!({ x: 2.012, y: 2.031 }, ctx());
  t.onPointerUp!({ x: 2.012, y: 2.031 }, ctx());
  expect(pieces()[0].x).toBeCloseTo(2);
  expect(pieces()[0].y).toBeCloseTo(2.05);
  s().undo();
  expect(pieces()[0]).toMatchObject({ x: 1, y: 1.5 });
});

test('dragging a desk carries the monitor on it', () => {
  s().apply((d) => void addFurniture(d, d.floors[0].id, furnitureFromCatalog('monitor', { x: 1.3, y: 1.4 })));
  const t = createSelectTool();
  t.onPointerDown!({ x: 0.6, y: 1.6 }, ctx());
  t.onPointerMove!({ x: 1.6, y: 2.1 }, ctx());
  t.onPointerUp!({ x: 1.6, y: 2.1 }, ctx());
  expect(pieces()[0]).toMatchObject({ x: 2, y: 2 });
  expect(pieces()[1].x).toBeCloseTo(2.3);
  expect(pieces()[1].y).toBeCloseTo(1.9);
  expect(pieces()[1].elevation).toBeCloseTo(0.75);
});

test('Alt drags freely', () => {
  const t = createSelectTool();
  t.onPointerDown!({ x: 1, y: 1.5 }, ctx({ altKey: true }));
  t.onPointerMove!({ x: 2.012, y: 2.031 }, ctx({ altKey: true }));
  t.onPointerUp!({ x: 2.012, y: 2.031 }, ctx({ altKey: true }));
  expect(pieces()[0].x).toBeCloseTo(2.012);
  expect(pieces()[0].y).toBeCloseTo(2.031);
});

test('R and Shift+R turn the selected piece; Delete removes it', () => {
  const t = createSelectTool();
  s().select({ kind: 'furniture', id: deskId });
  expect(t.onKey!('r', ctx())).toBe(true);
  expect(pieces()[0].rotation).toBe(90);
  expect(t.onKey!('R', ctx({ shiftKey: true }))).toBe(true);
  expect(t.onKey!('R', ctx({ shiftKey: true }))).toBe(true);
  expect(pieces()[0].rotation).toBe(270);
  expect(t.onKey!('Delete', ctx())).toBe(true);
  expect(pieces()).toHaveLength(0);
  expect(s().selection).toBeNull();
});

test('R without a selected piece is left for the shortcuts', () => {
  const t = createSelectTool();
  expect(t.onKey!('r', ctx())).toBe(false);
});

test('Ctrl+D duplicates the selected piece and selects the copy', () => {
  s().select({ kind: 'furniture', id: deskId });
  expect(duplicateSelectedFurniture()).toBe(true);
  expect(pieces()).toHaveLength(2);
  expect(s().selection).toEqual({ kind: 'furniture', id: pieces()[1].id });
  s().select(null);
  expect(duplicateSelectedFurniture()).toBe(false);
});

test('Ctrl+C then Ctrl+V pastes copies 30 cm apart each time, and on another floor in the same spot', () => {
  s().select({ kind: 'furniture', id: deskId });
  expect(copySelectedFurniture()).toBe(true);
  s().select(null);
  expect(pasteFurniture()).toBe(true);
  expect(pasteFurniture()).toBe(true);
  expect(pieces().map((p) => [p.x, p.y])).toEqual([[1, 1.5], [1.3, 1.8], [1.6, 2.1]]);
  expect(s().selection).toEqual({ kind: 'furniture', id: pieces()[2].id });
  let f2 = '';
  s().apply((d) => void (f2 = addFloor(d)));
  s().setActiveFloor(f2);
  pasteFurniture();
  expect(s().project.floors[1].furniture.map((p) => [p.x, p.y])).toEqual([[1, 1.5]]);
});

test('Ctrl+C with no piece selected copies nothing', () => {
  s().select(null);
  expect(copySelectedFurniture()).toBe(false);
});

test('a furniture selection survives undo only while the piece exists', () => {
  s().select({ kind: 'furniture', id: deskId });
  s().undo(); // back to the empty project
  expect(s().selection).toBeNull();
});
