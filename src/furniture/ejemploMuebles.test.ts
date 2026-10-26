import { furnish, interior } from '../../scripts/ejemplo-muebles.mjs';
import type { Floor, Furniture, Project, Room } from '../model/types';
import example from '../../public/ejemplos/casa-etapa-1.casa.json?raw';

const load = (): Project => JSON.parse(example);
const floorNamed = (p: Project, name: string) => p.floors.find((f) => f.name.startsWith(name))!;
const roomNamed = (f: Floor, name: string) => f.rooms.find((r) => r.name.startsWith(name))!;
const box = (r: Room) => {
  const xs = r.points.map((q) => q.x);
  const ys = r.points.map((q) => q.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};
const inRoom = (f: Floor, name: string) => {
  const b = box(roomNamed(f, name));
  return f.furniture.filter((x) => x.x > b.x0 && x.x < b.x1 && x.y > b.y0 && x.y < b.y1);
};
const ofType = (list: Furniture[], type: string) => list.filter((x) => x.type === type);
const footprint = (f: Furniture) => {
  const t = (f.rotation * Math.PI) / 180;
  const hx = (Math.abs(Math.cos(t)) * f.width + Math.abs(Math.sin(t)) * f.depth) / 2;
  const hy = (Math.abs(Math.sin(t)) * f.width + Math.abs(Math.cos(t)) * f.depth) / 2;
  return { x0: f.x - hx, x1: f.x + hx, y0: f.y - hy, y1: f.y + hy };
};
const layout = (list: Furniture[]) =>
  list.map((x) => ({ type: x.type, x: x.x, y: x.y, rotation: x.rotation, width: x.width, depth: x.depth })).sort((a, b) => (a.type + a.x + a.y).localeCompare(b.type + b.x + b.y));

function furnished() {
  const p = load();
  const lines = furnish(p);
  return { p, lines };
}

test('furnishes the example without warnings and keeps the street pieces', () => {
  const p = load();
  const street = p.floors[0].furniture.filter((f) => f.id.startsWith('entorno-')).length;
  const lines = furnish(p);
  expect(lines.filter((l) => l.includes('AVISO'))).toEqual([]);
  expect(p.floors[0].furniture.filter((f) => f.id.startsWith('entorno-')).length).toBe(street);
});

test('the first floor sala, comedor and cocina keep their layout (only pictures are added)', () => {
  const before = floorNamed(load(), 'Primer piso');
  const after = floorNamed(furnished().p, 'Primer piso');
  for (const room of ['Sala', 'Comedor', 'Cocina']) {
    const added = inRoom(after, room).filter((x) => !x.type.startsWith('cuadro'));
    expect(layout(added), room).toEqual(layout(inRoom(before, room)));
  }
  // Upper cabinets hang at their catalogue height.
  for (const a of ofType(inRoom(after, 'Cocina'), 'alacena')) expect(a.elevation).toBeCloseTo(1.5);
});

test('main bedroom: entertainment centre with the TV in its niche facing the bed, and a full-length mirror', () => {
  const f = floorNamed(furnished().p, 'Segundo piso');
  const r = interior(f, roomNamed(f, 'Habitación principal'));
  const pieces = inRoom(f, 'Habitación principal');
  const bed = ofType(pieces, 'cama-queen')[0];
  const [unit] = ofType(pieces, 'centro-entretenimiento');
  expect(unit.rotation).toBe(90); // back on the right wall, facing the headboard on the left wall
  expect(footprint(unit).x1).toBeCloseTo(r.x1, 2);
  expect(Math.abs(unit.y - bed.y)).toBeLessThan(0.35);
  const [tv] = ofType(pieces, 'televisor');
  expect(Math.abs(tv.y - unit.y)).toBeLessThan(0.05);
  expect(footprint(tv).x0).toBeGreaterThan(footprint(unit).x0);
  expect(tv.elevation).toBeGreaterThan(0.5);
  expect(tv.elevation + tv.height).toBeLessThan(1.9 - 0.3);
  expect(ofType(pieces, 'espejo-cuerpo')).toHaveLength(1);
  expect(pieces.some((x) => x.type.startsWith('cuadro'))).toBe(true);
});

test('office: gamer chair, LED strips, collectibles, posters and curtains; the wall behind the user stays clear', () => {
  const f = floorNamed(furnished().p, 'Segundo piso');
  const r = interior(f, roomNamed(f, 'Oficina'));
  const pieces = inRoom(f, 'Oficina');
  expect(ofType(pieces, 'silla-gamer')).toHaveLength(1);
  expect(ofType(pieces, 'silla-oficina')).toHaveLength(0);
  expect(ofType(pieces, 'monitor')).toHaveLength(3);
  for (const t of ['escritorio', 'torre-pc', 'tablero-blanco', 'repisa-coleccionables']) expect(ofType(pieces, t), t).toHaveLength(1);
  expect(ofType(pieces, 'tira-led').length).toBeGreaterThanOrEqual(2);
  expect(ofType(pieces, 'poster-gamer').length).toBeGreaterThanOrEqual(1);
  // Curtains on the back (top) wall, one each side of the window (centre x = 4).
  const curtains = ofType(pieces, 'cortina');
  expect(curtains).toHaveLength(2);
  for (const c of curtains) expect(footprint(c).y0).toBeCloseTo(r.y0, 2);
  expect(curtains.map((c) => Math.sign(c.x - 4)).sort()).toEqual([-1, 1]);
  // Nothing on or near the right wall, behind the chair (the curtains hang on the window wall).
  for (const x of pieces.filter((p) => p.type !== 'cortina')) expect(footprint(x).x1, x.type).toBeLessThan(r.x1 - 0.8);
});

test('bathroom: jacuzzi under the window, rain shower in the back corner, vanity and toilet on opposite walls', () => {
  const f = floorNamed(furnished().p, 'Segundo piso');
  const r = interior(f, roomNamed(f, 'Baño (ducha)'));
  const pieces = inRoom(f, 'Baño (ducha)');
  const [jacuzzi] = ofType(pieces, 'jacuzzi');
  const jf = footprint(jacuzzi);
  expect(jf.y0).toBeCloseTo(r.y0, 2);
  expect(jf.x0).toBeLessThan(1.3); // the high window is centred at x = 1,3
  expect(jf.x1).toBeGreaterThan(1.3);
  const sf = footprint(ofType(pieces, 'ducha')[0]);
  expect(sf.y0).toBeCloseTo(r.y0, 2);
  expect(Math.min(Math.abs(sf.x0 - r.x0), Math.abs(sf.x1 - r.x1))).toBeLessThan(0.01);
  const side = (x: Furniture) => (x.x < (r.x0 + r.x1) / 2 ? 'w' : 'e');
  const vanity = ofType(pieces, 'lavamanos-doble')[0];
  const mirror = ofType(pieces, 'espejo')[0];
  const toilet = ofType(pieces, 'sanitario')[0];
  expect(side(mirror)).toBe(side(vanity));
  expect(Math.abs(mirror.y - vanity.y)).toBeLessThan(0.05);
  expect(side(toilet)).not.toBe(side(vanity));
  expect(ofType(pieces, 'toallero')).toHaveLength(1);
  expect(ofType(pieces, 'matera')).toHaveLength(1);
});

test('pictures hang in the living areas and bedrooms, never over a door or a window', () => {
  const { p } = furnished();
  const want: [string, string][] = [
    ['Primer piso', 'Sala'], ['Primer piso', 'Comedor'], ['Primer piso', 'Entrada'], ['Primer piso', 'Habitación 1'],
    ['Primer piso', 'Habitación 2'], ['Segundo piso', 'Habitación principal'], ['Segundo piso', 'Salita'],
    ['Segundo piso', 'Pasillo'], ['Segundo piso', 'Cuarto'],
  ];
  for (const [floor, room] of want) {
    const art = inRoom(floorNamed(p, floor), room).filter((x) => x.type.startsWith('cuadro'));
    expect(art.length, `${floor} · ${room}`).toBeGreaterThanOrEqual(1);
    for (const a of art) expect(a.elevation + a.height / 2).toBeCloseTo(1.5, 1);
  }
});

test('warns when a picture would cover a window', () => {
  const p = load();
  const f = floorNamed(p, 'Segundo piso');
  // A window on the left wall of the main bedroom, right behind the bed's picture.
  const wall = f.walls.find((w) => w.a.x === 0 && w.b.x === 0 && Math.min(w.a.y, w.b.y) <= 5 && Math.max(w.a.y, w.b.y) >= 9)!;
  f.openings.push({ id: 'v', wallId: wall.id, kind: 'window', offset: Math.abs(wall.a.y - 7.1), width: 1, height: 1, sill: 1.1 });
  const lines = furnish(p);
  expect(lines.some((l) => /AVISO: cuadro-\w+ tapa una ventana/.test(l))).toBe(true);
});

test('rooftop: the front-left zone is a lounge with a fire pit; the rest stays as it was', () => {
  const before = floorNamed(load(), 'Terraza');
  const after = floorNamed(furnished().p, 'Terraza');
  for (const gone of ['asoleadora', 'sombrilla']) expect(ofType(after.furniture, gone), gone).toHaveLength(0);
  const kept = (list: Furniture[]) => list.filter((x) => !['asoleadora', 'sombrilla'].includes(x.type) && !(x.x < 3.3 && x.y > 6.3 && x.type !== 'jardinera'));
  expect(layout(kept(after.furniture))).toEqual(layout(kept(before.furniture)));
  const [pit] = ofType(after.furniture, 'brasero');
  expect(pit.x).toBeLessThan(3.3);
  expect(pit.y).toBeGreaterThan(6);
  const seats = after.furniture.filter((x) => ['sillon-exterior', 'puf'].includes(x.type) && Math.hypot(x.x - pit.x, x.y - pit.y) < 1.4);
  expect(seats.length).toBeGreaterThanOrEqual(2);
  expect(ofType(after.furniture, 'jardin-vertical')).toHaveLength(1);
});

test('running it twice gives the same layout', () => {
  const once = furnished().p;
  const twice = structuredClone(once);
  furnish(twice);
  for (let i = 0; i < once.floors.length; i++) expect(layout(twice.floors[i].furniture)).toEqual(layout(once.floors[i].furniture));
});
