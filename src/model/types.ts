// All lengths are in metres. Plan coordinates: x right, y down; 3D world maps (x, y) -> (x, elevation, y).
export type Vec2 = { x: number; y: number };

/** Finish of one face of a wall. */
export type WallFinish = 'pintura' | 'ladrillo' | 'piedra' | 'madera' | 'enchape';

export interface WallSide {
  /** hex colour, e.g. "#F4F1EA" (used by 'pintura'; tints the other finishes) */
  color?: string;
  finish?: WallFinish;
}

export interface Wall {
  id: string;
  a: Vec2;
  b: Vec2;
  thickness: number;
  /** null = use the floor height */
  height: number | null;
  /** Light partition of plasterboard on a metal frame; absent = masonry (brick/block). */
  kind?: 'drywall';
  /** Faces of the wall: `left` is on the left when walking from a to b (the +perp side), `right` the other. */
  sides?: { left?: WallSide; right?: WallSide };
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
  /** doors: swing to the other side of the wall */
  flip?: boolean;
  /** doors: a glass door (e.g. a sliding glass door to a balcony) — drawn with a glass pane */
  glass?: boolean;
  /** doors: a sliding door whose panel is a full mirror on the +normal side (−normal when flipped), e.g. closing a
   *  walk-in with the mirror facing the bedroom */
  mirror?: boolean;
  /** doors: an open doorway with no door at all (a «vano»): the wall is cut and the threshold paved, nothing else */
  vano?: boolean;
}

/**
 * room = interior; balcony = exterior with railing; roof = a covering slab only (e.g. a patio roof);
 * stairs = a flight going up to the next floor (no slab: the 3D view draws steps);
 * exterior = open ground outside the house (sidewalk, street, green strip): a surface only, no lights or railing.
 */
export type RoomKind = 'room' | 'balcony' | 'roof' | 'stairs' | 'exterior';

/** Direction a stairs room goes up, in plan terms: n = towards the top of the plan (−y), s = +y, e = +x, w = −x. */
export type StairUp = 'n' | 's' | 'e' | 'w';

/** recta = one straight flight; u = two flights side by side with a landing at the far end, arriving back on the start side. */
export type StairShape = 'recta' | 'u';

export type FloorMaterial = 'ceramica' | 'porcelanato' | 'madera' | 'concreto' | 'piedra' | 'cesped' | 'asfalto' | 'tierra';

export type RailingType = 'vidrio' | 'muro' | 'celosia';

export interface Room {
  id: string;
  name: string;
  kind: RoomKind;
  points: Vec2[];
  /** roof only: height of the slab above this floor (default: the floor height). */
  height?: number;
  /** stairs only: which way it goes up (default 'n'). */
  up?: StairUp;
  /** stairs only: straight flight or U-shaped (default 'recta'). */
  stairShape?: StairShape;
  /** stairs only: floating wooden treads with a glass railing (e.g. a stair rising in a patio). */
  glass?: boolean;
  /** floor finish (rooms and balconies); on a roof it makes a solid, opaque slab with that finish on top. */
  floorMaterial?: FloorMaterial;
  /** roof only: hex colour of the solid slab's edge (fascia), e.g. a wooden band seen from the street. */
  edgeColor?: string;
  /** balconies only: edges (index i = points[i] → points[i+1]) left without railing, e.g. towards a driveway. */
  openEdges?: number[];
  /** balconies only: kind of railing on the open edges (default 'vidrio'). */
  railing?: RailingType;
  /** balconies only: hex colour of the celosía slats / parapet / glass railing metal (default: per kind). */
  railingColor?: string;
}

/** A piece of furniture from the catalog (src/furniture/catalog.ts), placed on a floor. */
export interface Furniture {
  id: string;
  /** catalog id, e.g. "cama-doble" */
  type: string;
  /** centre in plan coordinates */
  x: number;
  y: number;
  /** degrees, clockwise in plan */
  rotation: number;
  /** degrees tipped over about its own width axis (x): 90 lays it on its back, e.g. a picture lying flat */
  tilt?: number;
  width: number;
  depth: number;
  height: number;
  /** height of its base above the floor (stacking: a monitor on a desk) */
  elevation: number;
  color?: string;
  /** gates: open (leaves slid aside) or closed */
  open?: boolean;
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
  furniture: Furniture[];
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
  /** The lot the house is drawn on (reference outline only): top-left corner in plan coordinates, street at +y. */
  site?: Site;
}

export interface Site {
  x: number;
  y: number;
  /** across the front (plan x) */
  width: number;
  /** from the street back (plan y) */
  depth: number;
}
