import { alongAxis, snapAngle, snapPoint, snapToGrid, straighten } from './snap';

test('snapToGrid rounds to step', () => {
  const p = snapToGrid({ x: 1.234, y: 0.026 }, 0.05);
  expect(p.x).toBeCloseTo(1.25);
  expect(p.y).toBeCloseTo(0.05);
});
test('snapToGrid returns clean decimals', () => {
  expect(snapToGrid({ x: 3.41, y: 0.29 }, 0.05)).toEqual({ x: 3.4, y: 0.3 });
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

test('a wall a few degrees off horizontal or vertical is put straight; a real diagonal stays', () => {
  expect(straighten({ x: 0, y: 0 }, { x: 3, y: 0.1 }, false)).toEqual({ x: 3, y: 0 });
  expect(straighten({ x: 1, y: 1 }, { x: 1.08, y: 4 }, false)).toEqual({ x: 1, y: 4 });
  expect(straighten({ x: 0, y: 0 }, { x: 3, y: 1 }, false)).toEqual({ x: 3, y: 1 });
});

test('with Shift the wall goes in steps of 45°', () => {
  expect(straighten({ x: 0, y: 0 }, { x: 3, y: 0.6 }, true)).toEqual({ x: 3, y: 0 });
  const d = straighten({ x: 0, y: 0 }, { x: 2, y: 1.8 }, true);
  expect(d.x).toBeCloseTo(d.y);
});

test('a drag held with Shift goes only along its main direction', () => {
  expect(alongAxis({ x: 0.5, y: 0.1 })).toEqual({ x: 0.5, y: 0 });
  expect(alongAxis({ x: -0.1, y: 0.7 })).toEqual({ x: 0, y: 0.7 });
});
