import type { Floor, Project, Room } from '../src/model/types';

export interface CatalogSizes { name: string; width: number; depth: number; height: number; elevation: number }
export interface Box { x0: number; x1: number; y0: number; y1: number }
export function readCatalog(file?: string): Map<string, CatalogSizes>;
export function interior(floor: Floor, room: Room): Box;
export function furnish(project: Project, catalog?: Map<string, CatalogSizes>): string[];
