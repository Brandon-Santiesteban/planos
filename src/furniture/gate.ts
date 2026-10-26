/** A telescopic sliding gate: two leaves on parallel tracks (local x, centred on the piece). */
export type GatePanel = { x0: number; x1: number; track: 0 | 1 };

const STACK_GAP = 0.05;

/**
 * Closed, the two leaves cover the opening side by side. Open, both slide past the right end and stack, so the
 * whole width is free (needs about one leaf of room beside the opening: behind the garden fence).
 */
export function gatePanels(width: number, open: boolean): GatePanel[] {
  const leaf = width / 2;
  if (!open) return [{ x0: -leaf, x1: 0, track: 0 }, { x0: 0, x1: leaf, track: 1 }];
  return [
    { x0: leaf, x1: 2 * leaf, track: 0 },
    { x0: leaf + STACK_GAP, x1: 2 * leaf + STACK_GAP, track: 1 },
  ];
}
