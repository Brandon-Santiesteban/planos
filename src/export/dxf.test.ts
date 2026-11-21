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

/** Name, colour and lineweight of every LAYER record. */
function layers(dxf: string) {
  const p = pairs(dxf);
  const out: { name: string; color: number; lw: number }[] = [];
  p.forEach(([c, v], i) => {
    if (c !== 0 || v !== 'LAYER') return;
    const rec = new Map<number, string>();
    for (let j = i + 1; j < p.length && p[j][0] !== 0; j++) rec.set(p[j][0], p[j][1]);
    out.push({ name: rec.get(2)!, color: Number(rec.get(62)), lw: Number(rec.get(370)) });
  });
  return out;
}

const one = (units?: 'mm' | 'm') => exportDxf(project, [project.floors[0]], { units });

test('is an AutoCAD 2007 DXF with every section, unique handles, valid owners and a handle seed above them', () => {
  const dxf = one();
  const p = pairs(dxf);
  const sections = p.filter(([c], i) => c === 2 && p[i - 1][1] === 'SECTION').map(([, v]) => v);
  expect(sections).toEqual(['HEADER', 'CLASSES', 'TABLES', 'BLOCKS', 'ENTITIES', 'OBJECTS']);
  expect(dxf).toContain('$ACADVER\r\n  1\r\nAC1021');
  const tables = p.filter(([c], i) => c === 2 && p[i - 1][1] === 'TABLE').map(([, v]) => v);
  expect(tables).toEqual(['VPORT', 'LTYPE', 'LAYER', 'STYLE', 'VIEW', 'UCS', 'APPID', 'DIMSTYLE', 'BLOCK_RECORD']);
  const handles = p.filter(([c], i) => (c === 5 || c === 105) && p[i - 1][1] !== '$HANDSEED').map(([, v]) => parseInt(v, 16));
  expect(new Set(handles).size).toBe(handles.length);
  const seed = parseInt(p[p.findIndex(([, v]) => v === '$HANDSEED') + 1][1], 16);
  expect(seed).toBeGreaterThan(Math.max(...handles));
  const owners = p.filter(([c]) => c === 330).map(([, v]) => parseInt(v, 16)).filter((h) => h !== 0);
  expect(owners.every((h) => handles.includes(h))).toBe(true);
  expect(p[p.length - 1]).toEqual([0, 'EOF']);
});

test('millimetres by default, metres on request', () => {
  expect(one()).toContain('$INSUNITS\r\n 70\r\n4');
  expect(one('m')).toContain('$INSUNITS\r\n 70\r\n6');
  const radius = (dxf: string) => Number(entities(dxf).find((x) => x.type === 'ARC')!.g.get(40)![0]);
  expect(radius(one())).toBeCloseTo(800); // a 0,8 m door
  expect(radius(one('m'))).toBeCloseTo(0.8);
  const height = (dxf: string) => Number(entities(dxf).find((x) => x.type === 'TEXT' && x.g.get(1)?.[0] === 'Baño')!.g.get(40)![0]);
  expect(height(one())).toBeCloseTo(200);
  expect(height(one('m'))).toBeCloseTo(0.2);
});

test('Spanish layers with colours and lineweights, and a dashed line type', () => {
  const l = layers(one());
  expect(l.map((x) => x.name)).toEqual(['0', 'MUROS', 'MUROS-RELLENO', 'HUECOS', 'ESPACIOS', 'ESCALERAS', 'TERRENO', 'MUEBLES', 'COTAS', 'TEXTOS']);
  expect(l.find((x) => x.name === 'MUROS')!.lw).toBeGreaterThan(l.find((x) => x.name === 'COTAS')!.lw);
  expect(l.every((x) => Number.isFinite(x.color) && Number.isFinite(x.lw))).toBe(true);
  expect(pairs(one()).some(([c, v]) => c === 2 && v === 'DASHED')).toBe(true);
});

test('entities per layer: closed polylines for walls and spaces, solid fill for walls', () => {
  const e = entities(one());
  const count = (type: string, layer: string) => e.filter((x) => x.type === type && x.g.get(8)?.[0] === layer).length;
  expect(count('LWPOLYLINE', 'MUROS')).toBe(2); // wall cut by the door
  expect(count('HATCH', 'MUROS-RELLENO')).toBe(2);
  expect(count('LINE', 'HUECOS')).toBe(1);
  expect(count('ARC', 'HUECOS')).toBe(1);
  expect(count('LWPOLYLINE', 'ESPACIOS')).toBe(2);
  expect(count('LWPOLYLINE', 'MUEBLES')).toBe(1);
  expect(count('TEXT', 'MUEBLES')).toBe(1);
  expect(count('LINE', 'COTAS')).toBe(5);
  expect(count('TEXT', 'COTAS')).toBe(1);
  expect(count('TEXT', 'TEXTOS')).toBe(3); // name, area and the north arrow's N
  const closed = e.filter((x) => x.type === 'LWPOLYLINE' && ['MUROS', 'ESPACIOS'].includes(x.g.get(8)![0]));
  expect(closed.every((x) => x.g.get(70)![0].trim() === '1')).toBe(true);
  expect(e.find((x) => x.type === 'LWPOLYLINE' && x.g.get(8)?.[0] === 'ESPACIOS' && x.g.get(6)?.[0] === 'DASHED')).toBeDefined(); // roof
  expect(e.find((x) => x.type === 'TEXT')!.g.get(7)?.[0]).toBe('ARIAL');
});

test('furniture shows its catalog name', () => {
  const f: Floor = { ...floor('P'), furniture: [{ ...floor('P').furniture[0], type: 'cama-doble' }] };
  const e = entities(exportDxf(project, [f]));
  expect(e.find((x) => x.type === 'TEXT' && x.g.get(8)?.[0] === 'MUEBLES')!.g.get(1)![0]).toBe('Cama doble');
});

test('stairs and outdoor ground go on their own layers', () => {
  const f: Floor = {
    ...floor('P'),
    rooms: [
      { id: 's', name: 'Escalera', kind: 'stairs', up: 'n', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 3 }, { x: 0, y: 3 }] },
      { id: 'a', name: 'Andén', kind: 'exterior', points: [{ x: 0, y: 4 }, { x: 5, y: 4 }, { x: 5, y: 5 }, { x: 0, y: 5 }] },
    ],
  };
  const e = entities(exportDxf(project, [f], { units: 'm' }));
  const on = (layer: string) => e.filter((x) => x.g.get(8)?.[0] === layer);
  expect(on('ESCALERAS').filter((x) => x.type === 'LWPOLYLINE')).toHaveLength(1);
  expect(on('ESCALERAS').filter((x) => x.type === 'LINE').length).toBeGreaterThan(5); // treads and arrow
  expect(on('TERRENO').filter((x) => x.type === 'LWPOLYLINE')).toHaveLength(1);
  expect(on('ESPACIOS')).toHaveLength(0);
});

test('y is flipped so the plan reads north-up in CAD (not mirrored)', () => {
  const dxf = one('m');
  const e = entities(dxf);
  // first wall piece: x 0..1.6, plan y −0.1..0.1 → same in CAD, flipped
  const wall = e.find((x) => x.type === 'LWPOLYLINE' && x.g.get(8)?.[0] === 'MUROS')!;
  const xs = wall.g.get(10)!.map(Number);
  const ys = wall.g.get(20)!.map(Number);
  expect(xs.map((x, i) => [+x.toFixed(3), +ys[i].toFixed(3)])).toEqual([[0, -0.1], [1.6, -0.1], [1.6, 0.1], [0, 0.1]]);
  // a room going down the plan (y 0..3) goes down in CAD too
  const room = e.find((x) => x.type === 'LWPOLYLINE' && x.g.get(8)?.[0] === 'ESPACIOS')!;
  expect(Math.min(...room.g.get(20)!.map(Number))).toBeCloseTo(-3);
  // the door swing: plan 0°..90° (towards +y) becomes 270°..0° (counter-clockwise) in CAD
  const arc = e.find((x) => x.type === 'ARC')!;
  expect(Number(arc.g.get(50)![0])).toBeCloseTo(270);
  expect(Number(arc.g.get(51)![0])).toBeCloseTo(0);
  // extents in CAD coordinates
  const p = pairs(dxf);
  const at = (name: string, k: number) => Number(p[p.findIndex(([, v]) => v === name) + k][1]);
  expect(at('$EXTMIN', 2)).toBeLessThanOrEqual(-3); // y
  expect(at('$EXTMAX', 2)).toBeGreaterThan(0);
});

test('accents are plain UTF-8 text', () => {
  const dxf = one();
  expect(dxf).toContain('\r\nBaño\r\n');
  expect(dxf).toContain('m²');
});

test('all floors side by side, each with its name above', () => {
  const e = entities(exportDxf(project, project.floors));
  const labels = e.filter((x) => x.type === 'TEXT' && x.g.get(8)?.[0] === 'TEXTOS').map((x) => x.g.get(1)![0]);
  expect(labels).toContain('Planta baja');
  expect(labels).toContain('Segundo piso');
  expect(e.filter((x) => x.type === 'LWPOLYLINE' && x.g.get(8)?.[0] === 'MUROS')).toHaveLength(4);
  const xOf = (name: string) => Number(e.find((x) => x.type === 'TEXT' && x.g.get(1)?.[0] === name)!.g.get(10)![0]);
  expect(xOf('Segundo piso')).toBeGreaterThan(xOf('Planta baja') + 4000);
});
