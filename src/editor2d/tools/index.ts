import { DEFAULTS } from '../../model/defaults';
import type { Vec2 } from '../../model/types';
import { snapPoint } from '../../geometry/snap';
import { dist } from '../../geometry/vec';
import type { EditorState, Tool } from '../../store/editorStore';
import { useGrid } from '../gridSettings';
import type { View } from '../viewport';
import { createPlaceFurnitureTool } from '../../furniture/placeTool';
import { createCalibrateTool, createMoveBackgroundTool } from './calibrateTool';
import { createOpeningTool } from './openingTool';
import { createQuickRoomTool } from './quickRoomTool';
import { createRoomTool } from './roomTool';
import { createSelectTool } from './selectTool';
import { createWallTool } from './wallTool';

export interface ToolContext {
  state: EditorState;
  view: View;
  altKey: boolean;
  shiftKey: boolean;
}

export type ToolPreview =
  | { kind: 'wall'; a: Vec2; b: Vec2; length: number; typed: string; typedValid: boolean }
  | { kind: 'polygon'; points: Vec2[]; cursor: Vec2 }
  | { kind: 'marker'; at: Vec2; valid?: boolean; segment?: [Vec2, Vec2] }
  | { kind: 'quickRoom'; corners: Vec2[]; interior: Vec2[]; thickness: number; label: string }
  | { kind: 'box'; a: Vec2; b: Vec2 };

export interface ToolHandler {
  onPointerDown?(p: Vec2, ctx: ToolContext): void;
  onPointerMove?(p: Vec2, ctx: ToolContext): void;
  onPointerUp?(p: Vec2, ctx: ToolContext): void;
  /** Returns true when the key was handled (and must not trigger global shortcuts). */
  onKey?(key: string, ctx: ToolContext): boolean;
  /** Called on double click. */
  onDoubleClick?(p: Vec2, ctx: ToolContext): void;
  preview(): ToolPreview | null;
  reset(): void;
}

export const SNAP_RADIUS_PX = 12;

export function activeFloor(state: EditorState) {
  return state.project.floors.find((f) => f.id === state.activeFloorId) ?? state.project.floors[0];
}

/**
 * Moving what is already drawn (walls, corners, doors) goes in 1 cm steps: it feels free while measures stay round.
 * Only drawing new walls follows the grid shown.
 */
export const MOVE_STEP = 0.01;

/**
 * Snaps to wall endpoints of the active floor (and `extra` points), else to the grid (or to `step` when given);
 * Alt or the toggle disables it.
 */
export function snapForTool(
  p: Vec2,
  ctx: ToolContext,
  extra: Vec2[] = [],
  exclude?: Vec2,
  step?: number,
): { point: Vec2; kind: 'endpoint' | 'grid' | 'none' } {
  if (!ctx.state.snapping || ctx.altKey) return { point: p, kind: 'none' };
  const endpoints = activeFloor(ctx.state)
    .walls.flatMap((w) => [w.a, w.b])
    .concat(extra)
    .filter((e) => !exclude || dist(e, exclude) > DEFAULTS.joinTolerance);
  const grid = useGrid.getState();
  const r = snapPoint(p, { gridStep: step ?? grid.step, endpoints, radius: SNAP_RADIUS_PX / ctx.view.pxPerMetre });
  // With the grid hidden only wall corners attract the pointer (fine steps still apply).
  return r.kind === 'grid' && !grid.visible && step === undefined ? { point: p, kind: 'none' } : r;
}

const noopTool: ToolHandler = { preview: () => null, reset: () => {} };
const cache = new Map<Tool, ToolHandler>();
const factories: Partial<Record<Tool, () => ToolHandler>> = {
  select: createSelectTool,
  wall: createWallTool,
  door: () => createOpeningTool('door'),
  window: () => createOpeningTool('window'),
  room: createRoomTool,
  quickRoom: createQuickRoomTool,
  calibrate: createCalibrateTool,
  moveBackground: createMoveBackgroundTool,
  furniture: createPlaceFurnitureTool,
};

/** Registers a tool factory (used by tool modules added later). */
export function registerTool(tool: Tool, factory: () => ToolHandler): void {
  factories[tool] = factory;
  cache.delete(tool);
}

export function getTool(tool: Tool): ToolHandler {
  let t = cache.get(tool);
  if (!t) {
    t = factories[tool]?.() ?? noopTool;
    cache.set(tool, t);
  }
  return t;
}
