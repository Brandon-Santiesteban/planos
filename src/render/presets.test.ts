import { describe, expect, it } from 'vitest';
import { RENDER_PRESETS, renderSize } from './presets';

describe('render presets', () => {
  it('go up in samples and size from Rápido to Alto', () => {
    const { rapido, bueno, alto } = RENDER_PRESETS;
    expect(rapido.samples).toBeLessThan(bueno.samples);
    expect(bueno.samples).toBeLessThan(alto.samples);
    expect(rapido.scale).toBeLessThan(alto.scale);
  });

  it('size the image from the on-screen view and the GPU limit', () => {
    expect(renderSize(1600, 900, 'bueno', 8192)).toEqual({ width: 1600, height: 900 });
    expect(renderSize(1600, 900, 'rapido', 8192)).toEqual({ width: 800, height: 450 });
    expect(renderSize(4000, 2000, 'alto', 4096).width).toBe(4096);
  });
});
