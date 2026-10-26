import { scaledSize } from './resolution';

export type RenderPreset = 'rapido' | 'bueno' | 'alto';

/** samples: path-traced samples per pixel · scale: image size relative to the 3D view · bounces: light bounces. */
export const RENDER_PRESETS: Record<RenderPreset, { label: string; samples: number; scale: number; bounces: number }> = {
  rapido: { label: 'Rápido', samples: 48, scale: 0.5, bounces: 3 },
  bueno: { label: 'Bueno', samples: 256, scale: 1, bounces: 5 },
  alto: { label: 'Alto', samples: 1024, scale: 1.5, bounces: 8 },
};

/** Final image size for a preset, from the 3D view's drawing-buffer size. */
export function renderSize(viewWidth: number, viewHeight: number, preset: RenderPreset, maxSide: number) {
  return scaledSize(viewWidth, viewHeight, RENDER_PRESETS[preset].scale, maxSide);
}
