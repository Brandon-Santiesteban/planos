import { createEmptyProject } from './defaults';
import {
  addFloor, addOpening, addRoom, addWall, deleteFloor, deleteWall, floorElevation, moveWall,
  moveWallEndpoint, setWallLength, updateOpening,
} from './ops';
import type { Project } from './types';

let p: Project;
let f: string;
beforeEach(() => {
  p = createEmptyProject();
  f = p.floors[0].id;
});
const floor = () => p.floors[0];

test('addWall rejects degenerate wall', () => {
  expect(addWall(p, f, { x: 0, y: 0 }, { x: 0.01, y: 0 })).toBeNull();
  expect(addWall(p, f, { x: 1, y: 1 }, { x: 1, y: 1 })).toBeNull();
  expect(floor().walls).toHaveLength(0);
});
test('addWall uses default thickness', () => {
  addWall(p, f, { x: 0, y: 0 }, { x: 4, y: 0 });
  expect(floor().walls[0].thickness).toBe(0.15);
});
test('deleting a wall removes its openings', () => {
  const id = addWall(p, f, { x: 0, y: 0 }, { x: 4, y: 0 })!;
  addOpening(p, f, id, 'door', 2);
  deleteWall(p, f, id);
  expect(floor().openings).toHaveLength(0);
});
test('addOpening uses kind defaults', () => {
  const id = addWall(p, f, { x: 0, y: 0 }, { x: 4, y: 0 })!;
  addOpening(p, f, id, 'window', 2);
  expect(floor().openings[0]).toMatchObject({ width: 1.2, height: 1.2, sill: 0.9, offset: 2 });
});
test('addOpening refuses when it does not fit', () => {
  const id = addWall(p, f, { x: 0, y: 0 }, { x: 0.6, y: 0 })!;
  expect(addOpening(p, f, id, 'door', 0.3)).toBeNull();
});
test('updateOpening refuses a size that does not fit', () => {
  const id = addWall(p, f, { x: 0, y: 0 }, { x: 4, y: 0 })!;
  const o = addOpening(p, f, id, 'door', 2)!;
  expect(updateOpening(p, f, o, { width: 5 })).toBe(false);
  expect(floor().openings[0].width).toBe(0.8);
});
test('moveWallEndpoint drags the connected wall', () => {
  const w1 = addWall(p, f, { x: 0, y: 0 }, { x: 4, y: 0 })!;
  addWall(p, f, { x: 4, y: 0 }, { x: 4, y: 3 });
  moveWallEndpoint(p, f, w1, 'b', { x: 5, y: 0 });
  expect(floor().walls[1].a).toEqual({ x: 5, y: 0 });
});
test('moveWall translates and drags connected endpoints', () => {
  const w1 = addWall(p, f, { x: 0, y: 0 }, { x: 4, y: 0 })!;
  addWall(p, f, { x: 4, y: 0 }, { x: 4, y: 3 });
  moveWall(p, f, w1, { x: 0, y: 1 });
  expect(floor().walls[0].a).toEqual({ x: 0, y: 1 });
  expect(floor().walls[1].a).toEqual({ x: 4, y: 1 });
  expect(floor().walls[1].b).toEqual({ x: 4, y: 3 });
});
test('setWallLength shortens and drops openings that no longer fit', () => {
  const id = addWall(p, f, { x: 0, y: 0 }, { x: 4, y: 0 })!;
  addOpening(p, f, id, 'window', 3.3);
  setWallLength(p, f, id, 3);
  expect(floor().walls[0].b.x).toBeCloseTo(3);
  expect(floor().openings).toHaveLength(1); // re-fitted inside the shorter wall
  setWallLength(p, f, id, 1);
  expect(floor().openings).toHaveLength(0);
});
test('addRoom needs 3 points and real area', () => {
  expect(addRoom(p, f, [{ x: 0, y: 0 }, { x: 1, y: 0 }], 'X')).toBeNull();
  const id = addRoom(p, f, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }], 'Sala');
  expect(id).not.toBeNull();
  expect(floor().rooms[0].kind).toBe('room');
});
test('the only floor cannot be deleted', () => {
  expect(deleteFloor(p, f)).toBe(false);
  expect(p.floors).toHaveLength(1);
});
test('addFloor names floors and stacks elevation', () => {
  addFloor(p);
  const id2 = addFloor(p);
  expect(p.floors.map((fl) => fl.name)).toEqual(['Planta baja', 'Planta 1', 'Planta 2']);
  expect(floorElevation(p, id2)).toBeCloseTo(5.2);
});
test('deleteFloor removes it with its content', () => {
  const id = addFloor(p);
  addWall(p, id, { x: 0, y: 0 }, { x: 4, y: 0 });
  expect(deleteFloor(p, id)).toBe(true);
  expect(p.floors).toHaveLength(1);
});
