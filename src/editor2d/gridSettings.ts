import { create } from 'zustand';

export type GridStep = 0.1 | 0.5 | 1;
const KEY = 'cuadricula';

type Saved = { visible: boolean; step: GridStep };

function read(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null;
    if (s && typeof s.visible === 'boolean' && [0.1, 0.5, 1].includes(s.step)) return s;
  } catch {
    // no storage (private mode, tests): defaults
  }
  return { visible: true, step: 0.5 };
}

function write(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // not remembered, that's fine
  }
}

/** Plan grid shown on screen and used for snapping. A per-viewer preference, not part of the project. */
export const useGrid = create<Saved & { setVisible(v: boolean): void; setStep(s: GridStep): void }>()((set, get) => ({
  ...read(),
  setVisible(visible) {
    set({ visible });
    write({ visible, step: get().step });
  },
  setStep(step) {
    set({ step });
    write({ visible: get().visible, step });
  },
}));

/** The finer grid lines to draw, or null when they'd be closer than 6 px (or are the 1 m lines). */
export function visibleMinorStep(step: GridStep, pxPerMetre: number): number | null {
  if (step >= 1 || step * pxPerMetre < 6) return null;
  return step;
}
