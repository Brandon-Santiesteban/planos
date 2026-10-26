import { calibratedMetresPerPixel } from './calibrate';

test('doubles the scale when the real length is twice the measured one', () => {
  expect(calibratedMetresPerPixel(0.01, 2, 4)).toBeCloseTo(0.02);
});

test('halves the scale when the real length is half', () => {
  expect(calibratedMetresPerPixel(0.02, 3, 1.5)).toBeCloseTo(0.01);
});
