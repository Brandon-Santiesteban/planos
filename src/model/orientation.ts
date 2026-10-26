// Compass. `north` = degrees clockwise from the top of the plan to geographic north.

const NAMES = ['Norte', 'Noreste', 'Este', 'Sureste', 'Sur', 'Suroeste', 'Oeste', 'Noroeste'];

export const normalizeDegrees = (d: number) => ((Math.round(d) % 360) + 360) % 360;

/** Name of the compass direction for a bearing in degrees (0 = north, 90 = east). */
export function cardinal(bearing: number): string {
  return NAMES[Math.round(normalizeDegrees(bearing) / 45) % 8];
}

/** Which way the top of the plan faces. */
export function frontFacing(north: number): string {
  return cardinal(-north);
}
