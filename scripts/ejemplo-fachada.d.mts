import type { Floor, Project, Wall } from '../src/model/types';

export const COLORS: { huesoArenilla: string; hueso: string; grisClaro: string; negro: string };
export function isOutside(floor: Floor, w: Wall, side: 'left' | 'right'): boolean;
export function applyFacadeProposal(project: Project): Project;
