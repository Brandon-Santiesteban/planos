/** Scales a pixel size by `factor`, shrinking it (same aspect) so neither side passes the GPU limit. */
export function scaledSize(width: number, height: number, factor: number, maxSide: number): { width: number; height: number } {
  let w = width * factor;
  let h = height * factor;
  const over = Math.max(w, h) / maxSide;
  if (over > 1) {
    w /= over;
    h /= over;
  }
  return { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) };
}
