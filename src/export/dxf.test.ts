import type { Floor, Project, Wall } from '../model/types';
import { exportDxf } from './dxf';

const w = (id: string, ax: number, ay: number, bx: number, by: number): Wall =>
  ({ id, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.2, height: null });

const floor = (name: string): Floor => ({
  id: name, name, height: 2.6, background: null,
  walls: [w('1', 0, 0, 4, 0)],
  openings: [{ id: 'd', wallId: '1', kind: 'door', offset: 2, width: 0.8, height: 2.1, sill: 0 }],
  rooms: [
    { id: 'r', name: 'Baño', kind: 'room', points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }] },
    { id: 't', name: 'Techo', kind: 'roof', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] },
  ],
  furniture: [{ id: 'm', type: 'mesa', x: 2, y: 1.5, rotation: 0, width: 1, depth: 0.6, height: 0.75, elevation: 0 }],
});

const project: Project = { version: 1, id: 'p', name: 'Casa', north: 0, floors: [floor('Planta baja'), floor('Segundo piso')] };

/** DXF as [code, value] pairs. */
function pairs(dxf: string): [number, string][] {
  const lines = dxf.split(/\r?\n/);
  const out: [number, string][] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) out.push([Number(lines[i].trim()), lines[i + 1]]);
  return out;
}

/** Entities as maps from group code to values. */
function entities(dxf: string) {
  const p = pairs(dxf);
  const start = p.findIndex(([c, v], i) => c === 2 && v === 'ENTITIES' && p[i - 1][1] === 'SECTION');
  const list: { type: string; g: Map<number, string[]> }[] = [];
  for (let i = start + 1; i < p.length; i++) {
    const [c, v] = p[i];
    if (c === 0 && v === 'ENDSEC') break;
    if (c === 0) list.push({ type: v, g: new Map() });
    else {
      const g = list[list.length - 1].g;
      g.set(c, [...(g.get(c) ?? []), v]);
    }
  }
  return list;
}

const one = () => exportDxf(project, [project.floors[0]]);

test('is an R12 ASCII DXF with header, tables, entities and EOF', () => {
  const dxf = one();
  const p = pairs(dxf);
  const sections = p.filter(([c], i) => c === 2 && p[i - 1][1] === 'SECTION').map(([, v]) => v);
  expect(sections).toEqual(['HEADER', 'TABLES', 'ENTITIES']);
  expect(dxf).toContain('$ACADVER\r\n  1\r\nAC1009');
  expect(dxf).toContain('$INSUNITS\r\n 70\r\n6'); // metres
  expect(p[p.length - 1]).toEqual([0, 'EOF']);
  expect(/^[\x00-\x7f]*$/.test(dxf)).toBe(true); // accents escaped
});

test('declares the six layers with distinct colours and a dashed line type', () => {
  const p = pairs(one());
  const layers: { name: string; color: string }[] = [];
  p.forEach(([c, v], i) => {
    if (c === 0 && v === 'LAYER' && p[i + 1][0] === 2) layers.push({ name: p[i + 1][1], color: p[i + 3][1].trim() });
  });
  expect(layers.map((l) => l.name)).toEqual(['0', 'MUROS', 'HUECOS', 'HABITACIONES', 'MUEBLES', 'COTAS', 'TEXTOS']);
  expect(new Set(layers.slice(1).map((l) => l.color)).size).toBe(6);
  expect(p.some(([c, v]) => c === 2 && v === 'DASHED')).toBe(true);
});

test('entities per layer', () => {
  const e = entities(one());
  const count = (type: string, layer: string) => e.filter((x) => x.type === type && x.g.get(8)?.[0] === layer).length;
  expect(count('POLYLINE', 'MUROS')).toBe(2); // wall cut by the door
  expect(count('LINE', 'HUECOS')).toBe(1);
  expect(count('ARC', 'HUECOS')).toBe(1);
  expect(count('POLYLINE', 'HABITACIONES')).toBe(2);
  expect(count('POLYLINE', 'MUEBLES')).toBe(1);
  expect(count('TEXT', 'MUEBLES')).toBe(1);
  expect(count('LINE', 'COTAS')).toBe(5);
  expect(count('TEXT', 'COTAS')).toBe(1);
  expect(count('TEXT', 'TEXTOS')).toBe(3); // name, area and the north arrow's N
  expect(count('POLYLINE', 'TEXTOS')).toBe(1); // north arrow
  expect(e.filter((x) => x.type === 'VERTEX').every((x) => x.g.get(8)?.[0])).toBe(true);
  const roof = e.find((x) => x.type === 'POLYLINE' && x.g.get(8)?.[0] === 'HABITACIONES' && x.g.get(6)?.[0] === 'DASHED');
  expect(roof).toBeDefined();
  expect(roof!.g.get(70)?.[0].trim()).toBe('1'); // closed
});

test('y is flipped so the plan reads north-up in CAD', () => {
  const dxf = one();
  const e = entities(dxf);
  // first wall piece: x 0..1.6, plan y −0.1..0.1 → same in CAD, flipped
  const i = e.findIndex((x) => x.type === 'POLYLINE' && x.g.get(8)?.[0] === 'MUROS');
  const verts = e.slice(i + 1, i + 5).map((v) => ({ x: Number(v.g.get(10)![0]), y: Number(v.g.get(20)![0]) }));
  expect(verts.map((v) => [+v.x.toFixed(3), +v.y.toFixed(3)])).toEqual([[0, -0.1], [1.6, -0.1], [1.6, 0.1], [0, 0.1]]);
  // a room going down the plan (y 0..3) goes down in CAD too
  const room = e.findIndex((x) => x.type === 'POLYLINE' && x.g.get(8)?.[0] === 'HABITACIONES');
  const ys = e.slice(room + 1, room + 5).map((v) => Number(v.g.get(20)![0]));
  expect(Math.min(...ys)).toBeCloseTo(-3);
  // the door swing: plan 0°..90° (towards +y) becomes 270°..360° in CAD
  const arc = e.find((x) => x.type === 'ARC')!;
  expect(Number(arc.g.get(50)![0])).toBeCloseTo(270);
  expect(Number(arc.g.get(51)![0])).toBeCloseTo(360);
  // names with accents survive as unicode escapes
  expect(dxf).toContain('Ba\\U+00F1o');
  expect(dxf).toContain('m\\U+00B2');
});

test('all floors side by side, each with its name above', () => {
  const e = entities(exportDxf(project, project.floors));
  const labels = e.filter((x) => x.type === 'TEXT' && x.g.get(8)?.[0] === 'TEXTOS').map((x) => x.g.get(1)![0]);
  expect(labels).toContain('Planta baja');
  expect(labels).toContain('Segundo piso');
  const walls = e.filter((x) => x.type === 'POLYLINE' && x.g.get(8)?.[0] === 'MUROS');
  expect(walls).toHaveLength(4);
  const xOf = (name: string) => Number(e.find((x) => x.type === 'TEXT' && x.g.get(1)?.[0] === name)!.g.get(10)![0]);
  expect(xOf('Segundo piso')).toBeGreaterThan(xOf('Planta baja') + 4);
});
