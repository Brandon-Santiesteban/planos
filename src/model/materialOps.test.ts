import { createEmptyProject } from './defaults';
import { applySideToFacade, setFloorMaterial, setRailing, setRailingColor, setWallSide } from './materialOps';
import { addRoom, addWall } from './ops';
import type { Project } from './types';

let p: Project;
let f: string;
beforeEach(() => {
  p = createEmptyProject();
  f = p.floors[0].id;
});
const floor = () => p.floors[0];

test('setWallSide merges a patch into one face only', () => {
  const id = addWall(p, f, { x: 0, y: 0 }, { x: 4, y: 0 })!;
  setWallSide(p, f, id, 'left', { finish: 'ladrillo' });
  setWallSide(p, f, id, 'left', { color: '#B5653F' });
  expect(floor().walls[0].sides).toEqual({ left: { finish: 'ladrillo', color: '#B5653F' } });
  setWallSide(p, f, id, 'right', { color: '#EDE6D6' });
  expect(floor().walls[0].sides?.right).toEqual({ color: '#EDE6D6' });
  expect(floor().walls[0].sides?.left?.finish).toBe('ladrillo');
});

test('setWallSide refuses an invalid colour and normalises a valid one', () => {
  const id = addWall(p, f, { x: 0, y: 0 }, { x: 4, y: 0 })!;
  expect(setWallSide(p, f, id, 'left', { color: 'rojo' })).toBe(false);
  expect(floor().walls[0].sides).toBeUndefined();
  expect(setWallSide(p, f, id, 'left', { color: 'abc' })).toBe(true);
  expect(floor().walls[0].sides?.left?.color).toBe('#AABBCC');
});

test('setFloorMaterial and setRailing', () => {
  const r = addRoom(p, f, [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }, { x: 0, y: 3 }], 'Sala')!;
  setFloorMaterial(p, f, r, 'porcelanato');
  setRailing(p, f, r, 'celosia');
  expect(floor().rooms[0]).toMatchObject({ floorMaterial: 'porcelanato', railing: 'celosia' });
});

test('applySideToFacade sets every outside face of the floor and leaves inside faces alone', () => {
  // A 4 × 3 room closed by four walls drawn clockwise in plan, plus an inner partition.
  const pts = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
  const ids = pts.map((a, i) => addWall(p, f, a, pts[(i + 1) % 4])!);
  addRoom(p, f, pts, 'Sala');
  const n = applySideToFacade(p, f, { finish: 'piedra', color: '#D8C7A6' });
  expect(n).toBe(4);
  for (const id of ids) {
    const w = floor().walls.find((x) => x.id === id)!;
    // a→b goes clockwise on screen (y down), so +perp points inside: the outside face is `right`.
    expect(w.sides?.right).toEqual({ finish: 'piedra', color: '#D8C7A6' });
    expect(w.sides?.left).toBeUndefined();
  }
});

test('setRailingColor normalises the colour and refuses an invalid one', () => {
  const r = addRoom(p, f, [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }], 'Balcón')!;
  expect(setRailingColor(p, f, r, '1e1e1e')).toBe(true);
  expect(floor().rooms[0].railingColor).toBe('#1E1E1E');
  expect(setRailingColor(p, f, r, 'negro')).toBe(false);
  expect(floor().rooms[0].railingColor).toBe('#1E1E1E');
});
