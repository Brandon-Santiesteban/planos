import { CATALOG, CATEGORIES, catalogItem, searchCatalog } from './catalog';

test('every item has a unique id, a known category and real sizes', () => {
  const ids = new Set(CATALOG.map((i) => i.id));
  expect(ids.size).toBe(CATALOG.length);
  expect(CATALOG.length).toBeGreaterThanOrEqual(40);
  for (const i of CATALOG) {
    expect(CATEGORIES).toContain(i.category);
    expect(i.width).toBeGreaterThan(0);
    expect(i.depth).toBeGreaterThan(0);
    expect(i.height).toBeGreaterThan(0);
    expect(i.elevation).toBeGreaterThanOrEqual(0);
    expect(i.color).toMatch(/^#[0-9a-f]{6}$/i);
  }
});

test('every category has items', () => {
  for (const c of CATEGORIES) expect(CATALOG.some((i) => i.category === c)).toBe(true);
});

test('includes the pieces the house needs', () => {
  const required = [
    'cama-doble', 'cama-queen', 'cama-sencilla', 'mesa-noche', 'closet', 'comoda', 'escritorio', 'escritorio-l',
    'silla-oficina', 'silla-gamer', 'monitor', 'torre-pc', 'tablero-blanco', 'estanteria', 'lampara-pie', 'sofa-3',
    'sofa-l', 'sillon', 'mesa-centro', 'mueble-tv', 'televisor', 'alfombra', 'mesa-comedor-4', 'mesa-comedor-6',
    'silla-comedor', 'meson', 'estufa', 'nevera', 'lavaplatos', 'alacena', 'sanitario', 'lavamanos', 'lavamanos-doble',
    'ducha', 'banera', 'espejo', 'lavadero', 'lavadora', 'matera', 'banca', 'carro', 'moto',
  ];
  for (const id of required) expect(catalogItem(id), id).toBeDefined();
});

test('a monitor sits on a desk and a car is a sedan', () => {
  expect(catalogItem('monitor')!.elevation).toBeCloseTo(0.75);
  const car = catalogItem('carro')!;
  expect(car.width).toBeCloseTo(4.5, 1);
  expect(car.depth).toBeCloseTo(1.8, 1);
});

test('search ignores accents and case, and can be limited to a category', () => {
  expect(searchCatalog('BANO').length).toBe(0); // "baño" is a category, not an item name
  expect(searchCatalog('banera').map((i) => i.id)).toEqual(['banera']);
  expect(searchCatalog('silla').map((i) => i.id)).toEqual(expect.arrayContaining(['silla-oficina', 'silla-gamer', 'silla-comedor']));
  expect(searchCatalog('silla', 'Comedor').map((i) => i.id)).toEqual(['silla-comedor']);
  expect(searchCatalog('', 'Parqueadero').map((i) => i.id)).toEqual(['carro', 'moto']);
});
