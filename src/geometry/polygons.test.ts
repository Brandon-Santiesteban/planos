import { polygonArea, polygonCentroid } from './polygons';

const rectCCW = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
test('area of 4x3 rectangle', () => expect(polygonArea(rectCCW)).toBeCloseTo(12));
test('area is positive for reversed winding', () => expect(polygonArea([...rectCCW].reverse())).toBeCloseTo(12));
test('centroid of rectangle', () => {
  const c = polygonCentroid(rectCCW);
  expect(c.x).toBeCloseTo(2);
  expect(c.y).toBeCloseTo(1.5);
});
