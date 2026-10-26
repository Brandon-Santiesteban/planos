import { BoxGeometry, Euler, Vector3 } from 'three';
import { createFloor } from '../model/defaults';
import type { Floor, Room, Vec2, Wall } from '../model/types';
import { applyMetricUVs, BOX_FACE, faceLabel, faceNormal, faceRoom, isOutsideFace, wallEndExtension } from './wallFaces';

const wall = (id: string, a: Vec2, b: Vec2, thickness = 0.2): Wall => ({ id, a, b, thickness, height: null });
const rect = (id: string, name: string, x0: number, y0: number, x1: number, y1: number, kind: Room['kind'] = 'room'): Room => ({
  id, name, kind, points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }],
});

test('left is the +perp side when walking from a to b', () => {
  const w = wall('w', { x: 0, y: 0 }, { x: 4, y: 0 });
  const l = faceNormal(w, 'left');
  const r = faceNormal(w, 'right');
  expect([l.x, l.y].map((v) => v + 0)).toEqual([0, 1]);
  expect([r.x, r.y].map((v) => v + 0)).toEqual([0, -1]);
});

test('BoxGeometry face groups: +Z (index 4) is the left face once the box is yawed like FloorMeshes', () => {
  // FloorMeshes rotates a box by yaw = -atan2(d.y, d.x) about Y; plan (x, y) = world (x, z).
  for (const d of [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -0.6, y: 0.8 }]) {
    const yaw = -Math.atan2(d.y, d.x);
    const plusZ = new Vector3(0, 0, 1).applyEuler(new Euler(0, yaw, 0));
    const w = wall('w', { x: 0, y: 0 }, d);
    const n = faceNormal(w, 'left');
    expect(plusZ.x).toBeCloseTo(n.x);
    expect(plusZ.z).toBeCloseTo(n.y);
  }
  expect(BOX_FACE).toEqual({ left: 4, right: 5 });
});

test('applyMetricUVs maps the side faces to metres along the wall and up, continuous across pieces', () => {
  const piece = { u0: 1.5, u1: 2.5, z0: 0.9, z1: 2.1 };
  const w = piece.u1 - piece.u0;
  const h = piece.z1 - piece.z0;
  const g = new BoxGeometry(w, h, 0.2);
  applyMetricUVs(g, piece);
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (const face of [BOX_FACE.left, BOX_FACE.right]) {
    const group = g.groups[face];
    const idx = g.index!;
    for (let k = group.start; k < group.start + group.count; k++) {
      const i = idx.getX(k);
      const along = piece.u0 + pos.getX(i) + w / 2; // metres from wall.a
      const up = piece.z0 + pos.getY(i) + h / 2;
      // Left face reads along +u; the right face is seen from the other side, so u runs backwards (still linear in metres).
      expect(uv.getX(i)).toBeCloseTo(face === BOX_FACE.left ? along : -along);
      expect(uv.getY(i)).toBeCloseTo(up);
    }
  }
});

function floorWith(walls: Wall[], rooms: Room[]): Floor {
  return { ...createFloor('P'), walls, rooms };
}

test('wallEndExtension: half thickness (minus a hair) at corners, none at free ends or straight continuations', () => {
  const a = wall('a', { x: 0, y: 0 }, { x: 4, y: 0 });
  const b = wall('b', { x: 4, y: 0 }, { x: 4, y: 3 });
  const walls = [a, b];
  expect(wallEndExtension(walls, a, 'a')).toBe(0);
  expect(wallEndExtension(walls, a, 'b')).toBeCloseTo(0.1, 2);
  expect(wallEndExtension(walls, a, 'b')).toBeLessThan(0.1);
  // A collinear continuation: the two walls meet flush, no overlap (they may have different finishes).
  const c = wall('c', { x: 4, y: 0 }, { x: 7, y: 0 });
  expect(wallEndExtension([a, c], a, 'b')).toBe(0);
  expect(wallEndExtension([a, c], c, 'a')).toBe(0);
  // ...even with a third wall at the joint (T).
  expect(wallEndExtension([a, b, c], a, 'b')).toBe(0);
  expect(wallEndExtension([a, b, c], b, 'a')).toBeCloseTo(0.1, 2);
});

test('faceRoom and faceLabel name the room each face looks into, or Exterior', () => {
  // Wall along y = 3 from x 0 to 4: left (+perp = +y) looks into the bedroom below it in plan.
  const w = wall('w', { x: 4, y: 3 }, { x: 0, y: 3 }); // d = (-1, 0) → left = (0, -1)
  const f = floorWith([w], [
    rect('r1', 'Cocina', 0, 0, 4, 3),
    rect('r2', 'Techo', 0, 3, 4, 6, 'roof'),
  ]);
  expect(faceRoom(f, w, 'left')?.name).toBe('Cocina');
  expect(faceRoom(f, w, 'right')).toBeNull(); // roofs are coverings, not rooms
  expect(faceLabel(f, w, 'left')).toBe('Cocina');
  expect(faceLabel(f, w, 'right')).toBe('Exterior');
  expect(isOutsideFace(f, w, 'right')).toBe(true);
  expect(isOutsideFace(f, w, 'left')).toBe(false);
});

test('a balcony counts as outside', () => {
  const w = wall('w', { x: 0, y: 3 }, { x: 4, y: 3 }); // left = (0, 1)
  const f = floorWith([w], [rect('r1', 'Sala', 0, 0, 4, 3), rect('b', 'Balcón', 0, 3, 4, 4.2, 'balcony')]);
  expect(faceLabel(f, w, 'left')).toBe('Balcón');
  expect(isOutsideFace(f, w, 'left')).toBe(true);
  expect(isOutsideFace(f, w, 'right')).toBe(false);
});

test('faceRoom probes along the wall, so a room covering only part of it still counts', () => {
  const w = wall('w', { x: 0, y: 0 }, { x: 6, y: 0 }); // left = (0, 1)
  const f = floorWith([w], [rect('r', 'Baño', 4, 0, 6, 2)]);
  expect(faceLabel(f, w, 'left')).toBe('Baño');
});
