import { lerp } from '../geometry/vec';
import { projectOntoWall } from '../geometry/walls';
import type { Vec2, Wall } from '../model/types';

/** A solid box of wall: u along the wall from `a`, z up from the floor. */
export type Piece = { u0: number; u1: number; z0: number; z1: number };

type Hole = { offset: number; width: number; sill: number; height: number };

const EPS = 1e-6;

/** Splits a wall into solid pieces around its openings. */
export function wallPieces(length: number, height: number, openings: Hole[], extA: number, extB: number): Piece[] {
  const pieces: Piece[] = [];
  let cursor = -extA;
  for (const o of [...openings].sort((a, b) => a.offset - b.offset)) {
    const s = o.offset - o.width / 2;
    const e = o.offset + o.width / 2;
    if (s - cursor > EPS) pieces.push({ u0: cursor, u1: s, z0: 0, z1: height });
    if (o.sill > EPS) pieces.push({ u0: s, u1: e, z0: 0, z1: Math.min(o.sill, height) });
    const head = o.sill + o.height;
    if (height - head > EPS) pieces.push({ u0: s, u1: e, z0: head, z1: height });
    cursor = e;
  }
  if (length + extB - cursor > EPS) pieces.push({ u0: cursor, u1: length + extB, z0: 0, z1: height });
  return pieces;
}

/** True when the polygon edge runs along one wall (within half its thickness + 1 cm). */
export function edgeTouchesWall(edge: [Vec2, Vec2], walls: Wall[]): boolean {
  const probes = [edge[0], lerp(edge[0], edge[1], 0.5), edge[1]];
  return walls.some((w) => {
    const tol = w.thickness / 2 + 0.01;
    return probes.every((p) => projectOntoWall(w, p).distance <= tol);
  });
}
