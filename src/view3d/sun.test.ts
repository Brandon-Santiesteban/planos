import { sunPosition } from './sun';

test('with north up, the morning sun comes from the east (+x) and the afternoon sun from the west', () => {
  const am = sunPosition(0, 'manana', 20);
  const pm = sunPosition(0, 'tarde', 20);
  expect(am[0]).toBeGreaterThan(5);
  expect(pm[0]).toBeLessThan(-5);
  expect(am[1]).toBeGreaterThan(pm[1]); // lower sun in the afternoon
});

test('turning north by 180° moves the east to −x', () => {
  expect(sunPosition(180, 'manana', 20)[0]).toBeLessThan(-5);
});
