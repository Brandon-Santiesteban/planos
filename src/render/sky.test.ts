import { describe, expect, it } from 'vitest';
import { skyGradient } from './sky';

describe('skyGradient', () => {
  it('turns a hemisphere light into top (sky) and bottom (ground) radiance', () => {
    const g = skyGradient([{ sky: [1, 1, 1], ground: [0.5, 0.25, 0], intensity: 2 }], 1);
    expect(g.top).toEqual([2, 2, 2]);
    expect(g.bottom).toEqual([1, 0.5, 0]);
  });

  it('adds several lights and applies the calibration factor', () => {
    const g = skyGradient(
      [
        { sky: [1, 0, 0], ground: [0, 0, 1], intensity: 1 },
        { sky: [0, 1, 0], ground: [0, 0, 1], intensity: 1 },
      ],
      0.5,
    );
    expect(g.top).toEqual([0.5, 0.5, 0]);
    expect(g.bottom).toEqual([0, 0, 1]);
  });

  it('is black without lights', () => {
    expect(skyGradient([], 1)).toEqual({ top: [0, 0, 0], bottom: [0, 0, 0] });
  });
});
