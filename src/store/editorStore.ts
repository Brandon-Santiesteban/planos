import { produce } from 'immer';
import { create } from 'zustand';
import { createEmptyProject } from '../model/defaults';
import type { Project } from '../model/types';

export type Tool = 'select' | 'wall' | 'door' | 'window' | 'room' | 'calibrate' | 'moveBackground';
export type Selection = { kind: 'wall' | 'opening' | 'room'; id: string } | null;

export interface EditorState {
  project: Project;
  activeFloorId: string;
  selection: Selection;
  tool: Tool;
  snapping: boolean;
  showUpperFloors: boolean;
  past: Project[];
  future: Project[];
  dirty: boolean;
  apply(recipe: (draft: Project) => void, opts?: { record?: boolean }): void;
  checkpoint(): void;
  undo(): void;
  redo(): void;
  setTool(t: Tool): void;
  select(s: Selection): void;
  setActiveFloor(id: string): void;
  setSnapping(on: boolean): void;
  setShowUpperFloors(on: boolean): void;
  loadProject(p: Project): void;
  markSaved(): void;
}

const HISTORY_LIMIT = 200;

function selectionExists(p: Project, s: Selection): boolean {
  if (!s) return true;
  return p.floors.some((f) =>
    s.kind === 'wall' ? f.walls.some((w) => w.id === s.id)
      : s.kind === 'opening' ? f.openings.some((o) => o.id === s.id)
        : f.rooms.some((r) => r.id === s.id),
  );
}

/** Keeps activeFloorId and selection valid after the project was replaced. */
function reconcile(p: Project, state: EditorState): Partial<EditorState> {
  const activeFloorId = p.floors.some((f) => f.id === state.activeFloorId) ? state.activeFloorId : p.floors[0].id;
  const selection = selectionExists(p, state.selection) ? state.selection : null;
  return { project: p, activeFloorId, selection };
}

const pushPast = (past: Project[], p: Project) => [...past, p].slice(-HISTORY_LIMIT);

const initial = createEmptyProject();

export const useEditor = create<EditorState>()((set, get) => ({
  project: initial,
  activeFloorId: initial.floors[0].id,
  selection: null,
  tool: 'select',
  snapping: true,
  showUpperFloors: false,
  past: [],
  future: [],
  dirty: false,

  apply(recipe, opts) {
    const state = get();
    const next = produce(state.project, recipe);
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
  select: (selection) => set({ selection }),
  setActiveFloor(id) {
    if (get().project.floors.some((f) => f.id === id)) set({ activeFloorId: id, selection: null });
  },
  setSnapping: (snapping) => set({ snapping }),
  setShowUpperFloors: (showUpperFloors) => set({ showUpperFloors }),
  loadProject: (p) =>
    set({ project: p, activeFloorId: p.floors[0].id, selection: null, past: [], future: [], dirty: false }),
  markSaved: () => set({ dirty: false }),
}));
