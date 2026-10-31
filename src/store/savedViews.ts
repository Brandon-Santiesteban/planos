// Where each project was being looked at — the plan's zoom and centre, the 3D camera — kept in this browser, so a
// reload (new app code, a new version of the house) or reopening the project comes back to the same spot.
import type { Vec2 } from '../model/types';

type V3 = [number, number, number];
export interface SavedView {
  plan?: { centre: Vec2; pxPerMetre: number };
  camera?: { position: V3; target: V3 };
}

const key = (projectId: string) => `vista:${projectId}`;

export function savedView(projectId: string): SavedView {
  try {
    return JSON.parse(localStorage.getItem(key(projectId)) ?? '{}') as SavedView;
  } catch {
    return {};
  }
}

export function saveView(projectId: string, patch: SavedView): void {
  try {
    localStorage.setItem(key(projectId), JSON.stringify({ ...savedView(projectId), ...patch }));
  } catch {
    // Storage blocked or full: the view is just not remembered.
  }
}
