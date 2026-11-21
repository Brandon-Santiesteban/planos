import { create } from 'zustand';
import type { Floor } from '../model/types';

const KEY = 'vista-plantas';

interface Saved { onlyActive: boolean; roofs: boolean }

function read(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null;
    return { onlyActive: s?.onlyActive === true, roofs: s?.roofs !== false };
  } catch {
    return { onlyActive: false, roofs: true };
  }
}

/** What the 2D plan and the 3D view show of the floors: only the chosen one, and with or without roofs. Per viewer. */
export const useViewOptions = create<Saved & { set(p: Partial<Saved>): void }>()((set, get) => ({
  ...read(),
  set(p) {
    set(p);
    const { onlyActive, roofs } = get();
    try { localStorage.setItem(KEY, JSON.stringify({ onlyActive, roofs })); } catch { /* not remembered */ }
  },
}));

const noRoofCache = new WeakMap<Floor, Floor>();

/** The floor without its roof slabs (same object back when it has none, cached so React keeps it stable). */
export function withoutRoofs(f: Floor): Floor {
  if (!f.rooms.some((r) => r.kind === 'roof')) return f;
  let out = noRoofCache.get(f);
  if (!out) {
    out = { ...f, rooms: f.rooms.filter((r) => r.kind !== 'roof') };
    noRoofCache.set(f, out);
  }
  return out;
}
