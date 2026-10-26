import { CATALOG } from './catalog';

test('the catalog has street trees, a shrub and a street lamp for the outdoors', () => {
  const ids = CATALOG.map((c) => c.id);
  for (const id of ['arbol-guayacan', 'arbol-pequeno', 'arbusto', 'poste-alumbrado']) expect(ids).toContain(id);
  const guayacan = CATALOG.find((c) => c.id === 'arbol-guayacan')!;
  expect(guayacan.height).toBeGreaterThanOrEqual(4); // a real tree, several metres tall
  expect(guayacan.category).toBe('Exterior');
});

const rgb = (hex: string) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));

test('tree foliage is a natural green; the guayacán only has sparse muted yellow flowers', () => {
  for (const id of ['arbol-guayacan', 'arbol-pequeno', 'arbusto']) {
    const [r, g, b] = rgb(CATALOG.find((c) => c.id === id)!.color);
    expect(g, id).toBeGreaterThan(r);
    expect(g, id).toBeGreaterThan(b);
    expect(g, id).toBeLessThan(170); // not a neon green
  }
  const [r, g, b] = rgb(CATALOG.find((c) => c.id === 'arbol-guayacan')!.flowers!);
  expect(r).toBeGreaterThan(b + 60); // yellow…
  expect(r).toBeLessThan(230); // …but muted
  expect(g).toBeGreaterThan(b);
});
