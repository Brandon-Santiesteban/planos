import { createEmptyProject } from '../model/defaults';
import { addOpening, addRoom, addWall } from '../model/ops';
import { hitTest } from './hitTest';

function setup() {
  const p = createEmptyProject();
  const f = p.floors[0].id;
  const w = addWall(p, f, { x: 0, y: 0 }, { x: 4, y: 0 })!;
  const o = addOpening(p, f, w, 'door', 0.5)!;
  const r = addRoom(p, f, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }], 'Sala')!;
  return { floor: p.floors[0], w, o, r };
}

test('endpoint wins over the opening near it', () => {
  const { floor, w } = setup();
  expect(hitTest(floor, { x: 0.02, y: 0.01 }, 0.1)).toEqual({ kind: 'endpoint', wallId: w, end: 'a' });
});
test('opening wins over its wall', () => {
  const { floor, o } = setup();
  expect(hitTest(floor, { x: 0.6, y: 0.02 }, 0.05)).toEqual({ kind: 'opening', id: o });
});
test('wall body is hit', () => {
  const { floor, w } = setup();
  expect(hitTest(floor, { x: 2.5, y: 0.05 }, 0.05)).toEqual({ kind: 'wall', id: w });
});
test('room interior is hit', () => {
  const { floor, r } = setup();
  expect(hitTest(floor, { x: 2, y: 1.5 }, 0.05)).toEqual({ kind: 'room', id: r });
});
test('empty space hits nothing', () => {
  const { floor } = setup();
  expect(hitTest(floor, { x: 10, y: 10 }, 0.05)).toBeNull();
});
