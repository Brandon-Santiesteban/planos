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
    'piscina', 'asoleadora', 'sombrilla', 'pergola', 'sofa-exterior', 'mesa-exterior', 'bar', 'parrilla', 'jardinera',
    'matera-alta',
  ];
  for (const id of required) expect(catalogItem(id), id).toBeDefined();
});

test('a monitor sits on a desk and a car is a sedan', () => {
  expect(catalogItem('monitor')!.elevation).toBeCloseTo(0.75);
  const car = catalogItem('carro')!;
  expect(car.width).toBeCloseTo(4.5, 1);
  expect(car.depth).toBeCloseTo(1.8, 1);
});

test('the raised pool sits on the floor and is about 3 × 2,4 × 1,1 m', () => {
  expect(catalogItem('piscina')).toMatchObject({ category: 'Rooftop', width: 3, depth: 2.4, height: 1.1, elevation: 0 });
});

test('search ignores accents and case, and can be limited to a category', () => {
  expect(searchCatalog('BANO').length).toBe(0); // "baño" is a category, not an item name
  expect(searchCatalog('banera').map((i) => i.id)).toEqual(['banera']);
  expect(searchCatalog('silla').map((i) => i.id)).toEqual(expect.arrayContaining(['silla-oficina', 'silla-gamer', 'silla-comedor']));
  expect(searchCatalog('silla', 'Comedor').map((i) => i.id)).toEqual(['silla-comedor']);
  expect(searchCatalog('', 'Parqueadero').map((i) => i.id)).toEqual(['carro', 'moto']);
});

test('entertainment centre, full-length mirror, curtains, LED strips, jacuzzi and a fire pit', () => {
  expect(catalogItem('centro-entretenimiento')).toMatchObject({ width: 2.4, depth: 0.45, height: 1.9, elevation: 0 });
  expect(catalogItem('espejo-cuerpo')).toMatchObject({ model: 'espejo', width: 0.6, depth: 0.05, height: 1.7 });
  expect(catalogItem('cortina')).toMatchObject({ width: 1.2, depth: 0.08, height: 2.4, elevation: 0 });
  const led = catalogItem('tira-led')!;
  expect(led.height).toBeLessThanOrEqual(0.03);
  expect(led.depth).toBeLessThanOrEqual(0.03);
  expect(catalogItem('jacuzzi')).toMatchObject({ category: 'Baño', width: 1.7, depth: 0.8, height: 0.55 });
  expect(catalogItem('brasero')).toMatchObject({ category: 'Rooftop', elevation: 0 });
  expect(catalogItem('brasero')!.height).toBeLessThanOrEqual(0.5);
  for (const id of ['repisa-coleccionables', 'consola', 'toallero', 'poster-gamer', 'sillon-exterior', 'puf', 'jardin-vertical']) {
    expect(catalogItem(id), id).toBeDefined();
  }
});

test('framed art hangs with its centre at about 1,5 m, in several schemes', () => {
  const art = CATALOG.filter((i) => i.model === 'cuadro');
  expect(new Set(art.map((i) => i.art))).toEqual(new Set(['paisaje', 'abstracto', 'byn', 'gamer']));
  for (const i of art) {
    expect(i.elevation + i.height / 2, i.id).toBeGreaterThan(1.4);
    expect(i.elevation + i.height / 2, i.id).toBeLessThan(1.6);
    expect(i.depth, i.id).toBeLessThanOrEqual(0.05);
  }
});

test('every mirror is wall-mounted and a light, slightly bluish silver', () => {
  const mirrors = CATALOG.filter((x) => x.model === 'espejo');
  expect(mirrors.length).toBeGreaterThanOrEqual(2);
  for (const i of mirrors) {
    expect(i.elevation, i.id).toBeGreaterThan(0);
    const [r, g, b] = [1, 3, 5].map((k) => parseInt(i.color.slice(k, k + 2), 16));
    expect(Math.min(r, g, b), i.id).toBeGreaterThan(180);
    expect(b, i.id).toBeGreaterThanOrEqual(r);
  }
});
