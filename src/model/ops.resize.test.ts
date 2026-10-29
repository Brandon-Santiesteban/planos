import { createEmptyProject } from './defaults';
import { addRectRoom, addRoom, addWall, rectRoomSize, resizeRectRoom, translateJoints, wallJoints } from './ops';

function setup() {
  const p = createEmptyProject();
  const f = p.floors[0].id;
  const a = addRectRoom(p, f, { x: 0, y: 0 }, 4, 3, 'Sala')!;
  const b = addRectRoom(p, f, { x: 4.15, y: 0 }, 2, 3, 'Baño')!; // shares the wall at x 4,15
  return { p, f, a, b, floor: p.floors[0] };
}

test('a rectangular room reports its inside width and length', () => {
  const { floor, a } = setup();
  const r = floor.rooms.find((x) => x.id === a)!;
  expect(rectRoomSize(r)!.width).toBeCloseTo(4);
  expect(rectRoomSize(r)!.depth).toBeCloseTo(3);
  expect(rectRoomSize({ points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] })).toBeNull();
});

test('dragging a shared wall moves the sides of both rooms with it', () => {
  const { p, f, a, b, floor } = setup();
  const shared = floor.walls.find((w) => Math.abs(w.a.x - w.b.x) < 1e-6 && Math.abs(w.a.x - 4.15) < 0.01)!;
  expect(translateJoints(p, f, wallJoints(floor, shared.id), { x: 0.5, y: 0 })).toBe(true);
  expect(rectRoomSize(floor.rooms.find((x) => x.id === a)!)!.width).toBeCloseTo(4.5);
  expect(rectRoomSize(floor.rooms.find((x) => x.id === b)!)!.width).toBeCloseTo(1.5);
});

test('typing a new width moves the right side and its wall; typing a length moves the bottom', () => {
  const { p, f, b, floor } = setup();
  expect(resizeRectRoom(p, f, b, { width: 3 })).toBe(true);
  const r = floor.rooms.find((x) => x.id === b)!;
  expect(rectRoomSize(r)!.width).toBeCloseTo(3);
  expect(Math.max(...floor.walls.map((w) => Math.max(w.a.x, w.b.x)))).toBeCloseTo(4.15 + 3 + 0.15, 2);
  expect(resizeRectRoom(p, f, b, { depth: 4 })).toBe(true);
  expect(rectRoomSize(r)!.depth).toBeCloseTo(4);
  expect(Math.min(...r.points.map((q) => q.x))).toBeCloseTo(4.15 + 0.075, 2);
});

test('dragging a wall under only part of a room side gives that side a step instead of a diagonal', () => {
  const p = createEmptyProject();
  const f = p.floors[0].id;
  const floor = p.floors[0];
  // A 6 × 6 sala whose bottom side runs along two walls: 1 m over the entrance, 5,15 m over the parking.
  const c = [[0, 0], [6.15, 0], [6.15, 6.15], [1, 6.15], [0, 6.15]].map(([x, y]) => ({ x, y }));
  c.forEach((q, i) => addWall(p, f, q, c[(i + 1) % c.length]));
  const sala = addRoom(p, f, [{ x: 0.075, y: 0.075 }, { x: 6.075, y: 0.075 }, { x: 6.075, y: 6.075 }, { x: 0.075, y: 6.075 }], 'Sala')!;
  const under = floor.walls.find((w) => w.a.y === 6.15 && w.b.y === 6.15 && Math.min(w.a.x, w.b.x) === 1)!;
  expect(translateJoints(p, f, wallJoints(floor, under.id), { x: 0, y: 1 })).toBe(true);
  const r = floor.rooms.find((x) => x.id === sala)!;
  const straight = r.points.every((q, i) => {
    const n = r.points[(i + 1) % r.points.length];
    return Math.abs(q.x - n.x) < 1e-6 || Math.abs(q.y - n.y) < 1e-6;
  });
  expect(straight).toBe(true); // every side horizontal or vertical, none diagonal
  expect(r.points).toHaveLength(6);
  expect(Math.max(...r.points.map((q) => q.y))).toBeCloseTo(7.075);
  // The 1 m wall over the entrance stays put and straight; a short wall makes the step at x 1.
  expect(floor.walls.every((w) => w.a.x === w.b.x || Math.abs(w.a.y - w.b.y) < 1e-9)).toBe(true);
  expect(floor.walls.some((w) => w.a.x === 1 && w.b.x === 1 && Math.abs(Math.abs(w.a.y - w.b.y) - 1) < 1e-9)).toBe(true);
  expect(floor.walls).toHaveLength(6);
});
