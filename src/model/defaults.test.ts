import { createEmptyProject } from './defaults';

test('empty project has one floor called Planta baja', () => {
  const p = createEmptyProject();
  expect(p.version).toBe(1);
  expect(p.floors).toHaveLength(1);
  expect(p.floors[0].name).toBe('Planta baja');
  expect(p.floors[0].height).toBe(2.6);
  expect(p.floors[0].walls).toEqual([]);
  expect(p.floors[0].background).toBeNull();
});
