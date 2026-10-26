import type { Room } from '../model/types';
import { stairDivider, stairPath, stairProgress, stairSteps, stairStepLines, MAX_RISER } from './stairs';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
];
const room = (patch: Partial<Room>): Room => ({ id: 'e', name: 'Escalera', kind: 'stairs', points: rect(0, 0, 2, 3), ...patch });

test('a straight flight rises evenly in its up direction', () => {
  const n = room({ up: 'n' });
  expect(stairProgress(n, { x: 1, y: 3 })).toBeCloseTo(0);
  expect(stairProgress(n, { x: 1, y: 1.5 })).toBeCloseTo(0.5);
  expect(stairProgress(n, { x: 1, y: 0 })).toBeCloseTo(1);
  const e = room({ up: 'e', points: rect(0, 0, 4, 1) });
  expect(stairProgress(e, { x: 1, y: 0.5 })).toBeCloseTo(0.25);
  expect(stairProgress(n, { x: 5, y: 1 })).toBeNull();
});

test('up defaults to the top of the plan', () => {
  expect(stairProgress(room({}), { x: 1, y: 0.75 })).toBeCloseTo(0.75);
});

test('a U stairs climbs one half, turns on the landing and comes back up the other half', () => {
  // 2 m wide, 3 m long, going up towards +y: flights 1 m wide, landing 1 m deep at y 2…3.
  const u = room({ up: 's', stairShape: 'u' });
  expect(stairProgress(u, { x: 0.5, y: 0 })).toBeCloseTo(0);
  expect(stairProgress(u, { x: 0.5, y: 1 })).toBeCloseTo(0.25);
  expect(stairProgress(u, { x: 1, y: 2.5 })).toBeCloseTo(0.5); // landing
  expect(stairProgress(u, { x: 1.5, y: 1 })).toBeCloseTo(0.75);
  expect(stairProgress(u, { x: 1.5, y: 0 })).toBeCloseTo(1); // arrives on the start side
});

test('a U stairs has a divider between the flights, a straight one none', () => {
  const [a, b] = stairDivider(room({ up: 's', stairShape: 'u' }))!;
  expect(a).toEqual({ x: 1, y: 0 });
  expect(b.x).toBeCloseTo(1);
  expect(b.y).toBeCloseTo(2);
  expect(stairDivider(room({ up: 's' }))).toBeNull();
});

test('steps never rise more than the maximum riser', () => {
  for (const shape of ['recta', 'u'] as const) {
    const steps = stairSteps(room({ up: 'n', stairShape: shape }), 2.6);
    const tops = steps.map((s) => s.top).sort((x, y) => x - y);
    expect(tops.at(-1)).toBeCloseTo(2.6);
    let prev = 0;
    for (const t of tops) {
      expect(t - prev).toBeLessThanOrEqual(MAX_RISER + 1e-9);
      prev = t;
    }
  }
});

test('the plan shows a line per step and a walking line ending at the top', () => {
  const straight = room({ up: 'n' });
  expect(stairStepLines(straight, 2.6).length).toBe(Math.ceil(2.6 / MAX_RISER) - 1);
  const path = stairPath(straight);
  expect(path[0].y).toBeGreaterThan(path.at(-1)!.y); // goes towards −y
  const u = stairPath(room({ up: 's', stairShape: 'u' }));
  expect(u).toHaveLength(4);
  expect(u[0].x).toBeLessThan(1);
  expect(u.at(-1)!.x).toBeGreaterThan(1);
  expect(u.at(-1)!.y).toBeLessThan(1);
});
