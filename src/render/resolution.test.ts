import { describe, expect, it } from 'vitest';
import { scaledSize } from './resolution';

describe('scaledSize', () => {
  it('doubles the on-screen size', () => {
    expect(scaledSize(1200, 700, 2, 8192)).toEqual({ width: 2400, height: 1400 });
  });

  it('keeps the aspect ratio when the GPU limit is reached', () => {
    expect(scaledSize(3000, 1500, 2, 4096)).toEqual({ width: 4096, height: 2048 });
  });

  it('rounds to whole pixels and never goes below 1', () => {
    expect(scaledSize(333, 1, 0.5, 8192)).toEqual({ width: 167, height: 1 });
  });
});
