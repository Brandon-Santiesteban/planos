import { CATALOG } from './catalog';

test('the catalog has street trees, a shrub and a street lamp for the outdoors', () => {
  const ids = CATALOG.map((c) => c.id);
  for (const id of ['arbol-guayacan', 'arbol-pequeno', 'arbusto', 'poste-alumbrado']) expect(ids).toContain(id);
  const guayacan = CATALOG.find((c) => c.id === 'arbol-guayacan')!;
  expect(guayacan.height).toBeGreaterThanOrEqual(4); // a real tree, several metres tall
  expect(guayacan.category).toBe('Exterior');
});
