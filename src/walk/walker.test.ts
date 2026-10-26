import { createEmptyProject } from '../model/defaults';
import { addFloor, addRoom, addWall, setRoomKind, setStairUp } from '../model/ops';
import type { Project } from '../model/types';
import { blockingSegments } from './physics';
import { look, stepWalker, walkStart, type Walker } from './walker';

let p: Project;
let g: string;
beforeEach(() => {
  p = createEmptyProject();
  g = p.floors[0].id;
});
const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
];
const still = { forward: 0, right: 0, run: false };

test('starts in the middle of the selected room, on its floor', () => {
  const up = addFloor(p);
  addRoom(p, up, rect(0, 0, 2, 2), 'Primera');
  const id = addRoom(p, up, rect(4, 0, 8, 4), 'Elegida')!;
  const w = walkStart(p, up, { kind: 'room', id });
  expect(w.pos.x).toBeCloseTo(6);
  expect(w.pos.y).toBeCloseTo(2);
  expect(w.feet).toBeCloseTo(2.6);
});

test('without a selected room it starts in the first room of the active floor', () => {
  addRoom(p, g, rect(0, 0, 2, 2), 'Primera');
  addRoom(p, g, rect(4, 0, 8, 4), 'Otra');
  const w = walkStart(p, g, null);
  expect(w.pos).toEqual({ x: 1, y: 1 });
  expect(w.feet).toBe(0);
});

test('walks forward at 1,4 m/s, runs at 3 m/s and strafes', () => {
  const w: Walker = { pos: { x: 0, y: 0 }, feet: 0, yaw: 0, pitch: 0 };
  const perFloor = p.floors.map(blockingSegments);
  const a = stepWalker(w, { forward: 1, right: 0, run: false }, 1, p, perFloor);
  expect(a.pos.y).toBeCloseTo(-1.4); // yaw 0 looks towards the top of the plan
  const b = stepWalker(w, { forward: 1, right: 0, run: true }, 1, p, perFloor);
  expect(b.pos.y).toBeCloseTo(-3);
  const c = stepWalker(w, { forward: 0, right: 1, run: false }, 1, p, perFloor);
  expect(c.pos.x).toBeCloseTo(1.4);
  const d = stepWalker(w, { forward: 1, right: 1, run: false }, 1, p, perFloor);
  expect(Math.hypot(d.pos.x, d.pos.y)).toBeCloseTo(1.4); // diagonals aren't faster
  expect(stepWalker(w, still, 1, p, perFloor)).toEqual(w);
});

test('walls stop you', () => {
  addWall(p, g, { x: -5, y: -1 }, { x: 5, y: -1 });
  const w: Walker = { pos: { x: 0, y: 0 }, feet: 0, yaw: 0, pitch: 0 };
  const next = stepWalker(w, { forward: 1, right: 0, run: true }, 1, p, p.floors.map(blockingSegments));
  expect(next.pos.y).toBeGreaterThan(-1);
});

test('walking up a stairs room climbs to the next floor', () => {
  addFloor(p);
  const s = addRoom(p, g, rect(0, 0, 1, 3), 'Escalera')!;
  setRoomKind(p, g, s, 'stairs');
  setStairUp(p, g, s, 'n');
  let w: Walker = { pos: { x: 0.5, y: 3.5 }, feet: 0, yaw: 0, pitch: 0 };
  const perFloor = p.floors.map(blockingSegments);
  for (let i = 0; i < 60; i++) w = stepWalker(w, { forward: 1, right: 0, run: false }, 1 / 20, p, perFloor);
  expect(w.feet).toBeCloseTo(2.6, 1);
});

test('looking turns left/right and up/down, never past straight up or down', () => {
  const w: Walker = { pos: { x: 0, y: 0 }, feet: 0, yaw: 0, pitch: 0 };
  expect(look(w, 100, 0).yaw).toBeLessThan(0); // mouse right turns right
  expect(look(w, 0, -100).pitch).toBeGreaterThan(0); // mouse up looks up
  expect(look(w, 0, -100000).pitch).toBeLessThan(Math.PI / 2);
});
