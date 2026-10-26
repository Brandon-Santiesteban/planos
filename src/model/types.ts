// All lengths are in metres. Plan coordinates: x right, y down; 3D world maps (x, y) -> (x, elevation, y).
export type Vec2 = { x: number; y: number };

export interface Wall {
  id: string;
  a: Vec2;
  b: Vec2;
  thickness: number;
  /** null = use the floor height */
  height: number | null;
}

export type OpeningKind = 'door' | 'window';

export interface Opening {
  id: string;
  wallId: string;
  kind: OpeningKind;
  /** distance from wall.a to the opening centre */
  offset: number;
  width: number;
  height: number;
  sill: number;
}

/** room = interior; balcony = exterior with railing; roof = a covering slab only (e.g. a patio roof). */
export type RoomKind = 'room' | 'balcony' | 'roof';

export interface Room {
  id: string;
  name: string;
  kind: RoomKind;
  points: Vec2[];
  /** roof only: height of the slab above this floor (default: the floor height). */
  height?: number;
}

export interface Background {
  dataUrl: string;
  origin: Vec2;
  metresPerPixel: number;
  opacity: number;
  widthPx: number;
  heightPx: number;
}

export interface Floor {
  id: string;
  name: string;
  height: number;
  walls: Wall[];
  openings: Opening[];
  rooms: Room[];
  background: Background | null;
}

export interface Project {
  version: 1;
  /** Stable id used by the saved-projects library. */
  id: string;
  name: string;
  /** Compass: degrees clockwise from the top of the plan to geographic north. */
  north: number;
  /** ordered bottom to top */
  floors: Floor[];
}
