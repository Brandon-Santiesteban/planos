/** The finest grid drawn at this zoom; points snap to its nodes (like My Dream Setup's blueprint grid). */
export function gridStepFor(pxPerMetre: number): number {
  if (pxPerMetre >= 150) return 0.1;
  if (pxPerMetre >= 40) return 0.5;
  return 1;
}
