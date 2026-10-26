import { railingParts } from './railing';

const top = (parts: { z1: number }[]) => Math.max(...parts.map((p) => p.z1));

test('vidrio (default): 1 m of glass with a metal handrail and posts', () => {
  const r = railingParts(undefined, false);
  expect(r.height).toBe(1);
  expect(r.posts).toBe(true);
  expect(r.parts.some((p) => p.material === 'glass')).toBe(true);
  const handrail = r.parts.find((p) => p.material === 'metal')!;
  expect(handrail.z1).toBeCloseTo(1);
  expect(top(r.parts)).toBeCloseTo(1);
});

test('muro: a solid 1 m parapet with a wider coping on top, no posts', () => {
  const r = railingParts('muro', false);
  expect(r.height).toBe(1);
  expect(r.posts).toBe(false);
  const wall = r.parts.find((p) => p.material === 'wall')!;
  const coping = r.parts.find((p) => p.material === 'coping')!;
  expect(wall.z0).toBe(0);
  expect(coping.z0).toBeCloseTo(wall.z1);
  expect(coping.z1).toBeCloseTo(1);
  expect(coping.depth).toBeGreaterThan(wall.depth);
});

test('celosía on an upper floor: 1 m of horizontal slats with small gaps', () => {
  const r = railingParts('celosia', false);
  expect(r.height).toBe(1);
  expect(r.posts).toBe(true);
  const slats = r.parts.filter((p) => p.material === 'wood').sort((a, b) => a.z0 - b.z0);
  expect(slats.length).toBeGreaterThan(6);
  for (let i = 1; i < slats.length; i++) {
    const gap = slats[i].z0 - slats[i - 1].z1;
    expect(gap).toBeGreaterThan(0.005);
    expect(gap).toBeLessThan(0.05);
    expect(slats[i].z1 - slats[i].z0).toBeGreaterThan(gap);
  }
  expect(slats[slats.length - 1].z1).toBeCloseTo(1);
});

test('celosía on the ground floor: a 2 m privacy fence on a 0,6 m low wall', () => {
  const r = railingParts('celosia', true);
  expect(r.height).toBe(2);
  const wall = r.parts.find((p) => p.material === 'wall')!;
  expect(wall.z0).toBe(0);
  expect(wall.z1).toBeCloseTo(0.6);
  const slats = r.parts.filter((p) => p.material === 'wood');
  expect(Math.min(...slats.map((s) => s.z0))).toBeGreaterThanOrEqual(0.6 - 1e-9);
  expect(top(slats)).toBeCloseTo(2);
});

test('vidrio and muro stay 1 m on the ground floor', () => {
  expect(railingParts('vidrio', true).height).toBe(1);
  expect(railingParts('muro', true).height).toBe(1);
  expect(top(railingParts('muro', true).parts)).toBeCloseTo(1);
});
