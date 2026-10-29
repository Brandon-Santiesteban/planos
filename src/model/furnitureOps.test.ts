import { createEmptyProject } from './defaults';
import {
  addFurniture, deleteFurniture, duplicateFurniture, furnitureCorners, furnitureFromCatalog, moveFurniture,
  dropElevation, isStacked, piecesOnTop, pointInFurniture, rotateFurniture, snapFlushToWall, snapToWalls, stackElevation, tiltedSize, updateFurniture,
} from './furnitureOps';
import { addWall } from './ops';
import type { Furniture, Wall } from './types';

function setup() {
  const p = createEmptyProject();
  const f = p.floors[0].id;
  return { p, f, floor: () => p.floors[0] };
}

const piece = (over: Partial<Furniture> = {}): Furniture => ({
  id: 'x', type: 'escritorio', x: 0, y: 0, rotation: 0, width: 2, depth: 1, height: 0.75, elevation: 0, ...over,
});

test('furnitureFromCatalog takes the catalog sizes', () => {
  const f = furnitureFromCatalog('monitor', { x: 1, y: 2 });
  expect(f).toMatchObject({ type: 'monitor', x: 1, y: 2, rotation: 0, elevation: 0.75 });
  expect(f.width).toBeGreaterThan(0.5);
  expect(f.color).toMatch(/^#/);
});

test('add, move, rotate and delete a piece', () => {
  const { p, f, floor } = setup();
  const id = addFurniture(p, f, furnitureFromCatalog('cama-doble', { x: 1, y: 1 }));
  expect(floor().furniture).toHaveLength(1);
  moveFurniture(p, f, id, { x: 3, y: 4 });
  expect(floor().furniture[0]).toMatchObject({ x: 3, y: 4 });
  rotateFurniture(p, f, id, -90);
  expect(floor().furniture[0].rotation).toBe(270);
  rotateFurniture(p, f, id, 180);
  expect(floor().furniture[0].rotation).toBe(90);
  deleteFurniture(p, f, id);
  expect(floor().furniture).toHaveLength(0);
});

test('updateFurniture refuses sizes that are not positive and negative elevations', () => {
  const { p, f, floor } = setup();
  const id = addFurniture(p, f, furnitureFromCatalog('escritorio', { x: 0, y: 0 }));
  expect(updateFurniture(p, f, id, { width: 0 })).toBe(false);
  expect(updateFurniture(p, f, id, { elevation: -1 })).toBe(false);
  expect(updateFurniture(p, f, id, { width: 1.8, elevation: 0, color: '#112233', rotation: 450 })).toBe(true);
  expect(floor().furniture[0]).toMatchObject({ width: 1.8, elevation: 0, color: '#112233', rotation: 90 });
  expect(updateFurniture(p, f, id, { color: 'rojo' })).toBe(false);
});

test('duplicate copies the piece beside the original with a new id', () => {
  const { p, f, floor } = setup();
  const id = addFurniture(p, f, furnitureFromCatalog('silla-comedor', { x: 1, y: 1 }));
  const copy = duplicateFurniture(p, f, id)!;
  expect(copy).not.toBe(id);
  const [a, b] = floor().furniture;
  expect(b.type).toBe(a.type);
  expect(b.x).not.toBe(a.x);
  expect(duplicateFurniture(p, f, 'nope')).toBeNull();
});

test('corners and hit test follow the rotation', () => {
  const r = piece({ x: 5, y: 5, rotation: 90 }); // 2 wide x 1 deep, turned: 1 wide in x, 2 long in y
  const xs = furnitureCorners(r).map((c) => c.x);
  const ys = furnitureCorners(r).map((c) => c.y);
  expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1);
  expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(2);
  expect(pointInFurniture(r, { x: 5.1, y: 5.9 })).toBe(true);
  expect(pointInFurniture(r, { x: 5.9, y: 5.1 })).toBe(false);
});

test('stackElevation is the top of the highest piece under a point', () => {
  const desk = piece({ id: 'desk', x: 0, y: 0 });
  const monitor = piece({ id: 'mon', width: 0.6, depth: 0.2, height: 0.45, elevation: 0.75 });
  expect(stackElevation([desk], { x: 0.3, y: 0 }, 'mon')).toBeCloseTo(0.75);
  expect(stackElevation([desk, monitor], { x: 0, y: 0 }, 'other')).toBeCloseTo(1.2);
  expect(stackElevation([desk], { x: 5, y: 5 }, 'mon')).toBeNull();
  expect(stackElevation([desk], { x: 0, y: 0 }, 'desk')).toBeNull(); // never on itself
});

const wallN: Wall = { id: 'w', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, thickness: 0.2, height: null };
const wallE: Wall = { id: 'e', a: { x: 4, y: 0 }, b: { x: 4, y: 4 }, thickness: 0.2, height: null };

test('near a wall a piece turns its back to it and sits flush', () => {
  // A desk 1 m deep, its centre 0.7 m below the wall centreline: back edge 0.2 - 0.1 = 0.1 m from the face.
  const s = snapToWalls([wallN], { x: 2, y: 0.7 }, 2, 1, 0, 0.15)!;
  expect(s.rotation).toBe(0);
  expect(s.x).toBeCloseTo(2);
  expect(s.y).toBeCloseTo(0.6); // face at 0.1 + half depth 0.5
  const e = snapToWalls([wallE], { x: 3.3, y: 2 }, 2, 1, 0, 0.15)!;
  expect(e.rotation).toBe(90); // front faces −x
  expect(e.x).toBeCloseTo(3.4);
});

test('the user rotation is kept relative to the wall', () => {
  // Turned 90°: the side (2 m wide → 1 m from centre) touches the wall.
  const s = snapToWalls([wallN], { x: 2, y: 1.2 }, 2, 1, 90, 0.15)!;
  expect(s.rotation).toBe(90);
  expect(s.y).toBeCloseTo(1.1);
});

test('far from walls there is no snap', () => {
  expect(snapToWalls([wallN], { x: 2, y: 2 }, 2, 1, 0, 0.15)).toBeNull();
  expect(snapToWalls([wallN], { x: 9, y: 0.6 }, 2, 1, 0, 0.15)).toBeNull(); // past the end of the wall
});

test('snapFlushToWall pushes a parallel piece against a wall without turning it', () => {
  const s = snapFlushToWall([wallN], piece({ x: 2, y: 0.68, rotation: 180 }), 0.15)!;
  expect(s).toEqual({ x: 2, y: expect.closeTo(0.6) });
  expect(snapFlushToWall([wallN], piece({ x: 2, y: 0.68, rotation: 30 }), 0.15)).toBeNull();
});

test('dropElevation: on top of what is below, else back to the floor if it was stacked, else unchanged', () => {
  const desk = piece({ id: 'desk', x: 0, y: 0 });
  const mon = piece({ id: 'mon', x: 0, y: 0, width: 0.6, depth: 0.2, height: 0.45, elevation: 0.75 });
  const board = piece({ id: 'board', x: 5, y: 5, width: 1.2, depth: 0.03, elevation: 0.9 });
  const all = [desk, mon, board];
  expect(dropElevation(all, mon, { x: 0.5, y: 0 }, true)).toBeCloseTo(0.75);
  expect(dropElevation(all, mon, { x: 9, y: 9 }, true)).toBe(0);
  expect(dropElevation(all, board, { x: 9, y: 9 }, false)).toBeCloseTo(0.9);
  expect(isStacked(all, mon)).toBe(true);
  expect(isStacked(all, board)).toBe(false);
  // Dragging the desk never lands it on its own monitor.
  expect(piecesOnTop(all, desk)).toEqual(['mon']);
  expect(dropElevation(all, desk, { x: 0.1, y: 0 }, false, piecesOnTop(all, desk))).toBe(0);
});

test('pieces are stored on the floor and survive real walls being present', () => {
  const { p, f } = setup();
  addWall(p, f, { x: 0, y: 0 }, { x: 4, y: 0 });
  const id = addFurniture(p, f, furnitureFromCatalog('nevera', { x: 1, y: 1 }));
  expect(p.floors[0].furniture.find((x) => x.id === id)?.type).toBe('nevera');
});

test('a piece can be tipped over about its width axis; its footprint grows to what it lies on', () => {
  expect(tiltedSize({ depth: 0.05, height: 0.8, tilt: 90 }).depth).toBeCloseTo(0.8);
  expect(tiltedSize({ depth: 0.05, height: 0.8, tilt: 90 }).height).toBeCloseTo(0.05);
  expect(tiltedSize({ depth: 0.5, height: 1 }).depth).toBeCloseTo(0.5);
});

test('tilt is kept in 0–360 and dropped at 0', () => {
  const p = createEmptyProject();
  const f = p.floors[0].id;
  const id = addFurniture(p, f, furnitureFromCatalog('cuadro-paisaje', { x: 0, y: 0 }))!;
  const piece = () => p.floors[0].furniture.find((x) => x.id === id)!;
  expect(updateFurniture(p, f, id, { tilt: -90 })).toBe(true);
  expect(piece().tilt).toBe(270);
  updateFurniture(p, f, id, { tilt: 360 });
  expect(piece().tilt).toBeUndefined();
});
