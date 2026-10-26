import { createEmptyProject } from '../model/defaults';
import { addFloor, addRoom, setRoomKind } from '../model/ops';
import { MAX_ROOM_LIGHTS, outdoorLights, roomLights } from './roomLights';

const sq = (x: number, y: number, s = 3) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }];

test('one warm ceiling light per room, 25 cm under the ceiling, centred', () => {
  const p = createEmptyProject();
  const g = p.floors[0].id;
  addRoom(p, g, sq(0, 0), 'Sala');
  const up = addFloor(p);
  addRoom(p, up, sq(0, 0, 4), 'Oficina');
  const lights = roomLights(p, p.floors.map((f) => f.id));
  expect(lights).toHaveLength(2);
  expect(lights[0]).toMatchObject({ x: 1.5, z: 1.5 });
  expect(lights[0].y).toBeCloseTo(2.35);
  expect(lights[1].y).toBeCloseTo(2.6 + 2.35);
});

test('balconies and hidden floors get no ceiling light', () => {
  const p = createEmptyProject();
  const g = p.floors[0].id;
  const b = addRoom(p, g, sq(0, 0), 'Balcón')!;
  setRoomKind(p, g, b, 'balcony');
  const up = addFloor(p);
  addRoom(p, up, sq(0, 0), 'Oficina');
  expect(roomLights(p, [g])).toEqual([]);
});

test('the number of lights is capped so the 3D view stays smooth', () => {
  const p = createEmptyProject();
  const g = p.floors[0].id;
  for (let i = 0; i < 30; i++) addRoom(p, g, sq(i * 4, 0), `R${i}`);
  expect(roomLights(p, [g])).toHaveLength(MAX_ROOM_LIGHTS);
});

test('outdoor areas (balconies, fenced garden) get warm ambient lights at their open corners', () => {
  const p = createEmptyProject();
  const g = p.floors[0].id;
  const id = addRoom(p, g, [{ x: 0, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 4.2 }, { x: 0, y: 4.2 }], 'Antejardín')!;
  setRoomKind(p, g, id, 'balcony');
  const lights = outdoorLights(p, [g]);
  // one soffit light in the middle plus a garden post at each corner
  expect(lights.filter((l) => l.kind === 'soffit')).toHaveLength(1);
  expect(lights.filter((l) => l.kind === 'post')).toHaveLength(4);
  const soffit = lights.find((l) => l.kind === 'soffit')!;
  expect(soffit.x).toBeCloseTo(2);
  expect(soffit.z).toBeCloseTo(3.6);
});

test('upper balconies get a soffit light but no garden posts', () => {
  const p = createEmptyProject();
  const up = addFloor(p);
  const id = addRoom(p, up, sq(0, 0), 'Balcón')!;
  setRoomKind(p, up, id, 'balcony');
  const lights = outdoorLights(p, [p.floors[0].id, up]);
  expect(lights.map((l) => l.kind)).toEqual(['soffit']);
});

test('roofs (cubiertas) get no lights of their own', () => {
  const p = createEmptyProject();
  const g = p.floors[0].id;
  const id = addRoom(p, g, sq(0, 0), 'Techo patio')!;
  setRoomKind(p, g, id, 'roof');
  expect(roomLights(p, [g])).toEqual([]);
  expect(outdoorLights(p, [g])).toEqual([]);
});

test('outdoor ground zones (sidewalk, street, green strip) get no lights', () => {
  const p = createEmptyProject();
  const g = p.floors[0].id;
  const id = addRoom(p, g, sq(0, 10, 6), 'Calle')!;
  setRoomKind(p, g, id, 'exterior');
  expect(roomLights(p, [g])).toEqual([]);
  expect(outdoorLights(p, [g])).toEqual([]);
});
