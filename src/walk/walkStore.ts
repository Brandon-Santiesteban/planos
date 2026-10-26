import { create } from 'zustand';

/** Walk mode of the 3D view. `looking` = the mouse is captured (pointer lock). */
export const useWalk = create<{ walking: boolean; looking: boolean; set(o: Partial<{ walking: boolean; looking: boolean }>): void }>()(
  (set) => ({ walking: false, looking: false, set: (o) => set(o) }),
);
