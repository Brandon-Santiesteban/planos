import { polygonArea } from '../geometry/polygons';
import { wallLength } from '../geometry/walls';
import { createEmptyProject } from './defaults';
import { addRectRoom } from './ops';
import { placeQuickRoom, quickRoomOutline } from './quickRoom';
import type { Project } from './types';

let p: Project;
let f: string;
beforeEach(() => {
  p = createEmptyProject();
  f = p.floors[0].id;
});
const floor = () => p.floors[0];
const T = 0.15;

test('the outline puts the wall centrelines half a wall outside the interior', () => {
  const o = quickRoomOutline({ x: 0, y: 0 }, 3, 4, T);
  expect(o.corners).toEqual([{ x: 0, y: 0 }, { x: 3.15, y: 0 }, { x: 3.15, y: 4.15 }, { x: 0, y: 4.15 }]);
  expect(o.interior[0]).toEqual({ x: 0.075, y: 0.075 });
  expect(polygonArea(o.interior)).toBeCloseTo(12);
});

test('a quick room adds 4 walls and a room with the exact interior area', () => {
  addRectRoom(p, f, { x: 0, y: 0 }, 3, 4, 'Dormitorio');
  expect(floor().walls).toHaveLength(4);
  expect(floor().rooms[0].name).toBe('Dormitorio');
  expect(polygonArea(floor().rooms[0].points)).toBeCloseTo(12);
});

test('two rooms side by side share one wall', () => {
  addRectRoom(p, f, { x: 0, y: 0 }, 3, 4, 'A');
  addRectRoom(p, f, { x: 3.15, y: 0 }, 3, 4, 'B');
  expect(floor().walls).toHaveLength(7);
  expect(floor().rooms).toHaveLength(2);
});

test('a taller neighbour only adds the part of the shared wall that is missing', () => {
  addRectRoom(p, f, { x: 0, y: 0 }, 3, 4, 'A'); // right wall x=3.15, y 0…4.15
  addRectRoom(p, f, { x: 3.15, y: 0 }, 2, 6, 'B'); // left wall x=3.15, y 0…6.15
  const onShared = floor().walls.filter((w) => Math.abs(w.a.x - 3.15) < 1e-6 && Math.abs(w.b.x - 3.15) < 1e-6);
  const total = onShared.reduce((s, w) => s + wallLength(w), 0);
  expect(total).toBeCloseTo(6.15);
});

test('placing near a room snaps it flush so the wall is shared', () => {
  addRectRoom(p, f, { x: 0, y: 0 }, 3, 4, 'A');
  // cursor puts the new room's left wall at x≈3.3, 15 cm off A's right wall (3.15)
  const origin = placeQuickRoom({ x: 3.3, y: 0.05 }, 3, 4, T, floor().walls, { radius: 0.3, gridStep: null });
  expect(origin.x).toBeCloseTo(3.15);
  expect(origin.y).toBeCloseTo(0);
});

test('far from other rooms it snaps to the grid', () => {
  const origin = placeQuickRoom({ x: 10.2, y: 7.4 }, 3, 4, T, [], { radius: 0.3, gridStep: 0.5 });
  expect(origin).toEqual({ x: 10, y: 7.5 });
});
