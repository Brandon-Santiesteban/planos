import type { Wall } from '../model/types';
import { fitOpening, isEndConnected, projectOntoWall, wallFootprint, wallLength } from './walls';

const w = (id: string, ax: number, ay: number, bx: number, by: number, t = 0.2): Wall =>
  ({ id, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: t, height: null });

test('wallLength', () => expect(wallLength(w('1', 0, 0, 3, 4))).toBeCloseTo(5));
test('fitOpening keeps a centred opening', () => expect(fitOpening(4, 2, 1.2, [])).toBe(2));
test('fitOpening clamps near the start', () => expect(fitOpening(4, 0.1, 0.8, [])).toBeCloseTo(0.45));
test('fitOpening clamps near the end', () => expect(fitOpening(4, 3.9, 0.8, [])).toBeCloseTo(3.55));
test('fitOpening rejects opening wider than wall', () => expect(fitOpening(0.7, 0.35, 0.8, [])).toBeNull());
test('fitOpening rejects overlap', () => expect(fitOpening(4, 2, 1, [{ offset: 2.5, width: 1 }])).toBeNull());
test('fitOpening allows adjacent openings', () => expect(fitOpening(4, 1, 1, [{ offset: 2.5, width: 1 }])).toBe(1));
test('wallFootprint extends a connected end by half thickness', () => {
  const fp = wallFootprint(w('1', 0, 0, 4, 0), true, false);
  expect(fp).toHaveLength(4);
  expect(Math.min(...fp.map((p) => p.x))).toBeCloseTo(-0.1);
  expect(Math.max(...fp.map((p) => p.x))).toBeCloseTo(4);
  expect(Math.max(...fp.map((p) => p.y))).toBeCloseTo(0.1);
});
test('isEndConnected detects a shared endpoint', () => {
  const walls = [w('1', 0, 0, 4, 0), w('2', 4, 0, 4, 3)];
  expect(isEndConnected(walls, '1', 'b')).toBe(true);
  expect(isEndConnected(walls, '1', 'a')).toBe(false);
});
test('projectOntoWall gives offset and distance', () => {
  const r = projectOntoWall(w('1', 0, 0, 4, 0), { x: 1.5, y: 0.3 });
  expect(r.offset).toBeCloseTo(1.5);
  expect(r.distance).toBeCloseTo(0.3);
});
