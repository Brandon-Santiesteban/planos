import { screenToWorld, worldToScreen, zoomAt, type View } from './viewport';

const size = { w: 800, h: 600 };
const view: View = { centre: { x: 2, y: 1 }, pxPerMetre: 50 };

test('screen centre maps to view centre', () => {
  expect(screenToWorld(view, size, { x: 400, y: 300 })).toEqual({ x: 2, y: 1 });
});

test('worldToScreen inverts screenToWorld', () => {
  const s = { x: 123, y: 456 };
  const back = worldToScreen(view, size, screenToWorld(view, size, s));
  expect(back.x).toBeCloseTo(s.x, 9);
  expect(back.y).toBeCloseTo(s.y, 9);
});

test('zoomAt keeps the point under the cursor fixed', () => {
  const cursor = { x: 100, y: 500 };
  const before = screenToWorld(view, size, cursor);
  const zoomed = zoomAt(view, size, cursor, 1.7);
  const after = screenToWorld(zoomed, size, cursor);
  expect(zoomed.pxPerMetre).toBeCloseTo(85);
  expect(after.x).toBeCloseTo(before.x, 9);
  expect(after.y).toBeCloseTo(before.y, 9);
});

test('zoomAt clamps the zoom level', () => {
  expect(zoomAt(view, size, { x: 0, y: 0 }, 1000).pxPerMetre).toBe(2000);
  expect(zoomAt(view, size, { x: 0, y: 0 }, 0.0001).pxPerMetre).toBe(10);
});
