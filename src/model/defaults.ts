import { newId } from './ids';
import type { Floor, Project } from './types';

export const DEFAULTS = {
  wallThickness: 0.15,
  floorHeight: 2.6,
  door: { width: 0.8, height: 2.1, sill: 0 },
  window: { width: 1.2, height: 1.2, sill: 0.9 },
  gridStep: 0.05,
  minWallLength: 0.05,
  openingMargin: 0.05,
  joinTolerance: 0.001,
} as const;

export function createFloor(name: string): Floor {
  return {
    id: newId(),
    name,
    height: DEFAULTS.floorHeight,
    walls: [],
    openings: [],
    rooms: [],
    background: null,
  };
}

export function createEmptyProject(name = 'Mi casa'): Project {
  return { version: 1, name, floors: [createFloor('Planta baja')] };
}
