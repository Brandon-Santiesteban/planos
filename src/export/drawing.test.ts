import type { Floor, Opening, Room, Wall } from '../model/types';
import { buildDrawing, drawingBounds, northArrow, type Poly, type Prim, type Text } from './drawing';

const w = (id: string, ax: number, ay: number, bx: number, by: number, t = 0.2): Wall =>
  ({ id, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: t, height: null });

const floor = (over: Partial<Floor> = {}): Floor => ({
  id: 'f', name: 'Planta baja', height: 2.6, walls: [], openings: [], rooms: [], furniture: [], background: null, ...over,
});

const rect = (x0: number, y0: number, x1: number, y1: number) =>
  [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

const of = <T extends Prim['type']>(prims: Prim[], layer: string, type: T) =>
  prims.filter((p) => p.layer === layer && p.type === type) as Extract<Prim, { type: T }>[];

const xs = (p: Poly) => p.points.map((q) => q.x);
const ys = (p: Poly) => p.points.map((q) => q.y);

describe('MUROS', () => {
  test('a lone wall is one closed footprint', () => {
    const d = buildDrawing(floor({ walls: [w('1', 0, 0, 4, 0)] }));
    const walls = of(d.prims, 'MUROS', 'poly');
    expect(walls).toHaveLength(1);
    expect(walls[0].closed).toBe(true);
    expect(walls[0].fill).toBe(true);
    expect(Math.min(...xs(walls[0]))).toBeCloseTo(0);
    expect(Math.max(...xs(walls[0]))).toBeCloseTo(4);
    expect(Math.min(...ys(walls[0]))).toBeCloseTo(-0.1);
    expect(Math.max(...ys(walls[0]))).toBeCloseTo(0.1);
  });

  test('connected ends grow by half the thickness', () => {
    const d = buildDrawing(floor({ walls: [w('1', 0, 0, 4, 0), w('2', 4, 0, 4, 3)] }));
    const first = of(d.prims, 'MUROS', 'poly')[0];
    expect(Math.min(...xs(first))).toBeCloseTo(0);
    expect(Math.max(...xs(first))).toBeCloseTo(4.1);
  });

  test('openings cut the wall into pieces', () => {
    const door: Opening = { id: 'o', wallId: '1', kind: 'door', offset: 2, width: 0.8, height: 2.1, sill: 0 };
    const win: Opening = { id: 'v', wallId: '1', kind: 'window', offset: 4, width: 1, height: 1.2, sill: 0.9 };
    const d = buildDrawing(floor({ walls: [w('1', 0, 0, 6, 0)], openings: [win, door] }));
    const pieces = of(d.prims, 'MUROS', 'poly').map((p) => [Math.min(...xs(p)), Math.max(...xs(p))]);
    expect(pieces).toHaveLength(3);
    const r = (n: number) => Math.round(n * 100) / 100;
    expect(pieces.map(([a, b]) => [r(a), r(b)])).toEqual([[0, 1.6], [2.4, 3.5], [4.5, 6]]);
  });
});

describe('HUECOS', () => {
  const door = (flip?: boolean): Opening => ({ id: 'o', wallId: '1', kind: 'door', offset: 2, width: 0.8, height: 2.1, sill: 0, flip });

  test('a door is a leaf and a 90° swing arc on the +normal side', () => {
    const d = buildDrawing(floor({ walls: [w('1', 0, 0, 4, 0)], openings: [door()] }));
    const [leaf] = of(d.prims, 'HUECOS', 'line');
    const [arc] = of(d.prims, 'HUECOS', 'arc');
    // wall along +x: perp(+x) = +y
    expect(leaf.a.x).toBeCloseTo(1.6);
    expect(leaf.a.y).toBeCloseTo(0.1);
    expect(leaf.b.x).toBeCloseTo(1.6);
    expect(leaf.b.y).toBeCloseTo(0.9);
    expect(arc.center).toEqual(leaf.a);
    expect(arc.radius).toBeCloseTo(0.8);
    expect(arc.start).toBeCloseTo(0);
    expect(arc.end).toBeCloseTo(90);
  });

  test('flip swings the door to the other side', () => {
    const d = buildDrawing(floor({ walls: [w('1', 0, 0, 4, 0)], openings: [door(true)] }));
    const [leaf] = of(d.prims, 'HUECOS', 'line');
    const [arc] = of(d.prims, 'HUECOS', 'arc');
    expect(leaf.a.y).toBeCloseTo(-0.1);
    expect(leaf.b.y).toBeCloseTo(-0.9);
    expect(arc.start).toBeCloseTo(-90);
    expect(arc.end).toBeCloseTo(0);
  });

  test('a window is double lines across its width', () => {
    const win: Opening = { id: 'v', wallId: '1', kind: 'window', offset: 2, width: 1.2, height: 1.2, sill: 0.9 };
    const d = buildDrawing(floor({ walls: [w('1', 0, 0, 4, 0)], openings: [win] }));
    const lines = of(d.prims, 'HUECOS', 'line');
    expect(lines).toHaveLength(4);
    for (const l of lines) {
      expect(Math.min(l.a.x, l.b.x)).toBeCloseTo(1.4);
      expect(Math.max(l.a.x, l.b.x)).toBeCloseTo(2.6);
    }
    expect(new Set(lines.map((l) => Math.round(l.a.y * 1000))).size).toBe(4);
  });

  test('openings on missing walls are ignored', () => {
    const d = buildDrawing(floor({ openings: [{ ...door(), wallId: 'nope' }] }));
    expect(d.prims).toHaveLength(0);
  });
});

describe('HABITACIONES and TEXTOS', () => {
  const room = (over: Partial<Room>): Room => ({ id: 'r', name: 'Sala', kind: 'room', points: rect(0, 0, 3.5, 3.52), ...over });

  test('a room is an outline plus its name and area', () => {
    const d = buildDrawing(floor({ rooms: [room({})] }));
    const [outline] = of(d.prims, 'HABITACIONES', 'poly');
    expect(outline.closed).toBe(true);
    expect(outline.dashed).toBeFalsy();
    expect(outline.points).toHaveLength(4);
    const texts = of(d.prims, 'TEXTOS', 'text').map((t) => t.text);
    expect(texts).toEqual(['Sala', '12,32 m²']);
    const name = of(d.prims, 'TEXTOS', 'text')[0];
    expect(name.at.x).toBeCloseTo(1.75);
  });

  test('a roof is dashed and has no labels', () => {
    const d = buildDrawing(floor({ rooms: [room({ kind: 'roof', name: 'Techo' })] }));
    expect(of(d.prims, 'HABITACIONES', 'poly')[0].dashed).toBe(true);
    expect(of(d.prims, 'TEXTOS', 'text')).toHaveLength(0);
  });

  test('stairs get step lines across the flight and an arrow going up', () => {
    // 1 m wide, 2.8 m long going north (−y): 10 treads of 0.28 m → 9 inner step lines
    const d = buildDrawing(floor({ rooms: [room({ kind: 'stairs', name: 'Escalera', points: rect(0, 0, 1, 2.8), up: 'n' })] }));
    const lines = of(d.prims, 'HABITACIONES', 'line');
    const steps = lines.filter((l) => Math.abs(l.a.y - l.b.y) < 1e-9 && Math.abs(Math.abs(l.a.x - l.b.x) - 1) < 1e-9);
    expect(steps).toHaveLength(9);
    expect(steps.map((l) => l.a.y).sort((a, b) => a - b)[0]).toBeCloseTo(0.28);
    // arrow: a shaft along y plus a two-stroke head at the top
    const shaft = lines.find((l) => Math.abs(l.a.x - l.b.x) < 1e-9 && Math.abs(l.a.x - 0.5) < 1e-9);
    expect(shaft).toBeDefined();
    expect(Math.min(shaft!.a.y, shaft!.b.y)).toBeLessThan(0.5);
    expect(lines).toHaveLength(9 + 3);
  });

  test('stairs going east get vertical steps', () => {
    const d = buildDrawing(floor({ rooms: [room({ kind: 'stairs', points: rect(0, 0, 2.8, 1), up: 'e' })] }));
    const steps = of(d.prims, 'HABITACIONES', 'line').filter((l) => Math.abs(l.a.x - l.b.x) < 1e-9 && Math.abs(Math.abs(l.a.y - l.b.y) - 1) < 1e-9);
    expect(steps).toHaveLength(9);
  });
});

describe('MUEBLES', () => {
  test('a piece of furniture is a rotated rectangle with its name', () => {
    const d = buildDrawing(floor({
      furniture: [{ id: 'm', type: 'cama-doble', x: 2, y: 1, rotation: 90, width: 1.4, depth: 2, height: 0.5, elevation: 0 }],
    }));
    const [box] = of(d.prims, 'MUEBLES', 'poly');
    expect(box.closed).toBe(true);
    // rotated 90°: 2 m along x, 1.4 m along y
    expect(Math.max(...xs(box)) - Math.min(...xs(box))).toBeCloseTo(2);
    expect(Math.max(...ys(box)) - Math.min(...ys(box))).toBeCloseTo(1.4);
    const [label] = of(d.prims, 'MUEBLES', 'text');
    expect(label.text).toBe('Cama doble');
    expect(label.at).toEqual({ x: 2, y: 1 });
  });

  test('uses the catalog name when given', () => {
    const d = buildDrawing(
      floor({ furniture: [{ id: 'm', type: 'x', x: 0, y: 0, rotation: 0, width: 1, depth: 1, height: 1, elevation: 0 }] }),
      { furnitureName: () => 'Sofá' },
    );
    expect(of(d.prims, 'MUEBLES', 'text')[0].text).toBe('Sofá');
  });
});

describe('COTAS', () => {
  test('each wall gets a dimension line, two extension lines, two ticks and its length', () => {
    const d = buildDrawing(floor({ walls: [w('1', 0, 0, 3.5, 0)] }));
    const lines = of(d.prims, 'COTAS', 'line');
    expect(lines).toHaveLength(5);
    const dim = lines.find((l) => Math.abs(l.a.y - l.b.y) < 1e-9 && Math.abs(Math.abs(l.b.x - l.a.x) - 3.5) < 1e-9);
    expect(dim).toBeDefined();
    expect(dim!.a.y).toBeLessThan(-0.1); // outside the −perp face, like the editor
    const [label] = of(d.prims, 'COTAS', 'text');
    expect(label.text).toBe('3,50');
    expect(label.at.x).toBeCloseTo(1.75);
    expect(label.angle).toBeCloseTo(0);
  });

  test('labels stay upright on walls drawn right-to-left or bottom-to-top', () => {
    const d = buildDrawing(floor({ walls: [w('1', 4, 0, 0, 0), w('2', 0, 3, 0, 0)] }));
    const angles = of(d.prims, 'COTAS', 'text').map((t) => t.angle);
    for (const a of angles) expect(a > -90 - 1e-9 && a <= 90 + 1e-9).toBe(true);
  });
});

test('bounds cover every primitive', () => {
  const d = buildDrawing(floor({ walls: [w('1', 0, 0, 4, 0)], rooms: [{ id: 'r', name: 'A', kind: 'room', points: rect(0, 0, 4, 3) }] }));
  const b = drawingBounds(d.prims)!;
  expect(b.minX).toBeLessThanOrEqual(0);
  expect(b.maxX).toBeGreaterThanOrEqual(4);
  expect(b.minY).toBeLessThan(-0.1); // the dimension sits above the wall
  expect(b.maxY).toBeGreaterThanOrEqual(3);
  expect(drawingBounds([])).toBeNull();
});

test('north arrow points to geographic north', () => {
  const up = northArrow({ x: 0, y: 0 }, 10, 0);
  const tip = (ps: Prim[]) => (ps.find((p) => p.type === 'poly') as Poly).points[0];
  expect(tip(up).x).toBeCloseTo(0);
  expect(tip(up).y).toBeCloseTo(-5);
  const east = northArrow({ x: 0, y: 0 }, 10, 90);
  expect(tip(east).x).toBeCloseTo(5);
  expect(tip(east).y).toBeCloseTo(0);
  expect((up.find((p) => p.type === 'text') as Text).text).toBe('N');
});
