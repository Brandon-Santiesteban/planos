import { createEmptyProject } from '../model/defaults';
import { addWall, moveWallEndpoint } from '../model/ops';
import { useEditor } from './editorStore';

const s = () => useEditor.getState();
const floorId = () => s().activeFloorId;
const walls = () => s().project.floors[0].walls;

beforeEach(() => s().loadProject(createEmptyProject()));

test('apply then undo then redo', () => {
  s().apply((d) => void addWall(d, floorId(), { x: 0, y: 0 }, { x: 4, y: 0 }));
  expect(walls()).toHaveLength(1);
  expect(s().dirty).toBe(true);
  s().undo();
  expect(walls()).toHaveLength(0);
  s().redo();
  expect(walls()).toHaveLength(1);
});

test('a drag gesture undoes in one step', () => {
  s().apply((d) => void addWall(d, floorId(), { x: 0, y: 0 }, { x: 4, y: 0 }));
  const id = walls()[0].id;
  s().checkpoint();
  for (const x of [5, 6, 7]) s().apply((d) => moveWallEndpoint(d, floorId(), id, 'b', { x, y: 0 }), { record: false });
  expect(walls()[0].b.x).toBe(7);
  s().undo();
  expect(walls()[0].b.x).toBe(4);
});

test('loadProject clears history', () => {
  s().apply((d) => void addWall(d, floorId(), { x: 0, y: 0 }, { x: 4, y: 0 }));
  s().loadProject(createEmptyProject());
  expect(s().past).toHaveLength(0);
  expect(s().dirty).toBe(false);
});

test('undo clears a selection whose target vanished', () => {
  s().apply((d) => void addWall(d, floorId(), { x: 0, y: 0 }, { x: 4, y: 0 }));
  s().select({ kind: 'wall', id: walls()[0].id });
  s().undo();
  expect(s().selection).toBeNull();
});

test('setActiveFloor ignores unknown ids', () => {
  const before = floorId();
  s().setActiveFloor('nope');
  expect(floorId()).toBe(before);
});

test('undo with empty history is a no-op', () => {
  s().undo();
  s().redo();
  expect(walls()).toHaveLength(0);
});
