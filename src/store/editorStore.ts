import { produce } from 'immer';
import { create } from 'zustand';
import { createEmptyProject } from '../model/defaults';
import type { Project } from '../model/types';

export type Tool = 'select' | 'wall' | 'door' | 'window' | 'room' | 'calibrate' | 'moveBackground' | 'quickRoom' | 'furniture';
export type Item = { kind: 'wall' | 'opening' | 'room' | 'furniture'; id: string };
export type Selection = Item | null;

export interface EditorState {
  project: Project;
  activeFloorId: string;
  selection: Selection;
  /** Several items picked at once with a selection box (empty when a single item or nothing is selected). */
  group: Item[];
  tool: Tool;
  snapping: boolean;
  showUpperFloors: boolean;
  past: Project[];
  future: Project[];
  dirty: boolean;
  /** Incremented every time a project is loaded (new/open/restore). */
  loadCount: number;
  apply(recipe: (draft: Project) => void, opts?: { record?: boolean }): void;
  checkpoint(): void;
  undo(): void;
  redo(): void;
  setTool(t: Tool): void;
  select(s: Selection): void;
  selectGroup(items: Item[]): void;
  setActiveFloor(id: string): void;
  setSnapping(on: boolean): void;
  setShowUpperFloors(on: boolean): void;
  loadProject(p: Project, opts?: { dirty?: boolean }): void;
  /** Swaps in a newer version of the open project (same id) without moving the camera or changing floor. */
  refreshProject(p: Project): void;
  markSaved(): void;
}

const HISTORY_LIMIT = 200;

function selectionExists(p: Project, s: Selection): boolean {
  if (!s) return true;
  return p.floors.some((f) =>
    s.kind === 'wall' ? f.walls.some((w) => w.id === s.id)
      : s.kind === 'opening' ? f.openings.some((o) => o.id === s.id)
        : s.kind === 'furniture' ? f.furniture.some((m) => m.id === s.id)
          : f.rooms.some((r) => r.id === s.id),
  );
}

/** Keeps activeFloorId and selection valid after the project was replaced. */
function reconcile(p: Project, state: EditorState): Partial<EditorState> {
  const activeFloorId = p.floors.some((f) => f.id === state.activeFloorId) ? state.activeFloorId : p.floors[0].id;
  const selection = selectionExists(p, state.selection) ? state.selection : null;
  const group = state.group.filter((g) => selectionExists(p, g));
  return { project: p, activeFloorId, selection, group };
}

const pushPast = (past: Project[], p: Project) => [...past, p].slice(-HISTORY_LIMIT);

const initial = createEmptyProject();

export const useEditor = create<EditorState>()((set, get) => ({
  project: initial,
  activeFloorId: initial.floors[0].id,
  selection: null,
  group: [],
  tool: 'select',
  snapping: true,
  showUpperFloors: false,
  past: [],
  future: [],
  dirty: false,
  loadCount: 0,

  apply(recipe, opts) {
    const state = get();
    // Recipes may return an op result (e.g. boolean); immer must only see draft mutations.
    const next = produce(state.project, (d) => {
      recipe(d);
    });
    if (next === state.project) return;
    const record = opts?.record ?? true;
    set({
      ...reconcile(next, state),
      dirty: true,
      ...(record ? { past: pushPast(state.past, state.project), future: [] } : {}),
    });
  },

  checkpoint() {
    const state = get();
    set({ past: pushPast(state.past, state.project), future: [] });
  },

  undo() {
    const state = get();
    const prev = state.past[state.past.length - 1];
    if (!prev) return;
    set({
      ...reconcile(prev, state),
      past: state.past.slice(0, -1),
      future: [state.project, ...state.future],
      dirty: true,
    });
  },

  redo() {
    const state = get();
    const next = state.future[0];
    if (!next) return;
    set({
      ...reconcile(next, state),
      past: pushPast(state.past, state.project),
      future: state.future.slice(1),
      dirty: true,
    });
  },

  setTool: (tool) => set({ tool }),
  select: (selection) => set({ selection, group: [] }),
  selectGroup: (items) => set(items.length === 1 ? { selection: items[0], group: [] } : { selection: null, group: items }),
  setActiveFloor(id) {
    if (get().project.floors.some((f) => f.id === id)) set({ activeFloorId: id, selection: null, group: [] });
  },
  setSnapping: (snapping) => set({ snapping }),
  setShowUpperFloors: (showUpperFloors) => set({ showUpperFloors }),
  loadProject: (p, opts) =>
    set((s) => ({
      project: p,
      activeFloorId: p.floors[0].id,
      selection: null,
      group: [],
      past: [],
      future: [],
      dirty: opts?.dirty ?? false,
      loadCount: s.loadCount + 1,
    })),
  refreshProject: (p) =>
    set((s) => {
      // Stay on the same floor (by id, else by name) so a live update doesn't jump around.
      const current = s.project.floors.find((f) => f.id === s.activeFloorId);
      const floor = p.floors.find((f) => f.id === s.activeFloorId) ?? p.floors.find((f) => f.name === current?.name) ?? p.floors[p.floors.length - 1];
      return { project: p, activeFloorId: floor.id, selection: null, group: [], past: [], future: [], dirty: false };
    }),
  markSaved: () => set({ dirty: false }),
}));
