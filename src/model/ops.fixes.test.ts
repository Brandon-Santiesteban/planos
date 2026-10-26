// Regression tests for the final review findings.
import { createEmptyProject } from './defaults';
import {
  addOpening, addWall, jointsAt, moveWall, setFloorHeight, setJoints, updateWall,
} from './ops';
import type { Project } from './types';

let p: Project;
let f: string;
beforeEach(() => {
  p = createEmptyProject();
  f = p.floors[0].id;
});
const floor = () => p.floors[0];

test('dragging an endpoint over an unrelated endpoint does not capture it', () => {
  const w1 = addWall(p, f, { x: 0, y: 0 }, { x: 2, y: 0 })!;
  addWall(p, f, { x: 3, y: 1 }, { x: 5, y: 1 });
  const joints = jointsAt(floor(), floor().walls[0].b);
  setJoints(p, f, joints, { x: 3, y: 1 });
  setJoints(p, f, joints, { x: 4, y: 2 });
  expect(floor().walls.find((w) => w.id === w1)!.b).toEqual({ x: 4, y: 2 });
  expect(floor().walls[1].a).toEqual({ x: 3, y: 1 });
});

test('dragging a corner onto the neighbour far end is refused', () => {
  addWall(p, f, { x: 0, y: 0 }, { x: 4, y: 0 });
  addWall(p, f, { x: 4, y: 0 }, { x: 4, y: 3 });
  const ok = setJoints(p, f, jointsAt(floor(), { x: 4, y: 0 }), { x: 4, y: 3 });
  expect(ok).toBe(false);
  expect(floor().walls[1].a).toEqual({ x: 4, y: 0 });
});

test('moving a short wall along itself keeps its length and its window', () => {
  const w1 = addWall(p, f, { x: 0, y: 0 }, { x: 0.3, y: 0 })!;
  addWall(p, f, { x: 0.3, y: 0 }, { x: 0.3, y: 2 });
  moveWall(p, f, w1, { x: 0.3, y: 0 });
  expect(floor().walls[0].a).toEqual({ x: 0.3, y: 0 });
  expect(floor().walls[0].b).toEqual({ x: 0.6, y: 0 });
  expect(floor().walls[1].a).toEqual({ x: 0.6, y: 0 });
});

test('a door added to a low wall is shortened to fit', () => {
  const w = addWall(p, f, { x: 0, y: 0 }, { x: 4, y: 0 })!;
  updateWall(p, f, w, { height: 1.5 });
  addOpening(p, f, w, 'door', 2);
  expect(floor().openings[0].height).toBeCloseTo(1.5);
});

test('a window that cannot fit vertically is refused', () => {
  const w = addWall(p, f, { x: 0, y: 0 }, { x: 4, y: 0 })!;
  updateWall(p, f, w, { height: 0.9 });
  expect(addOpening(p, f, w, 'window', 2)).toBeNull();
});

test('lowering a wall below its door is refused', () => {
  const w = addWall(p, f, { x: 0, y: 0 }, { x: 4, y: 0 })!;
  addOpening(p, f, w, 'door', 2);
  expect(updateWall(p, f, w, { height: 1.8 })).toBe(false);
  expect(floor().walls[0].height).toBeNull();
});

test('lowering the floor below a door on a floor-height wall is refused', () => {
  const w = addWall(p, f, { x: 0, y: 0 }, { x: 4, y: 0 })!;
  addOpening(p, f, w, 'door', 2);
  expect(setFloorHeight(p, f, 2)).toBe(false);
  expect(floor().height).toBe(2.6);
  expect(setFloorHeight(p, f, 2.4)).toBe(true);
});
