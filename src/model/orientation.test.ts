import { createEmptyProject } from './defaults';
import { setNorth } from './ops';
import { cardinal, frontFacing } from './orientation';

test('cardinal names in Spanish', () => {
  expect(cardinal(0)).toBe('Norte');
  expect(cardinal(90)).toBe('Este');
  expect(cardinal(180)).toBe('Sur');
  expect(cardinal(270)).toBe('Oeste');
  expect(cardinal(45)).toBe('Noreste');
  expect(cardinal(-45)).toBe('Noroeste');
  expect(cardinal(359)).toBe('Norte');
});

test('which way the top of the plan faces', () => {
  expect(frontFacing(0)).toBe('Norte'); // north points up
  expect(frontFacing(180)).toBe('Sur'); // north points down
  expect(frontFacing(90)).toBe('Oeste'); // north points right → up is west
  expect(frontFacing(270)).toBe('Este');
});

test('new projects have north up and setNorth keeps it within 0–359°', () => {
  const p = createEmptyProject();
  expect(p.north).toBe(0);
  setNorth(p, -30);
  expect(p.north).toBe(330);
  setNorth(p, 375);
  expect(p.north).toBe(15);
});
