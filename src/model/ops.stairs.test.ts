import { createEmptyProject } from './defaults';
import { addOpening, addRoom, addWall, setStairShape, toggleDoorFlip } from './ops';

test('a stairs room can be made U-shaped and back', () => {
  const p = createEmptyProject();
  const f = p.floors[0].id;
  const id = addRoom(p, f, [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 3 }], 'Escalera')!;
  setStairShape(p, f, id, 'u');
  expect(p.floors[0].rooms[0].stairShape).toBe('u');
  setStairShape(p, f, id, 'recta');
  expect(p.floors[0].rooms[0].stairShape).toBe('recta');
});

test('a door swing can be flipped to the other side and back', () => {
  const p = createEmptyProject();
  const f = p.floors[0].id;
  const w = addWall(p, f, { x: 0, y: 0 }, { x: 4, y: 0 })!;
  const d = addOpening(p, f, w, 'door', 2)!;
  toggleDoorFlip(p, f, d);
  expect(p.floors[0].openings[0].flip).toBe(true);
  toggleDoorFlip(p, f, d);
  expect(p.floors[0].openings[0].flip).toBe(false);
});
