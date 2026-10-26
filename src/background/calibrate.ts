/** New scale so that a segment measured as `measuredMetres` becomes `realMetres`. */
export function calibratedMetresPerPixel(currentMpp: number, measuredMetres: number, realMetres: number): number {
  return (currentMpp * realMetres) / measuredMetres;
}
