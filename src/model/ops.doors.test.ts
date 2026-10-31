import { createEmptyProject } from './defaults';
import { addOpening, addWall, setDoorGlass, setDoorMirror } from './ops';
import { parseProject, serializeProject } from '../persistence/projectFile';

test('a door is a sliding mirror door or a glass door, not both, and the mirror survives saving', () => {
  const p = createEmptyProject();
  const f = p.floors[0].id;
  const w = addWall(p, f, { x: 0, y: 0 }, { x: 4, y: 0 })!;
  const id = addOpening(p, f, w, 'door', 2)!;
  setDoorMirror(p, f, id, true);
  const door = () => p.floors[0].openings[0];
  expect(door()).toMatchObject({ mirror: true });
  setDoorGlass(p, f, id, true);
  expect(door().glass).toBe(true);
  expect(door().mirror).toBeUndefined();
  setDoorMirror(p, f, id, true);
  expect(door().glass).toBeUndefined();
  const r = parseProject(serializeProject(p));
  expect(r.ok && r.project.floors[0].openings[0].mirror).toBe(true);
});
