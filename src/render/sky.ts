export type RGB = [number, number, number];

export interface HemiLight {
  sky: RGB;
  ground: RGB;
  intensity: number;
}

/**
 * The path tracer ignores hemisphere lights, so they become an environment gradient instead:
 * sky colour at the zenith, ground colour at the nadir. `factor` calibrates it to the live view.
 */
export function skyGradient(lights: HemiLight[], factor: number): { top: RGB; bottom: RGB } {
  const top: RGB = [0, 0, 0];
  const bottom: RGB = [0, 0, 0];
  for (const l of lights) {
    for (let i = 0; i < 3; i++) {
      top[i] += l.sky[i] * l.intensity * factor;
      bottom[i] += l.ground[i] * l.intensity * factor;
    }
  }
  return { top, bottom };
}
