import { create } from 'zustand';

const KEY = 'plano-opciones';

function readShowArea(): boolean {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { showArea?: unknown } | null;
    if (typeof saved?.showArea === 'boolean') return saved.showArea;
  } catch {
    // no storage (private mode, tests): default
  }
  return false; // the user asked for square metres hidden by default
}

/** What the 2D plan labels show. A per-viewer preference, not part of the project. */
export const usePlanOptions = create<{ showArea: boolean; setShowArea(v: boolean): void }>()((set) => ({
  showArea: readShowArea(),
  setShowArea(showArea) {
    set({ showArea });
    try {
      localStorage.setItem(KEY, JSON.stringify({ showArea }));
    } catch {
      // not remembered, that's fine
    }
  },
}));
