// Casa CJ: the existing building at Av. Mitre 166 (Avellaneda), modelled as it stands from the approved municipal
// plans the user sent (2026-10-29, «DOC-20240723-WA0029.pdf»: Hotel de Pasajeros, plano registrado, escala 1:100).
// Built with the app's own operations (Playwright drives the dev server), then finished in Node.
//
//   node scripts/base/generar-casa-cj.mjs [puerto]     (needs a dev server, default :5173)
//
// Lot 7,66 m wide × 60,05 m deep (446,16 m²) between party walls, front on Av. Mitre. Design coordinates: a across
// the lot from its LEFT side seen from the street (0 → 7,66), d from the front line (L.M.) back (0 → 60,05).
// P() turns them into plan coordinates, street at the bottom: plan x = a, plan y = 60,05 − d.
// Levels from the plans: planta baja +3,10, primer piso +7,60, segundo piso +10,75 (IGM) → storeys of 4,5 m and
// 3,15 m; the facade is 10,57 m high to the top of the pediment.
//
// Planta baja: at the front the street door to the stair up, the door to the 1,20 m passage («Paso») along the left
// party wall, and the shop («Local comercial», 21,40 m deep) with its wide glass front; a bathroom off the passage.
// Behind the shop the passage widens to 2,00 m and serves twenty storerooms («Depósitos» 1–20, 5,31 m deep, open
// to the passage, widths as dimensioned: 1,75 1,72 2,08 1,75 2,34 1,90 1,91 0,95 1,23 1,94 2,01 2,10 1,77 1,92
// 1,93 1,35 1,35 1,23 1,17 1,96). A second stair in the passage rises to the first-floor patio.
// Primer piso: the hotel rooms. At the front dormitorios 1 (2,06 × 3,84) and 2 (5,60 deep) with french doors onto
// the two balconies, 3 (4,06) and 4 (3,90) along the right party wall off the front hall; then the corridor, with
// dormitorios 5 and 9 (3,00 and 3,15 × 4,40) and bathrooms 6, 7, 8 in the middle, dormitorio 10 (2,75 × 3,40) and
// room 11; the patio (7,31 × 3,70) open to the sky with the stair up to the terrace; behind it the long open
// courtyard («aire y luz») with, on the right, bathroom 12 and dormitorios 13–24 (widths 3,61 2,45 2,45 2,22 1,98
// 1,85 ×6 2,13), and on the left bathrooms 25, 26, the laundry sink, dormitorio 27 (3,60 × 2,43), bathrooms 28, 29,
// the kitchen (30) and the covered back patio (7,84) under the eave.
// Segundo piso: two rooms (7,66 × 5,02 m block, 38,44 m²) and a third one (2,80 × 2,85), with the accessible
// terrace (railing 1,20 m) over dormitorio 10; everything else is sheet-metal roofing (chapa) at the first floor's
// ceiling.
//
// Read from a photographed, folded print, so some things are interpretations (worth checking on site):
//  - positions along the lot come from adding up the dimension strings; the photo is too distorted to measure. The
//    first-floor back rows add up to 59,8 m against the 57,68 / 59,00 m overall dimensions.
//  - dormitorio 2's diagonal wall by the hall is drawn straight; the first-floor wall across the front hall (d 10,5)
//    and the widths of the middle corridor (1,15 m) and of room 11 are estimated; room 11's use is unreadable.
//  - the hatched flight along the left wall of the first-floor hall (d 5,5–9) is not modelled (it is unclear where
//    it leads); the ground-floor front stair is drawn rising from the street door and landing in the hall.
//  - the second-floor rooms' doors, the windows of the hotel rooms (drawn beside each door) and the facade details
//    (pilasters, cornice, balusters, pediment) are simplified.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { interior, readCatalog } from '../casa-completa-muebles.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const OUT = join(root, 'public/ejemplos/casa-cj.casa.json');
const PORT = process.argv[2] ?? '5173';
const L = 60.05;

// Room bands along the lot (wall centre lines; partitions 0,15 m). The back wall (0,45 m) closes both floors.
const BACK = 59.61;
/** Ground-floor storerooms, as dimensioned; the last one takes up whatever is left to the back wall. */
const DEPOSITOS = [1.75, 1.72, 2.08, 1.75, 2.34, 1.9, 1.91, 0.95, 1.23, 1.94, 2.01, 2.1, 1.77, 1.92, 1.93, 1.35, 1.35, 1.23, 1.17];
/** First-floor back row on the right: bathroom 12 and dormitorios 13–24. */
const FILA = [1.75, 3.61, 2.45, 2.45, 2.22, 1.98, 1.85, 1.85, 1.85, 1.85, 1.85, 1.85];

const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://localhost:${PORT}`);
await page.waitForTimeout(800);

const json = await page.evaluate(async ({ L, BACK, DEPOSITOS, FILA }) => {
  const ops = await import('/src/model/ops.ts');
  const { createEmptyProject } = await import('/src/model/defaults.ts');
  const { serializeProject } = await import('/src/persistence/projectFile.ts');
  const r6 = (v) => Math.round(v * 1e6) / 1e6 + 0;
  const P = (a, d) => ({ x: r6(a), y: r6(L - d) });
  const Q = (a, d) => ({ a, d });
  const p = createEmptyProject('Casa CJ');
  const lengths = {};
  // Walls are stored reversed (design b → a), so an opening's offset is measured from the design start point a.
  const wall = (f, a, b, t = 0.15, height) => {
    const id = ops.addWall(p, f, P(b.a, b.d), P(a.a, a.d), t);
    if (!id) throw new Error(`muro ${JSON.stringify([a, b])}`);
    if (height !== undefined && !ops.updateWall(p, f, id, { height })) throw new Error(`altura del muro ${JSON.stringify([a, b])}`);
    lengths[id] = Math.hypot(b.a - a.a, b.d - a.d);
    return id;
  };
  const opening = (f, kind, wallId, offset, patch = {}) => {
    // Added in the middle with the default size, then sized and moved (a default-size opening may not fit near an end).
    const id = ops.addOpening(p, f, wallId, kind, lengths[wallId] - offset) ?? ops.addOpening(p, f, wallId, kind, lengths[wallId] / 2);
    if (!id) throw new Error(`no cabe ${kind} en ${offset}`);
    if (!ops.updateOpening(p, f, id, { ...patch, offset: lengths[wallId] - offset })) throw new Error(`medidas de ${kind} en ${offset}`);
    return id;
  };
  const glassDoor = (f, wallId, offset, patch) => {
    const id = opening(f, 'door', wallId, offset, patch);
    ops.setDoorGlass(p, f, id, true);
    return id;
  };
  const floorOf = (f) => p.floors.find((fl) => fl.id === f);
  const room = (f, pts, name, kind, extra = {}) => {
    const id = ops.addRoom(p, f, pts, name);
    if (!id) throw new Error(`ambiente ${name}`);
    if (kind) ops.setRoomKind(p, f, id, kind);
    Object.assign(floorOf(f).rooms.find((x) => x.id === id), extra);
    return id;
  };
  const rect = (a0, d0, a1, d1) => [P(a0, d0), P(a1, d0), P(a1, d1), P(a0, d1)];
  const poly = (...qs) => qs.map(([a, d]) => P(a, d));
  const DOOR = { width: 0.75, height: 2.2 };
  const HOTEL_WIN = { width: 0.6, sill: 1.0, height: 1.2 };
  const HIGH = { width: 0.5, sill: 1.6, height: 0.5 };
  const LEFT = 0.1; // centre lines of the party walls (0,20 m)
  const RIGHT = 7.56;
  const FRONT = 0.15; // centre line of the street wall (0,30 m)

  // ======================= Planta baja =======================
  const g = p.floors[0].id;
  ops.renameFloor(p, g, 'Planta baja');
  ops.setFloorHeight(p, g, 4.5);
  const street = wall(g, Q(LEFT, FRONT), Q(RIGHT, FRONT), 0.3);
  opening(g, 'door', street, 0.8, { width: 0.9, height: 2.7 }); // puerta de calle a la escalera
  opening(g, 'door', street, 2.15, { width: 1.0, height: 2.7 }); // puerta al paso
  glassDoor(g, street, 5.15, { width: 3.4, height: 3.0 }); // vidriera del local (puertas plegables)
  wall(g, Q(LEFT, FRONT), Q(LEFT, BACK), 0.2);
  wall(g, Q(RIGHT, FRONT), Q(RIGHT, BACK), 0.2);
  wall(g, Q(LEFT, BACK), Q(RIGHT, BACK), 0.45);
  // Stair and bathroom along the left wall, the passage beside them, the shop on the right.
  opening(g, 'door', wall(g, Q(1.5, FRONT), Q(1.5, 7.6)), 6.45, { width: 0.7 }); // paso → baño
  wall(g, Q(LEFT, 4.75), Q(1.5, 4.75));
  wall(g, Q(LEFT, 7.6), Q(1.5, 7.6));
  wall(g, Q(2.95, FRONT), Q(2.95, 8.5), 0.2);
  wall(g, Q(2.95, 8.5), Q(1.4, 8.5), 0.2);
  opening(g, 'door', wall(g, Q(1.4, 8.5), Q(1.4, 21.875), 0.2), 7.0, { width: 0.9 }); // paso → local
  wall(g, Q(1.4, 21.875), Q(RIGHT, 21.875), 0.35);
  room(g, rect(LEFT, FRONT, 1.5, 1.0), 'Entrada a la escalera');
  room(g, rect(LEFT, 1.0, 1.5, 4.75), 'Escalera de la entrada', 'stairs', { up: 'n' });
  room(g, rect(LEFT, 4.75, 1.5, 7.6), 'Baño (planta baja)');
  room(g, poly([2.95, FRONT], [RIGHT, FRONT], [RIGHT, 21.875], [1.4, 21.875], [1.4, 8.5], [2.95, 8.5]), 'Local comercial');
  // Storerooms 1–20 on the right, open to the 2,00 m passage.
  let s = 21.875 + 0.175;
  DEPOSITOS.forEach((w, i) => {
    const c = s + w + 0.075;
    wall(g, Q(2.2, c), Q(RIGHT, c));
    room(g, rect(2.2, s - (i ? 0.075 : 0.175), RIGHT, c), `Depósito ${i + 1}`);
    s = c + 0.075;
  });
  room(g, rect(2.2, s - 0.075, RIGHT, BACK), 'Depósito 20');
  // Second stair, in the passage along the left wall, up to the first-floor patio (rises towards the street).
  room(g, rect(LEFT, 23.6, 1.3, 29.4), 'Escalera al patio', 'stairs', { up: 's' });
  room(g, poly([1.5, FRONT], [2.95, FRONT], [2.95, 8.5], [1.4, 8.5], [1.4, 21.875], [2.2, 21.875], [2.2, BACK], [LEFT, BACK],
    [LEFT, 29.4], [1.3, 29.4], [1.3, 23.6], [LEFT, 23.6], [LEFT, 7.6], [1.5, 7.6]), 'Paso (planta baja)');

  // ======================= Primer piso =======================
  const f1 = ops.addFloor(p);
  ops.renameFloor(p, f1, 'Primer piso');
  ops.setFloorHeight(p, f1, 3.15);
  const front1 = wall(f1, Q(LEFT, FRONT), Q(RIGHT, FRONT), 0.3);
  glassDoor(f1, front1, 1.2, { width: 0.9, height: 2.6 }); // dormitorio 1 → balcón
  glassDoor(f1, front1, 4.6, { width: 1.2, height: 2.6 }); // dormitorio 2 → balcón
  wall(f1, Q(LEFT, FRONT), Q(LEFT, BACK), 0.2);
  wall(f1, Q(RIGHT, FRONT), Q(RIGHT, BACK), 0.2);
  wall(f1, Q(LEFT, BACK), Q(RIGHT, BACK), 0.45);
  room(f1, rect(0.5, -0.9, 1.9, 0.0), 'Balcón (dormitorio 1)', 'balcony', { openEdges: [3], railing: 'celosia' });
  room(f1, rect(3.4, -1.2, 5.8, 0.0), 'Balcón (dormitorio 2)', 'balcony', { openEdges: [3], railing: 'celosia' });

  // --- Front: dormitorios 1–4 off the hall ---
  wall(f1, Q(2.335, FRONT), Q(2.335, 4.2));
  const hallFront = wall(f1, Q(LEFT, 4.2), Q(3.6, 4.2));
  opening(f1, 'door', hallFront, 1.1, DOOR); // hall → dormitorio 1
  opening(f1, 'door', wall(f1, Q(3.6, 4.2), Q(3.6, 5.975)), 0.9, DOOR); // hall → dormitorio 2
  wall(f1, Q(3.6, 5.975), Q(RIGHT, 5.975));
  opening(f1, 'door', wall(f1, Q(3.6, 5.975), Q(3.6, 10.185)), 2.2, { width: 0.9, height: 2.2 }); // dormitorio 3
  wall(f1, Q(3.6, 10.185), Q(RIGHT, 10.185));
  opening(f1, 'door', wall(f1, Q(3.6, 10.185), Q(3.6, 14.235)), 2.0, DOOR); // dormitorio 4
  wall(f1, Q(3.6, 14.235), Q(RIGHT, 14.235));
  opening(f1, 'door', wall(f1, Q(LEFT, 10.5), Q(3.6, 10.5)), 2.7, { width: 0.9, height: 2.2 }); // hall → pasillo
  room(f1, rect(LEFT, FRONT, 2.335, 4.2), 'Dormitorio 1');
  room(f1, poly([2.335, FRONT], [RIGHT, FRONT], [RIGHT, 5.975], [3.6, 5.975], [3.6, 4.2], [2.335, 4.2]), 'Dormitorio 2');
  room(f1, rect(3.6, 5.975, RIGHT, 10.185), 'Dormitorio 3');
  room(f1, rect(3.6, 10.185, RIGHT, 14.235), 'Dormitorio 4');
  room(f1, poly([LEFT, 4.75], [1.5, 4.75], [1.5, 4.2], [3.6, 4.2], [3.6, 10.5], [LEFT, 10.5]), 'Hall');

  // --- Middle: dormitorios 5 and 9 with bathrooms 6, 7, 8, dormitorio 10 and room 11 ---
  const m5 = wall(f1, Q(1.25, 15.37), Q(RIGHT, 15.37), 0.3);
  opening(f1, 'door', m5, 5.6, { width: 0.7, height: 2.1 }); // baño 6, desde el paso transversal
  opening(f1, 'door', wall(f1, Q(1.25, 15.37), Q(1.25, 18.595)), 0.7, DOOR); // dormitorio 5
  wall(f1, Q(1.25, 18.595), Q(5.875, 18.595));
  const m59 = wall(f1, Q(5.875, 15.37), Q(5.875, 19.77));
  opening(f1, 'door', m59, 3.75, { width: 0.7, height: 2.1 }); // baño 7, desde el paso
  wall(f1, Q(5.875, 17.595), Q(RIGHT, 17.595));
  wall(f1, Q(1.25, 19.77), Q(RIGHT, 19.77));
  opening(f1, 'door', wall(f1, Q(1.25, 19.77), Q(1.25, 23.07)), 0.6, DOOR); // dormitorio 9
  opening(f1, 'door', wall(f1, Q(5.875, 19.77), Q(5.875, 23.07)), 2.6, { width: 0.7, height: 2.1 }); // dormitorio 9 → baño 8
  wall(f1, Q(1.25, 23.07), Q(RIGHT, 23.07));
  opening(f1, 'door', wall(f1, Q(2.13, 23.07), Q(2.13, 25.97)), 0.6, DOOR); // dormitorio 10
  wall(f1, Q(5.605, 23.07), Q(5.605, 25.97));
  const m11 = wall(f1, Q(2.13, 25.97), Q(RIGHT, 25.97));
  opening(f1, 'window', m11, 1.9, HOTEL_WIN); // dormitorio 10 → patio
  opening(f1, 'door', m11, 3.85, { width: 0.7, height: 2.1 }); // ambiente 11 → patio
  room(f1, rect(1.25, 15.37, 5.875, 18.595), 'Dormitorio 5');
  room(f1, rect(5.875, 15.37, RIGHT, 17.595), 'Baño 6');
  room(f1, rect(5.875, 17.595, RIGHT, 19.77), 'Baño 7');
  room(f1, rect(1.25, 19.77, 5.875, 23.07), 'Dormitorio 9');
  room(f1, rect(5.875, 19.77, RIGHT, 23.07), 'Baño 8');
  room(f1, rect(2.13, 23.07, 5.605, 25.97), 'Dormitorio 10');
  room(f1, rect(5.605, 23.07, RIGHT, 25.97), 'Ambiente 11');
  room(f1, poly([LEFT, 10.5], [3.6, 10.5], [3.6, 14.235], [RIGHT, 14.235], [RIGHT, 15.37], [1.25, 15.37], [1.25, 18.595],
    [5.875, 18.595], [5.875, 19.77], [1.25, 19.77], [1.25, 23.07], [2.13, 23.07], [2.13, 25.97], [1.3, 25.97], [1.3, 23.6],
    [LEFT, 23.6]), 'Pasillo');

  // --- Back: the open courtyard with the rooms on both sides ---
  // Right-hand row: bathroom 12 and dormitorios 13–15 (front wall at a 4,6), 16–24 deeper (a 3,95).
  let c = 29.82;
  const rowEnds = [];
  wall(f1, Q(4.6, c), Q(RIGHT, c));
  FILA.concat([BACK - 0.225 - (c + 0.075 + FILA.reduce((t, w) => t + w + 0.15, 0))]).forEach((w, i) => {
    const n = i + 12;
    const front = n <= 15 ? 4.6 : 3.95;
    const end = n === 24 ? BACK : c + 0.075 + w + 0.075;
    if (n === 16) wall(f1, Q(3.95, c), Q(4.6, c));
    if (n !== 24) wall(f1, Q(front, end), Q(RIGHT, end));
    const fw = wall(f1, Q(front, c), Q(front, end));
    if (n !== 12 && w >= 1.8) opening(f1, 'window', fw, w - 0.35, HOTEL_WIN);
    opening(f1, 'door', fw, 0.6, n === 12 ? { width: 0.7, height: 2.1 } : DOOR);
    room(f1, rect(front, c, RIGHT, end), n === 12 ? 'Baño 12' : `Dormitorio ${n}`);
    rowEnds.push(end);
    c = end;
  });
  const end15 = rowEnds[3];
  // Left-hand row: bathrooms 25, 26, (covered stretch with the laundry sink), dormitorio 27, bathrooms 28, 29,
  // the kitchen, then the covered back patio.
  const leftRooms = [['Baño 25', 29.82, 31.37, 1.9], ['Baño 26', 31.37, 33.12, 1.9], ['Dormitorio 27', 42.225, 45.975, 2.705],
    ['Baño 28', 45.975, 47.225, 1.9], ['Baño 29', 47.225, 48.675, 1.9], ['Cocina', 48.675, 50.725, 1.9]];
  wall(f1, Q(LEFT, 29.82), Q(1.9, 29.82));
  for (const [name, d0, d1, front] of leftRooms) {
    if (name === 'Dormitorio 27') wall(f1, Q(LEFT, d0), Q(front, d0));
    const fw = wall(f1, Q(front, d0), Q(front, d1));
    const len = d1 - d0;
    if (name === 'Dormitorio 27') {
      opening(f1, 'door', fw, 0.6, DOOR);
      opening(f1, 'window', fw, 2.4, { width: 1.0, sill: 1.0, height: 1.2 });
    } else {
      opening(f1, 'door', fw, len / 2, { width: name === 'Cocina' ? 0.8 : 0.65, height: 2.1 });
    }
    wall(f1, Q(LEFT, d1), Q(name === 'Dormitorio 27' ? 2.705 : 1.9, d1));
    room(f1, rect(LEFT, d0, front, d1), name);
  }
  // Patio (7,31 × 3,70) and the courtyard behind it: open to the sky. The stairs leave holes: the ground-floor one
  // arriving on the left, the one up to the terrace along the right party wall.
  room(f1, poly([1.3, 25.97], [2.13, 25.97], [6.4, 25.97], [6.4, 29.82], [4.6, 29.82], [4.6, end15], [3.95, end15],
    [3.95, BACK], [LEFT, BACK], [LEFT, 50.725], [1.9, 50.725], [1.9, 45.975], [2.705, 45.975], [2.705, 42.225], [LEFT, 42.225],
    [LEFT, 33.12], [1.9, 33.12], [1.9, 29.82], [LEFT, 29.82], [LEFT, 29.4], [1.3, 29.4]), 'Patio (aire y luz)', 'balcony',
  { openEdges: Array.from({ length: 21 }, (_, i) => i), floorMaterial: 'ceramica' });
  room(f1, rect(6.4, 26.045, RIGHT, 29.82), 'Escalera a la terraza', 'stairs', { up: 's' });

  // ======================= Segundo piso =======================
  const f2 = ops.addFloor(p);
  ops.renameFloor(p, f2, 'Segundo piso');
  ops.setFloorHeight(p, f2, 2.8);
  // Street parapet with the pediment in the middle (facade 10,57 m).
  wall(f2, Q(LEFT, FRONT), Q(2.4, FRONT), 0.3, 1.15);
  wall(f2, Q(2.4, FRONT), Q(5.26, FRONT), 0.3, 2.9);
  wall(f2, Q(5.26, FRONT), Q(RIGHT, FRONT), 0.3, 1.15);
  const bA = wall(f2, Q(LEFT, 18.9), Q(RIGHT, 18.9), 0.2);
  opening(f2, 'window', bA, 1.9, { width: 1.0, sill: 1.0, height: 1.1 });
  opening(f2, 'window', bA, 5.7, { width: 1.0, sill: 1.0, height: 1.1 });
  wall(f2, Q(LEFT, 18.9), Q(LEFT, 26.77), 0.2);
  wall(f2, Q(RIGHT, 18.9), Q(RIGHT, 23.92), 0.2);
  wall(f2, Q(3.83, 18.9), Q(3.83, 23.92));
  const bB = wall(f2, Q(LEFT, 23.92), Q(RIGHT, 23.92));
  opening(f2, 'door', bB, 3.2, DOOR); // habitación A → terraza
  opening(f2, 'door', bB, 5.6, DOOR); // habitación B → terraza
  opening(f2, 'window', bB, 6.6, HOTEL_WIN);
  opening(f2, 'door', wall(f2, Q(2.8, 23.92), Q(2.8, 26.77)), 1.0, DOOR); // habitación C → terraza
  wall(f2, Q(LEFT, 26.77), Q(2.8, 26.77));
  room(f2, rect(LEFT, 18.9, 3.83, 23.92), 'Habitación A (2º piso)');
  room(f2, rect(3.83, 18.9, RIGHT, 23.92), 'Habitación B (2º piso)');
  room(f2, rect(LEFT, 23.92, 2.8, 26.77), 'Habitación C (2º piso)');
  // Terrace: open against the rooms and where the stair arrives (a 6,4–7,56), railing on the rest.
  room(f2, poly([2.8, 23.92], [RIGHT, 23.92], [RIGHT, 26.045], [6.4, 26.045], [2.8, 26.045]), 'Terraza accesible', 'balcony',
    { openEdges: [0, 2, 4], railing: 'vidrio', floorMaterial: 'ceramica' });
  // Sheet-metal roofs over the rest of the first floor (dormitorio 10 and room 11 are under the terrace; the patio
  // and courtyard stay open).
  const chapa = [
    ['Techo de chapa (frente)', rect(LEFT, FRONT, RIGHT, 18.9)],
    ['Techo de chapa (baño 12 a dormitorio 15)', rect(4.6, 29.82, RIGHT, end15)],
    ['Techo de chapa (dormitorios 16 a 24)', rect(3.95, end15, RIGHT, BACK)],
    ['Techo de chapa (baños 25 y 26, lavadero)', rect(LEFT, 29.82, 1.9, 42.225)],
    ['Techo de chapa (dormitorio 27 y cocina)', poly([LEFT, 42.225], [2.705, 42.225], [2.705, 45.975], [1.9, 45.975], [1.9, 50.725], [LEFT, 50.725])],
    ['Alero del patio cubierto', rect(LEFT, 50.725, 2.2, BACK)],
  ];
  for (const [name, pts] of chapa) {
    ops.setRoofHeight(p, f2, room(f2, pts, name, 'roof'), 0.25);
  }

  // ======================= Azotea (roofs of the second floor) =======================
  const f3 = ops.addFloor(p);
  ops.renameFloor(p, f3, 'Azotea');
  ops.setRoofHeight(p, f3, room(f3, rect(LEFT, 18.9, RIGHT, 23.92), 'Azotea accesible', 'roof'), 0.001);
  ops.setRoofHeight(p, f3, room(f3, rect(LEFT, 23.92, 2.8, 26.77), 'Azotea inaccesible', 'roof'), 0.001);

  return serializeProject(p);
}, { L, BACK, DEPOSITOS, FILA });
await browser.close();
if (errors.length) throw new Error(errors.join('\n'));

const project = JSON.parse(json);
project.id = randomUUID();
const [ground, first, second, azotea] = project.floors;

// ---------- Finishes: plastered and painted facade (revoque fino pintado), old wooden floors upstairs ----------
const CREMA = '#EDE3CF';
const MATERIAL = [[/baño|cocina/i, 'ceramica'], [/depósito|paso \(planta/i, 'concreto'], [/local|entrada/i, 'ceramica'],
  [/dormitorio|habitación|ambiente/i, 'madera'], [/pasillo|hall/i, 'ceramica']];
for (const floor of [ground, first, second]) {
  for (const r of floor.rooms) {
    if (r.kind === 'roof' || r.kind === 'stairs' || r.floorMaterial) continue;
    r.floorMaterial = MATERIAL.find(([re]) => re.test(r.name))?.[1] ?? 'ceramica';
  }
  for (const w of floor.walls) {
    if (Math.abs(w.a.y - L + 0.15) < 1e-6 && Math.abs(w.b.y - L + 0.15) < 1e-6) {
      // Street face cream, the inside white: the street side is +y, the right of a → b when it runs −x.
      const streetOnLeft = w.b.x > w.a.x;
      w.sides = streetOnLeft ? { left: { finish: 'pintura', color: CREMA } } : { right: { finish: 'pintura', color: CREMA } };
    }
  }
}
for (const r of first.rooms.filter((x) => x.kind === 'balcony' && /Balcón/.test(x.name))) Object.assign(r, { railingColor: '#f4f1ea', floorMaterial: 'piedra' });
for (const r of azotea.rooms) Object.assign(r, { floorMaterial: 'concreto', edgeColor: CREMA });

// ---------- Street: sidewalk (vereda reglamentaria) and Av. Mitre ----------
const D = (a, d) => ({ x: a, y: L - d });
const drect = (a0, d0, a1, d1) => [D(a0, d0), D(a1, d0), D(a1, d1), D(a0, d1)];
const EXTERIOR = [
  ['Vereda', drect(-3, -3, 10.66, 0), 'concreto'],
  ['Av. Mitre', drect(-3, -11, 10.66, -3), 'asfalto'],
  ['Fondo del lote', drect(0, BACK + 0.225, 7.66, L), 'tierra'],
];
for (const [name, points, floorMaterial] of EXTERIOR) ground.rooms.push({ id: randomUUID(), name, kind: 'exterior', points, floorMaterial });

// ---------- Furniture (plan coordinates; n = back of the lot, s = street) ----------
const catalog = readCatalog();
const ROT = { n: 0, s: 180, w: 270, e: 90 };
const round = (v) => Math.round(v * 1000) / 1000;
let target = ground;
const piece = (type, x, y, rotation = 0, o = {}) => {
  const c = catalog.get(type);
  if (!c) throw new Error(`No existe en el catálogo: ${type}`);
  const f = {
    id: randomUUID(), type, x: round(x), y: round(y), rotation: ((rotation % 360) + 360) % 360,
    width: o.width ?? c.width, depth: o.depth ?? c.depth, height: o.height ?? c.height, elevation: o.elevation ?? c.elevation,
  };
  if (o.color) f.color = o.color;
  target.furniture.push(f);
};
const onWall = (r, side, type, at, o = {}) => {
  const d = (o.depth ?? catalog.get(type).depth) / 2 + (o.gap ?? 0);
  const pos = { n: [at, r.y0 + d], s: [at, r.y1 - d], w: [r.x0 + d, at], e: [r.x1 - d, at] }[side];
  piece(type, pos[0], pos[1], ROT[side], o);
};
const R = (floor, name) => {
  const room = floor.rooms.find((r) => r.name === name);
  if (!room) throw new Error(`No existe ${name}`);
  return interior(floor, room);
};
const mid = (r) => ({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 });

// Ground floor: shop counter and shelving, a shelf at the back of each storeroom, the bathroom.
let r = R(ground, 'Local comercial');
onWall(r, 'e', 'meson', r.y1 - 3.0, { width: 2.4 });
for (let y = r.y0 + 1.0; y < r.y1 - 5.0; y += 1.0) onWall(r, 'e', 'estanteria', y, { width: 0.9 });
for (let y = r.y0 + 1.0; y < r.y1 - 9.0; y += 1.0) onWall(r, 'w', 'estanteria', y, { width: 0.9 });
for (const room of ground.rooms.filter((x) => /^Depósito/.test(x.name))) {
  r = interior(ground, room);
  if (r.y1 - r.y0 >= 0.9) onWall(r, 'e', 'estanteria', mid(r).y, { width: Math.min(0.8, r.y1 - r.y0 - 0.1) });
}
r = R(ground, 'Baño (planta baja)');
onWall(r, 'n', 'sanitario', mid(r).x);
onWall(r, 's', 'lavamanos', mid(r).x);

// First floor: a bed (single in the narrow rooms) and a wardrobe or nightstand in every dormitorio.
target = first;
for (const room of first.rooms.filter((x) => /^Dormitorio/.test(x.name))) {
  r = interior(first, room);
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  const wide = Math.min(w, h) >= 3;
  const bed = wide ? 'cama-doble' : 'cama-sencilla';
  // Every hotel room has its door on the corridor side, so the bed goes against the opposite wall (+x).
  if (h <= w) {
    onWall(r, 'e', bed, mid(r).y);
    if (h >= 1.95 + (wide ? 0.9 : 0.5)) onWall(r, 'e', 'mesa-noche', mid(r).y + (wide ? 0.95 : 0.75));
  } else {
    onWall(r, 'e', bed, r.y0 + (wide ? 1.3 : 0.9));
    if (w >= 2.0) onWall(r, 'n', 'mesa-noche', r.x1 - 0.3);
  }
}
for (const room of first.rooms.filter((x) => /^Baño/.test(x.name))) {
  r = interior(first, room);
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  if (w >= h) {
    onWall(r, 'w', 'sanitario', mid(r).y);
    if (w >= 1.5) onWall(r, 'e', w >= 2.2 ? 'ducha' : 'lavamanos', mid(r).y);
  } else {
    onWall(r, 'n', 'sanitario', mid(r).x);
    if (h >= 1.5) onWall(r, 's', h >= 2.2 ? 'ducha' : 'lavamanos', mid(r).x, h >= 2.2 ? { width: Math.min(0.9, w - 0.1), depth: Math.min(0.9, w - 0.1) } : {});
  }
}
r = R(first, 'Cocina');
onWall(r, 'w', 'lavaplatos', r.y0 + 0.5);
onWall(r, 'w', 'estufa', r.y0 + 1.25);
onWall(r, 'w', 'nevera', r.y1 - 0.4);
r = R(first, 'Ambiente 11');
onWall(r, 'e', 'cama-sencilla', mid(r).y);
// Laundry sink in the covered stretch of the courtyard; plants and a bench in the patio.
piece('lavadero', 0.55, L - 33.9, 270);
piece('mesa-exterior', 1.0, L - 55.0, 90);
piece('matera', 3.2, L - 26.4);
piece('matera', 5.9, L - 29.3);
piece('banca', 3.6, L - 29.4, 0, { width: 1.4 });

// Second floor rooms and the terrace.
target = second;
for (const name of ['Habitación A (2º piso)', 'Habitación B (2º piso)']) {
  r = R(second, name);
  onWall(r, 's', 'cama-doble', mid(r).x);
  onWall(r, 'n', 'closet', r.x0 + 0.8);
}
r = R(second, 'Habitación C (2º piso)');
onWall(r, 'w', 'cama-sencilla', mid(r).y);
piece('matera', 3.3, L - 25.6);
piece('mesa-exterior', 4.8, L - 25.0);

// ---------- Check: nothing may sit inside a wall (same as the other examples) ----------
const FREE = /alfombra|cuadro|tira-led|espejo|televisor|cortina|jardin-vertical|arbol|pergola|porton/;
for (const floor of project.floors) {
  for (const f of floor.furniture) {
    if (FREE.test(f.type) || f.rotation % 90) continue;
    const [w, d] = f.rotation % 180 ? [f.depth, f.width] : [f.width, f.depth];
    for (let pass = 0; pass < 2; pass++) {
      for (const wl of floor.walls) {
        const t = wl.thickness / 2;
        const horizontal = Math.abs(wl.a.y - wl.b.y) < 1e-6;
        const [along, across, size, span] = horizontal ? ['x', 'y', d, w] : ['y', 'x', w, d];
        const lo = Math.min(wl.a[along], wl.b[along]);
        const hi = Math.max(wl.a[along], wl.b[along]);
        if (Math.min(hi, f[along] + span / 2) - Math.max(lo, f[along] - span / 2) <= 0.02) continue;
        const line = wl.a[across];
        if (f[across] >= line && f[across] - size / 2 < line + t) f[across] = round(line + t + size / 2);
        else if (f[across] < line && f[across] + size / 2 > line - t) f[across] = round(line - t - size / 2);
      }
    }
  }
}

writeFileSync(OUT, JSON.stringify(project, null, 2) + '\n');
execFileSync(process.execPath, [join(root, 'scripts/nuevo-id-ejemplo.mjs'), OUT], { stdio: 'inherit' });
console.log(`Listo: ${OUT}`);
