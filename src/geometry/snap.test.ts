import { snapAngle, snapPoint, snapToGrid } from './snap';

test('snapToGrid rounds to step', () => {
  const p = snapToGrid({ x: 1.234, y: 0.026 }, 0.05);
  expect(p.x).toBeCloseTo(1.25);
  expect(p.y).toBeCloseTo(0.05);
});
test('snapAngle flattens near-horizontal line and keeps length', () => {
  const p = snapAngle({ x: 0, y: 0 }, { x: 3, y: 0.2 }, 45);
  expect(p.y).toBeCloseTo(0);
  expect(p.x).toBeCloseTo(Math.hypot(3, 0.2));
});
test('snapPoint prefers a nearby endpoint', () => {
  const r = snapPoint({ x: 1.02, y: 0 }, { gridStep: 0.05, endpoints: [{ x: 1, y: 0 }], radius: 0.1 });
  expect(r.kind).toBe('endpoint');
  expect(r.point).toEqual({ x: 1, y: 0 });
});
test('snapPoint falls back to grid', () => {
  const r = snapPoint({ x: 2.02, y: 0 }, { gridStep: 0.05, endpoints: [{ x: 1, y: 0 }], radius: 0.1 });
  expect(r.kind).toBe('grid');
  expect(r.point.x).toBeCloseTo(2);
});
