import type { Wall } from '../model/types';
import { edgeTouchesWall, wallPieces } from './wallPieces';

const sortPieces = <T extends { u0: number; z0: number }>(ps: T[]) => [...ps].sort((a, b) => a.u0 - b.u0 || a.z0 - b.z0);

test('a window splits the wall into four pieces', () => {
  const pieces = wallPieces(4, 2.6, [{ offset: 2, width: 1.2, sill: 0.9, height: 1.2 }], 0, 0);
  const expected = [
    { u0: 0, u1: 1.4, z0: 0, z1: 2.6 },
    { u0: 1.4, u1: 2.6, z0: 0, z1: 0.9 },
    { u0: 1.4, u1: 2.6, z0: 2.1, z1: 2.6 },
    { u0: 2.6, u1: 4, z0: 0, z1: 2.6 },
  ];
  const got = sortPieces(pieces);
  expect(got).toHaveLength(4);
  got.forEach((p, i) => {
    expect(p.u0).toBeCloseTo(expected[i].u0);
    expect(p.u1).toBeCloseTo(expected[i].u1);
    expect(p.z0).toBeCloseTo(expected[i].z0);
    expect(p.z1).toBeCloseTo(expected[i].z1);
  });
});

test('a door has no piece below it', () => {
  const pieces = wallPieces(4, 2.6, [{ offset: 2, width: 0.8, sill: 0, height: 2.1 }], 0, 0);
  expect(pieces).toHaveLength(3);
  expect(pieces.some((p) => p.z0 === 0 && p.u0 > 1.5 && p.u1 < 2.5)).toBe(false);
});

test('an opening as tall as the wall has no piece above it', () => {
  const pieces = wallPieces(4, 2.6, [{ offset: 2, width: 0.8, sill: 0, height: 2.6 }], 0, 0);
  expect(pieces).toHaveLength(2);
});

test('a wall without openings is one piece, extended at connected ends', () => {
  const pieces = wallPieces(4, 2.6, [], 0.075, 0);
  expect(pieces).toHaveLength(1);
  expect(pieces[0].u0).toBeCloseTo(-0.075);
  expect(pieces[0].u1).toBeCloseTo(4);
});

const wall: Wall = { id: 'w', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, thickness: 0.15, height: null };

test('a balcony edge lying along a wall touches it', () => {
  expect(edgeTouchesWall([{ x: 0.5, y: 0.075 }, { x: 3, y: 0.075 }], [wall])).toBe(true);
});

test('a free balcony edge does not touch any wall', () => {
  expect(edgeTouchesWall([{ x: 0.5, y: 1.2 }, { x: 3, y: 1.2 }], [wall])).toBe(false);
});
