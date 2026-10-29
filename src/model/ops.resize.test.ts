import { createEmptyProject } from './defaults';
import { addRectRoom, rectRoomSize, resizeRectRoom, translateJoints, wallJoints } from './ops';

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
