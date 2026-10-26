import { create } from 'zustand';

export type TimeOfDay = 'manana' | 'tarde' | 'noche';
type Options = { grass: boolean; time: TimeOfDay };
const KEY = 'escena-3d';
const TIMES: TimeOfDay[] = ['manana', 'tarde', 'noche'];

function read(): Options {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as (Partial<Options> & { night?: boolean }) | null;
    if (s) {
      const time = TIMES.includes(s.time as TimeOfDay) ? (s.time as TimeOfDay) : s.night ? 'noche' : 'manana';
      return { grass: s.grass !== false, time };
    }
  } catch {
    // no storage: defaults
  }
  return { grass: true, time: 'manana' };
}

/** How the 3D scene looks (grass around the house, time of day). Per viewer, not part of the project. */
export const useSceneOptions = create<Options & { set(o: Partial<Options>): void }>()((set, get) => ({
  ...read(),
  set(o) {
    set(o);
    try {
      localStorage.setItem(KEY, JSON.stringify({ grass: get().grass, time: get().time }));
    } catch {
      // not remembered
    }
  },
}));
