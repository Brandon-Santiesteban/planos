import { FLOOR_MATERIALS, FLOOR_MATERIAL_ORDER, resolveWallSide, WALL_FINISHES, WALL_FINISH_ORDER } from './catalog';
import { normalizeHex, SWATCHES } from './colors';

test('normalizeHex accepts 6 and 3 digit colours with or without #', () => {
  expect(normalizeHex('#f4f1ea')).toBe('#F4F1EA');
  expect(normalizeHex('  F4F1EA ')).toBe('#F4F1EA');
  expect(normalizeHex('#abc')).toBe('#AABBCC');
  expect(normalizeHex('abc')).toBe('#AABBCC');
});

test('normalizeHex rejects anything else', () => {
  for (const bad of ['', '#', '#12345', '#1234567', 'gggggg', 'rojo', '#12 456']) expect(normalizeHex(bad)).toBeNull();
});

test('the nine swatches are valid colours with Spanish names', () => {
  expect(SWATCHES.map((s) => s.label)).toEqual([
    'Blanco', 'Hueso', 'Arena', 'Gris claro', 'Gris grafito', 'Terracota', 'Verde salvia', 'Azul petróleo', 'Negro',
  ]);
  for (const s of SWATCHES) expect(normalizeHex(s.hex)).toBe(s.hex);
});

test('catalog lists the 5 wall finishes and 6 floor materials with real-world tile sizes', () => {
  expect(WALL_FINISH_ORDER).toEqual(['pintura', 'ladrillo', 'piedra', 'madera', 'enchape']);
  expect(FLOOR_MATERIAL_ORDER).toEqual(['ceramica', 'porcelanato', 'madera', 'concreto', 'piedra', 'cesped']);
  for (const f of WALL_FINISH_ORDER) {
    const [w, h] = WALL_FINISHES[f].tile;
    expect(w).toBeGreaterThan(0.1);
    expect(w).toBeLessThan(3);
    expect(h).toBeGreaterThan(0.1);
  }
  // A brick tile holds whole courses: bricks of 7 cm + 1 cm of mortar.
  const courses = WALL_FINISHES.ladrillo.tile[1] / 0.08;
  expect(courses).toBeCloseTo(Math.round(courses));
  expect(FLOOR_MATERIALS.porcelanato.label).toBe('Porcelanato');
  expect(FLOOR_MATERIALS.cesped.label).toBe('Césped');
  expect(WALL_FINISHES.enchape.label).toBe('Enchape');
});

test('resolveWallSide: unset faces are painted with the fallback warm white', () => {
  expect(resolveWallSide(undefined, '#F4F1EA')).toEqual({ finish: 'pintura', color: '#F4F1EA' });
  expect(resolveWallSide({}, '#F4F1EA')).toEqual({ finish: 'pintura', color: '#F4F1EA' });
});

test('resolveWallSide: paint keeps its colour, textured finishes default to no tint', () => {
  expect(resolveWallSide({ color: '#1f4e5f' }, '#F4F1EA')).toEqual({ finish: 'pintura', color: '#1F4E5F' });
  expect(resolveWallSide({ finish: 'ladrillo' }, '#F4F1EA')).toEqual({ finish: 'ladrillo', color: '#FFFFFF' });
  expect(resolveWallSide({ finish: 'piedra', color: '#D8C7A6' }, '#F4F1EA')).toEqual({ finish: 'piedra', color: '#D8C7A6' });
});

test('resolveWallSide ignores an invalid stored colour', () => {
  expect(resolveWallSide({ color: 'nope' }, '#F4F1EA')).toEqual({ finish: 'pintura', color: '#F4F1EA' });
});
