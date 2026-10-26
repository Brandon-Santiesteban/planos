import type { TimeOfDay } from './sceneOptions';

// Bearing (degrees clockwise from north) and height above the horizon of the sun at each time.
const SUN: Record<TimeOfDay, { bearing: number; elevation: number }> = {
  manana: { bearing: 100, elevation: 50 },
  tarde: { bearing: 260, elevation: 18 },
  noche: { bearing: 200, elevation: 40 }, // the moon
};

/**
 * Sun position relative to the house, in world units (x = plan x, z = plan y, y = up).
 * `north` is the project's compass: degrees clockwise from the top of the plan to north.
 */
export function sunPosition(north: number, time: TimeOfDay, distance: number): [number, number, number] {
  const { bearing, elevation } = SUN[time];
  // A bearing measured from north, turned into plan coordinates (top of the plan is −y).
  const a = ((north + bearing) * Math.PI) / 180;
  const e = (elevation * Math.PI) / 180;
  const flat = Math.cos(e) * distance;
  return [Math.sin(a) * flat, Math.sin(e) * distance, -Math.cos(a) * flat];
}
