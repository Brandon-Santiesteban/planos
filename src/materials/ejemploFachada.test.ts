import { applyFacadeProposal, COLORS } from '../../scripts/ejemplo-fachada.mjs';
import { parseProject } from '../persistence/projectFile';
import type { Floor, Project, Wall } from '../model/types';
import example from '../../public/ejemplos/casa-etapa-1.casa.json?raw';

const load = (): Project => JSON.parse(example);
const floorNamed = (p: Project, name: string) => p.floors.find((f) => f.name.startsWith(name))!;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const wallBetween = (f: Floor, x0: number, y0: number, x1: number, y1: number): Wall | undefined =>
  f.walls.find((w) => (near(w.a.x, x0) && near(w.a.y, y0) && near(w.b.x, x1) && near(w.b.y, y1))
    || (near(w.a.x, x1) && near(w.a.y, y1) && near(w.b.x, x0) && near(w.b.y, y0)));
/** The face of a wall on y = 9 that looks at the street (+y). */
const streetFace = (w: Wall) => (w.b.x < w.a.x ? w.sides?.right : w.sides?.left);
const insideFace = (w: Wall) => (w.b.x < w.a.x ? w.sides?.left : w.sides?.right);

test('splits the full-width front walls at the stair volume, keeping openings where they were', () => {
  const p = applyFacadeProposal(load());
  for (const name of ['Primer piso', 'Segundo piso']) {
    const f = floorNamed(p, name);
    const stair = wallBetween(f, 5.5, 9, 3.3, 9)!;
    const main = wallBetween(f, 3.3, 9, 0, 9)!;
    expect(stair).toBeDefined();
    expect(main).toBeDefined();
    // The window (centre x = 4,4) stays on the stair piece; the door moves to the main piece.
    expect(f.openings.filter((o) => o.wallId === stair.id).map((o) => o.kind)).toEqual(['window']);
    const door = f.openings.find((o) => o.wallId === main.id && o.kind === 'door')!;
    expect(main.a.x + (main.b.x - main.a.x) / Math.abs(main.b.x - main.a.x) * door.offset).toBeCloseTo(1.65);
  }
});

test('facade: stair front in wood, main volume hueso arenilla, party walls gris claro, inside hueso', () => {
  const p = applyFacadeProposal(load());
  for (const name of ['Primer piso', 'Segundo piso']) {
    const f = floorNamed(p, name);
    expect(streetFace(wallBetween(f, 5.5, 9, 3.3, 9)!)).toEqual({ finish: 'madera' });
    expect(insideFace(wallBetween(f, 5.5, 9, 3.3, 9)!)).toEqual({ finish: 'pintura', color: COLORS.hueso });
    expect(streetFace(wallBetween(f, 3.3, 9, 0, 9)!)).toEqual({ finish: 'pintura', color: COLORS.huesoArenilla });
    const party = wallBetween(f, 5.5, 0, 5.5, 9)!; // a → b goes +y: left = −x (inside), right = +x (neighbour)
    expect(party.sides?.right).toEqual({ finish: 'pintura', color: COLORS.grisClaro });
    expect(party.sides?.left).toEqual({ finish: 'pintura', color: COLORS.hueso });
  }
  const terrace = floorNamed(p, 'Terraza');
  expect(streetFace(wallBetween(terrace, 5.5, 9, 3.3, 9)!)).toEqual({ finish: 'madera' });
  // The stair head's side towards the terrace is facade, its inside is hueso.
  const head = wallBetween(terrace, 3.3, 6, 3.3, 9)!; // +y: left = −x (terrace)
  expect(head.sides?.left).toEqual({ finish: 'pintura', color: COLORS.huesoArenilla });
  expect(head.sides?.right).toEqual({ finish: 'pintura', color: COLORS.hueso });
  // An inner partition is hueso on both faces.
  const partition = wallBetween(floorNamed(p, 'Primer piso'), 3.3, 4, 0, 4)!;
  expect(partition.sides).toEqual({ left: { finish: 'pintura', color: COLORS.hueso }, right: { finish: 'pintura', color: COLORS.hueso } });
});

test('floors: matte porcelanato inside, cerámica in wet rooms, concreto in service areas, piedra in the patio', () => {
  const p = applyFacadeProposal(load());
  const m = (floor: string, room: string) => floorNamed(p, floor).rooms.find((r) => r.name.startsWith(room))!.floorMaterial;
  expect(m('Primer piso', 'Sala')).toBe('porcelanato');
  expect(m('Primer piso', 'Cocina')).toBe('porcelanato');
  expect(m('Primer piso', 'Comedor')).toBe('porcelanato');
  expect(m('Segundo piso', 'Habitación principal')).toBe('porcelanato');
  expect(m('Segundo piso', 'Oficina')).toBe('porcelanato');
  expect(m('Segundo piso', 'Baño')).toBe('ceramica');
  expect(m('Primer piso', 'Lavadero')).toBe('ceramica');
  expect(m('Primer piso', 'Parqueadero')).toBe('concreto');
  expect(m('Primer piso', 'Zona de aseo')).toBe('concreto');
  expect(m('Primer piso', 'Acceso vehicular')).toBe('concreto');
  expect(m('Primer piso', 'Patio')).toBe('piedra');
});

test('railings: parapets on the balcony and terrace, black celosía fence on the ground-floor front', () => {
  const base = load();
  // The base example will make the parking front a balcony too; the script treats it the same way.
  floorNamed(base, 'Primer piso').rooms.find((r) => r.name.startsWith('Acceso vehicular'))!.kind = 'balcony';
  const p = applyFacadeProposal(base);
  const room = (floor: string, name: string) => floorNamed(p, floor).rooms.find((r) => r.name.startsWith(name))!;
  expect(room('Segundo piso', 'Balcón')).toMatchObject({ railing: 'muro' });
  expect(room('Terraza', 'Terraza')).toMatchObject({ railing: 'muro' });
  expect(room('Primer piso', 'Antejardín')).toMatchObject({ railing: 'celosia', railingColor: COLORS.negro });
  expect(room('Primer piso', 'Acceso vehicular')).toMatchObject({ railing: 'celosia', railingColor: COLORS.negro });
});

test('is idempotent and the result is a valid project file', () => {
  const once = applyFacadeProposal(load());
  const twice = applyFacadeProposal(structuredClone(once));
  expect(twice).toEqual(once);
  const r = parseProject(JSON.stringify(once));
  expect(r.ok).toBe(true);
});
