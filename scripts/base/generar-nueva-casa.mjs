// Nueva casa (2026-10-28): a 30 × 32 m site split into two 15 × 32 m lots, with a 3 m parking strip along the whole
// front. Lote 1 (right) gets Casa Papá César's programme as a modern tropical house; Lote 2 (left) is still to be
// designed. Built with the app's own operations (Playwright drives the dev server), then finished in Node.
//
//   node scripts/base/generar-nueva-casa.mjs [puerto]     (needs a dev server, default :5173)
//
// Brief (user, 2026-10-28): modern and elegant, no corridors, lots of air flow for the tropical climate, double-height
// spaces; the house only 15 m deep; the carport on the left, by Lote 2, to be shared with it. Principles taken from
// courtyard houses in hot climates: every room opens straight onto the central patio or the social space (no hall
// anywhere), each room has openings on opposite sides for cross-ventilation, double-height volumes with high windows
// let hot air out, a slatted screen (celosía) lets the breeze into the patio.
//
// Design coordinates: x 0 → 15 across Lote 1 measured from its RIGHT boundary (so the plan below reads mirrored: the
// carport, at design x 8,8–14,9, ends up on the left, against Lote 2), y 0 (street) → 32 (back). X()/Y() (and P()
// inside the page) turn them into plan coordinates for the whole site: plan x = 30 − x, plan y = 32 − y (north up).
// Layout (design metres), 1 m of lawn on both sides, the house from y 5 to y 20 (15 m):
//   y 0–3     parking; the white carport over its Lote 2 side (one car under it, the front door at its back)
//   y 5–11    one open social space: double-height cube x 1–8,8 (living room, the stair up along its back
//             wall) and the kitchen-dining room x 8,8–14; the front door opens straight into it
//   y 11–15   study x 1–4,5 · central patio x 4,5–14 · social bathroom (opening onto the kitchen-dining room) and
//             laundry x 10,5–14 (y 11–13), the patio's end behind a celosía
//   y 15–20   master suite x 1–6,6 (bedroom between the patio and the back patio, a private door to the study;
//             an L-shaped dressing room and, at the end, the bathroom with the shower, along the outer side)
//   y 15–24   piezas 1 and 2 x 6,6–14, reaching back to y 24: glass door to the patio at the front and to the back
//             patio at the back, a desk corner, each with its bathroom
//   y 20–24   the suite's private garden behind its big glass door, closed by a celosía
//   y 24–32   back patio: pool with a stone deck, then a small farm-style garden (vegetable beds, fruit trees, a
//             wooden kiosk); reached from the central patio along a stone path on the side
//   patio     wooden eaves around the central patio so you can go round it dry when it rains
//   up        a landing inside the cube, a bridge over the patio and the rooftop over bedrooms 2 and 3
//
// Casa de 7 m (user, 2026-10-29): across the street, a second 32 × 32 m block; its right-hand lot, 7 m wide, faces
// north onto the street. From the street: parking 5 × 6 m under a white carport with the pedestrian path and the
// front door on the left; the double-height open living-dining-kitchen (6 × 6 m); a patio garden with the stair to
// the rooftop, beside the pantry, guest bathroom and laundry along the party wall; then the three bedrooms in a row
// 6 m wide (two with their own bathroom, the master with a dressing room and bathroom), all reached from an
// open-air side path; rooftop over the bedrooms.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { interior, readCatalog } from '../casa-completa-muebles.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const OUT = join(root, 'public/ejemplos/nueva-casa.casa.json');
const PORT = process.argv[2] ?? '5173';
const RIGHT = 30; // plan x of Lote 1's right boundary; design x runs leftwards from it
const TOTAL = 32; // site depth

/** The family palette (user, 2026-10-27). */
const PALETA = { arena: '#E8DBD3', taupe: '#C6B1A0', oliva: '#8C8A7D', pizarra: '#495762', caramelo: '#B77E53' };

const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://localhost:${PORT}`);
await page.waitForTimeout(800);

const json = await page.evaluate(async ([RIGHT, TOTAL]) => {
  const ops = await import('/src/model/ops.ts');
  const { createEmptyProject } = await import('/src/model/defaults.ts');
  const { serializeProject } = await import('/src/persistence/projectFile.ts');
  const P = (x, y) => ({ x: Math.round((RIGHT - x) * 1e6) / 1e6 + 0, y: Math.round((TOTAL - y) * 1e6) / 1e6 + 0 });
  const Q = (x, y) => ({ x, y });
  const p = createEmptyProject('Nueva casa');
  const lengths = {};
  // Walls are stored reversed (design b → a), so an opening's offset (its centre) is measured from design point a.
  const wall = (f, a, b, t) => {
    const id = ops.addWall(p, f, P(b.x, b.y), P(a.x, a.y), t);
    if (!id) throw new Error(`muro ${JSON.stringify([a, b])}`);
    lengths[id] = Math.hypot(b.x - a.x, b.y - a.y);
    return id;
  };
  const opening = (f, kind, wallId, offset, patch = {}) => {
    const id = ops.addOpening(p, f, wallId, kind, lengths[wallId] - offset);
    if (!id) throw new Error(`no cabe ${kind} en ${offset}`);
    if (Object.keys(patch).length && !ops.updateOpening(p, f, id, { ...patch, offset: lengths[wallId] - offset })) throw new Error(`medidas de ${kind} en ${offset}`);
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
    if (kind) ops.setRoomKind(p, f, id, kind);
    Object.assign(floorOf(f).rooms.find((x) => x.id === id), extra);
    return id;
  };
  const rect = (x0, y0, x1, y1) => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];
  const poly = (...qs) => qs.map(([x, y]) => P(x, y));
  const high = { width: 0.6, sill: 1.5, height: 0.6 }; // bathroom window

  // ======================= Primer piso =======================
  const g = p.floors[0].id;
  ops.renameFloor(p, g, 'Primer piso');

  // --- Front (user's reference facade): the cube's face set back 0,6 m inside a deep slate frame, clad in vertical
  // wood with a tall window slit; the front door by a stone pillar and the kitchen's window under the white carport
  // with a wooden ceiling. ---
  opening(g, 'window', wall(g, Q(1, 5), Q(8.8, 5), 0.2), 7.1, { width: 0.7, sill: 0.3, height: 2.3 }); // ranura, mitad baja
  wall(g, Q(1, 4.4), Q(1, 5), 0.2); // marco del cubo
  wall(g, Q(8.8, 4.4), Q(8.8, 5), 0.2);
  opening(g, 'door', wall(g, Q(8.8, 5), Q(10.4, 5), 0.2), 0.8, { width: 1.1, height: 2.4 }); // puerta principal
  opening(g, 'window', wall(g, Q(10.4, 5), Q(14, 5), 0.2), 1.8, { width: 2.4, sill: 0.9, height: 1.4 }); // cocina

  // --- Sides: windows facing each other across the house so the breeze crosses it (x 1 ↔ x 14) ---
  opening(g, 'window', wall(g, Q(1, 11), Q(1, 5), 0.2), 1.6, { width: 1.2, height: 1.5 }); // sala
  opening(g, 'window', wall(g, Q(1, 15), Q(1, 11), 0.2), 2.0, { width: 1.6, height: 1.6 }); // estudio
  opening(g, 'window', wall(g, Q(1, 20), Q(1, 15), 0.2), 2.8, { width: 1.2, sill: 1.6, height: 0.5 }); // vestier y baño, alta
  opening(g, 'window', wall(g, Q(14, 5), Q(14, 11), 0.2), 3.0, { width: 2.0, sill: 1.0, height: 1.2 }); // cocina
  opening(g, 'window', wall(g, Q(14, 11), Q(14, 13), 0.2), 1.0, high); // lavandería
  opening(g, 'window', wall(g, Q(14, 15), Q(14, 19), 0.2), 0.75, { width: 0.9 }); // pieza 2
  opening(g, 'window', wall(g, Q(14, 19), Q(14, 21.8), 0.2), 1.3, { width: 1.2 }); // pieza 2, escritorio
  opening(g, 'window', wall(g, Q(14, 21.8), Q(14, 24), 0.2), 1.1, high); // baño pieza 2

  // --- Back: every bedroom also opens to the back patio, opposite its door to the patio ---
  const backSuite = wall(g, Q(6.6, 20), Q(1, 20), 0.2);
  glassDoor(g, backSuite, 1.7, { width: 2.6, height: 2.4 }); // ventanal del cuarto principal
  opening(g, 'window', backSuite, 4.5, { ...high, width: 0.8 }); // baño principal, sobre la ducha
  wall(g, Q(6.6, 20), Q(6.6, 24), 0.2); // costado de la pieza 1 hacia el jardín de la suite
  glassDoor(g, wall(g, Q(10.3, 24), Q(6.6, 24), 0.2), 0.95, { width: 1.2 }); // pieza 1 → patio trasero
  glassDoor(g, wall(g, Q(14, 24), Q(10.3, 24), 0.2), 2.75, { width: 1.2 }); // pieza 2 → patio trasero

  // --- Social zone: one open space, no hall. The front door opens straight into it: the double-height cube (living
  // room, the stair rising along its back wall) and the kitchen-dining room beside it with no wall between them. ---
  const cubeBack = wall(g, Q(1, 11), Q(8.8, 11)); // cubo | estudio y patio
  opening(g, 'door', cubeBack, 0.8, { width: 1.0 }); // sala → estudio
  glassDoor(g, cubeBack, 6.8, { width: 1.4, height: 2.4 }); // sala ↔ patio, under the landing
  const kitchenBack = wall(g, Q(8.8, 11), Q(14, 11)); // cocina | patio y servicios
  glassDoor(g, kitchenBack, 0.85, { width: 1.0 }); // cocina → patio
  opening(g, 'door', kitchenBack, 2.55, { width: 0.7 }); // comedor → baño social

  // --- Around the patio every room opens straight onto it ---
  const studyPatio = wall(g, Q(4.5, 11), Q(4.5, 15)); // estudio | patio
  glassDoor(g, studyPatio, 1.5, { width: 1.0 });
  opening(g, 'window', studyPatio, 3.2, { width: 1.0 });
  wall(g, Q(10.5, 11), Q(10.5, 13)); // patio | baño social
  wall(g, Q(12.2, 11), Q(12.2, 13)); // baño social | lavandería
  opening(g, 'door', wall(g, Q(10.5, 13), Q(14, 13)), 2.6, { width: 0.8 }); // patio → lavandería

  // --- Master suite (x 1–6,6, y 15–20), single height: the bedroom (x 3,2–6,6) opens to the patio at the front, to
  // the back patio through the big glass door, and privately to the study. Along the outer side, from the bedroom:
  // an L-shaped walk-in dressing room, then the bathroom at the end with the shower (no tub). ---
  opening(g, 'door', wall(g, Q(1, 15), Q(4.5, 15)), 2.9, { width: 0.8 }); // estudio | vestier y cuarto: puerta privada
  glassDoor(g, wall(g, Q(4.5, 15), Q(6.6, 15)), 1.05, { width: 1.8, height: 2.4 }); // cuarto principal ↔ patio
  opening(g, 'door', wall(g, Q(3.2, 15), Q(3.2, 17.6)), 0.8, { width: 0.75 }); // dormitorio → vestier
  wall(g, Q(3.2, 17.6), Q(3.2, 20));
  opening(g, 'door', wall(g, Q(1, 17.6), Q(3.2, 17.6)), 1.65, { width: 0.7 }); // vestier → baño principal
  wall(g, Q(6.6, 15), Q(6.6, 20)); // cuarto principal | pieza 1 (the TV hangs here)

  // --- Piezas 1 and 2 (x 6,6–10,3 and 10,3–14, y 15–24): glass door to the patio at the front and to the back
  // patio at the back, closets along the outer wall, a desk corner, bathroom in the back corner ---
  const p1Front = wall(g, Q(6.6, 15), Q(10.3, 15));
  glassDoor(g, p1Front, 0.8, { width: 1.0 }); // pieza 1 ↔ patio
  opening(g, 'window', p1Front, 2.7, { width: 1.2 });
  const p2Front = wall(g, Q(10.3, 15), Q(14, 15));
  glassDoor(g, p2Front, 1.0, { width: 1.0 }); // pieza 2 ↔ patio
  opening(g, 'window', p2Front, 2.7, { width: 1.2 });
  wall(g, Q(10.3, 15), Q(10.3, 24)); // pieza 1 | pieza 2
  wall(g, Q(8.4, 21.8), Q(8.4, 24));
  opening(g, 'door', wall(g, Q(6.6, 21.8), Q(8.4, 21.8)), 0.9, { width: 0.7 }); // pieza 1 → su baño
  wall(g, Q(12.2, 21.8), Q(12.2, 24));
  opening(g, 'door', wall(g, Q(12.2, 21.8), Q(14, 21.8)), 0.9, { width: 0.7 }); // pieza 2 → su baño

  room(g, rect(1, 5, 14, 11), 'Sala-comedor-cocina');
  room(g, rect(1, 11, 4.5, 15), 'Estudio');
  room(g, rect(10.5, 11, 12.2, 13), 'Baño social');
  room(g, rect(12.2, 11, 14, 13), 'Lavandería');
  room(g, rect(1, 15, 3.2, 17.6), 'Vestier');
  room(g, rect(1, 17.6, 3.2, 20), 'Baño principal');
  room(g, rect(3.2, 15, 6.6, 20), 'Cuarto principal');
  room(g, poly([6.6, 15], [10.3, 15], [10.3, 24], [8.4, 24], [8.4, 21.8], [6.6, 21.8]), 'Pieza 1');
  room(g, rect(6.6, 21.8, 8.4, 24), 'Baño pieza 1');
  room(g, poly([10.3, 15], [14, 15], [14, 21.8], [12.2, 21.8], [12.2, 24], [10.3, 24]), 'Pieza 2');
  room(g, rect(12.2, 21.8, 14, 24), 'Baño pieza 2');
  // The suite's private garden behind its big glass door, closed by a 2 m celosía (edges 2, 4 and 5) with a 1 m
  // opening (edge 3) out to the pool deck; the suite and pieza 1 walls close the other two sides.
  room(g, poly([1, 20], [6.6, 20], [6.6, 24], [2.6, 24], [1.6, 24], [1, 24]), 'Jardín privado de la suite', 'balcony',
    { openEdges: [0, 1, 3], railing: 'celosia' });
  // Central patio, open to the sky in the middle; a wooden-slat screen (celosía) on its end towards the lot's side
  // (edge 3) lets the breeze in and hides the drying corner by the laundry; beside it (edge 4) the way out to the
  // side path to the back patio.
  room(g, poly([4.5, 11], [10.5, 11], [10.5, 13], [14, 13], [14, 14], [14, 15], [4.5, 15]),
    'Patio central', 'balcony', { openEdges: [0, 1, 2, 4, 5, 6], railing: 'celosia' });
  // Wooden treads with a glass railing along the cube's back wall, rising towards the landing (x 7–8,6).
  room(g, rect(3, 9.8, 7, 11), 'Escalera (madera y vidrio)', 'stairs', { up: 'e', glass: true });

  // ======================= Rooftop =======================
  // The double-height social cube carries on up this level; its high windows on opposite sides let the hot air out
  // (stack effect). From the stair's landing inside the cube a glass door leads onto a bridge over the patio and the
  // rooftop over piezas 1 and 2.
  const t = ops.addFloor(p);
  ops.renameFloor(p, t, 'Rooftop');
  opening(t, 'window', wall(t, Q(1, 5), Q(8.8, 5), 0.2), 7.1, { width: 0.7, sill: 0, height: 2.2 }); // ranura, mitad alta
  wall(t, Q(1, 4.4), Q(1, 5), 0.2);
  wall(t, Q(8.8, 4.4), Q(8.8, 5), 0.2);
  opening(t, 'window', wall(t, Q(1, 11), Q(1, 5), 0.2), 3.0, { width: 1.6, sill: 0.6, height: 1.4 }); // alta, lateral
  opening(t, 'window', wall(t, Q(8.8, 5), Q(8.8, 11), 0.2), 2.6, { width: 3.0, sill: 0.6, height: 1.4 }); // alta, sobre la cocina
  const cubeBackUp = wall(t, Q(1, 11), Q(8.8, 11), 0.2);
  opening(t, 'window', cubeBackUp, 3.0, { width: 3.0, sill: 0.6, height: 1.4 }); // alta, al patio
  glassDoor(t, cubeBackUp, 6.6, { width: 0.9 }); // descanso → puente
  ops.setRoofHeight(p, t, room(t, rect(1, 4.4, 8.8, 11), 'Techo del cubo', 'roof'), 2.6);
  // Landing (x 7–8,6, y 9,8–11) + bridge over the patio (x 7–8,2) + deck over piezas 1 and 2.
  // Open where the stair arrives (edge 10) and at the cube's wall (edge 2); glass railing elsewhere.
  room(t, poly([7, 9.8], [8.6, 9.8], [8.6, 11], [8.2, 11], [8.2, 15], [14, 15], [14, 24], [6.6, 24], [6.6, 15], [7, 15], [7, 11]),
    'Rooftop', 'balcony', { openEdges: [2, 10], railing: 'vidrio', floorMaterial: 'madera' });
  // Solid roofs over the one-storey parts, and the carport over the entrance and the driveway.
  const roofs = [
    ['Pórtico del parqueadero', rect(8.8, 0, 14.9, 5)],
    ['Cubierta de la cocina', rect(8.8, 5, 14, 11)],
    ['Cubierta del estudio', rect(1, 11, 4.5, 15)],
    ['Cubierta de servicios', rect(10.5, 11, 14, 13)],
    ['Cubierta de la suite', rect(1, 15, 6.6, 20)],
    // Eaves 1 m deep around the central patio (the bridge covers its own strip), so you can go round it dry.
    ['Alero del patio (lado del estudio)', poly([4.5, 11], [7, 11], [7, 12], [5.5, 12], [5.5, 14], [7, 14], [7, 15], [4.5, 15])],
    ['Alero del patio (lado de la cocina)', poly([8.2, 11], [10.5, 11], [10.5, 13], [14, 13], [14, 15], [8.2, 15], [8.2, 14], [9.5, 14], [9.5, 12], [8.2, 12])],
  ];
  for (const [name, pts] of roofs) ops.setRoofHeight(p, t, room(t, pts, name, 'roof'), 0.001);

  // ======================= Casa de 7 m (block across the street) =======================
  // Lot coordinates: a 0 → 7 across the lot from its left side seen from the street (plan x = 30 − a), d 0 (street)
  // → 32 (back), plan y = 42 + d. The lot faces north, onto the same street as the first block.
  const N = (a, d) => ({ x: 30 - a, y: 42 + d });
  const wall7 = (f, [a0, d0], [a1, d1], th) => {
    const id = ops.addWall(p, f, N(a1, d1), N(a0, d0), th);
    if (!id) throw new Error(`muro 7 m ${JSON.stringify([a0, d0, a1, d1])}`);
    lengths[id] = Math.hypot(a1 - a0, d1 - d0);
    return id;
  };
  const rect7 = (a0, d0, a1, d1) => [N(a0, d0), N(a1, d0), N(a1, d1), N(a0, d1)];
  const poly7 = (...qs) => qs.map(([a, d]) => N(a, d));

  // Front d 6: the front door on the left (by the pedestrian path), a big window onto the forecourt.
  const front7 = wall7(g, [1, 6], [7, 6], 0.2);
  opening(g, 'door', front7, 0.6, { width: 1.0, height: 2.4 }); // puerta principal
  opening(g, 'window', front7, 4.4, { width: 3.2, sill: 0.4, height: 2.0 });
  // Left side a 1, onto the open-air side path that runs the whole house: windows and doors for the breeze.
  const side7a = wall7(g, [1, 6], [1, 12], 0.2);
  opening(g, 'window', side7a, 1.5, { width: 1.6, sill: 0.6, height: 1.6 });
  glassDoor(g, side7a, 4.3, { width: 1.4, height: 2.4 });
  // Right side a 7: the party wall with the neighbouring lot, blind.
  for (const [d0, d1] of [[6, 12], [12, 18], [18, 22], [22, 26], [26, 31]]) wall7(g, [7, d0], [7, d1], 0.2);
  // Back of the social space d 12: glass door to the patio garden, door to the pantry behind the kitchen.
  const back7 = wall7(g, [1, 12], [7, 12]);
  glassDoor(g, back7, 2.4, { width: 2.0, height: 2.4 });
  opening(g, 'door', back7, 4.1, { width: 0.8 }); // cocina → alacena
  // Services along the party wall (a 4,6–7): pantry, guest bathroom, laundry.
  const serv7 = wall7(g, [4.6, 12], [4.6, 18]);
  opening(g, 'door', serv7, 2.8, { width: 0.7 }); // patio → baño de visitas
  opening(g, 'door', serv7, 4.9, { width: 0.9 }); // patio → zona de lavado
  wall7(g, [4.6, 13.8], [7, 13.8]);
  wall7(g, [4.6, 15.8], [7, 15.8]);
  // The three bedrooms in a row (a 1–7), each with its door and window onto the side path.
  const hab2Front = wall7(g, [1, 18], [7, 18]);
  opening(g, 'window', hab2Front, 2.4, { width: 1.6 }); // habitación 2 → patio
  for (const [d0, d1] of [[18, 22], [22, 26]]) {
    const s = wall7(g, [1, d0], [1, d1], 0.2);
    opening(g, 'door', s, 0.8, { width: 0.9 });
    opening(g, 'window', s, 2.6, { width: 1.6 });
  }
  const sideMaster = wall7(g, [1, 26], [1, 31], 0.2);
  opening(g, 'door', sideMaster, 0.8, { width: 0.9 });
  opening(g, 'window', sideMaster, 3.0, { width: 1.6 });
  wall7(g, [1, 22], [7, 22]);
  wall7(g, [1, 26], [7, 26]);
  for (const d0 of [18, 22]) {
    wall7(g, [5.2, d0 + 2], [7, d0 + 2]);
    opening(g, 'door', wall7(g, [5.2, d0 + 2], [5.2, d0 + 4]), 1.0, { width: 0.7 }); // habitación → su baño
  }
  // Master: bedroom a 1–4,4, then the dressing room and its bathroom along the party wall; big glass door at the
  // back onto a small garden.
  opening(g, 'door', wall7(g, [4.4, 26], [4.4, 28.4]), 1.2, { width: 0.8 }); // habitación → vestier
  wall7(g, [4.4, 28.4], [4.4, 31]);
  opening(g, 'door', wall7(g, [4.4, 28.4], [7, 28.4]), 1.3, { width: 0.7 }); // vestier → baño
  const backMaster = wall7(g, [1, 31], [7, 31], 0.2);
  glassDoor(g, backMaster, 1.7, { width: 2.2, height: 2.4 });
  opening(g, 'window', backMaster, 4.9, high);

  room(g, rect7(1, 6, 7, 12), 'Monoambiente (sala, comedor y cocina)');
  room(g, rect7(4.6, 12, 7, 13.8), 'Alacena');
  room(g, rect7(4.6, 13.8, 7, 15.8), 'Baño de visitas');
  room(g, rect7(4.6, 15.8, 7, 18), 'Zona de lavado');
  room(g, poly7([1, 18], [7, 18], [7, 20], [5.2, 20], [5.2, 22], [1, 22]), 'Habitación 2');
  room(g, rect7(5.2, 20, 7, 22), 'Baño habitación 2');
  room(g, poly7([1, 22], [7, 22], [7, 24], [5.2, 24], [5.2, 26], [1, 26]), 'Habitación 1');
  room(g, rect7(5.2, 24, 7, 26), 'Baño habitación 1');
  room(g, rect7(1, 26, 4.4, 31), 'Habitación principal');
  room(g, rect7(4.4, 26, 7, 28.4), 'Vestier principal');
  room(g, rect7(4.4, 28.4, 7, 31), 'Baño habitación principal');
  // Patio garden between the social space and the bedrooms, open to the sky and to the side path.
  room(g, rect7(1, 12, 4.6, 18), 'Patio jardín', 'balcony', { openEdges: [0, 1, 2, 3], railing: 'celosia' });
  // Side path a 0–1 from the front door to the back garden, open to the sky; a 2 m celosía on the lot's edge.
  room(g, rect7(0, 6, 1, 31), 'Sendero lateral', 'balcony', { openEdges: [0, 1, 2], railing: 'celosia' });
  room(g, rect7(1.1, 12.4, 2.2, 16.6), 'Escalera al rooftop', 'stairs', { up: 'n', glass: true });

  // Upper level: the double-height social space with high windows front, side and back (hot air out); the stair
  // lands by the services roof and leads onto the rooftop over the three bedrooms.
  opening(t, 'window', wall7(t, [1, 6], [7, 6], 0.2), 3.0, { width: 4.0, sill: 0.6, height: 1.4 });
  opening(t, 'window', wall7(t, [1, 6], [1, 12], 0.2), 3.0, { width: 3.0, sill: 0.6, height: 1.4 });
  wall7(t, [7, 6], [7, 12], 0.2);
  opening(t, 'window', wall7(t, [1, 12], [7, 12], 0.2), 3.6, { width: 3.0, sill: 0.6, height: 1.4 });
  ops.setRoofHeight(p, t, room(t, rect7(1, 6, 7, 12), 'Techo del monoambiente', 'roof'), 2.6);
  room(t, poly7([1, 16.6], [2.2, 16.6], [2.2, 18], [7, 18], [7, 31], [1, 31]), 'Rooftop (casa 7 m)', 'balcony',
    { openEdges: [0], railing: 'vidrio', floorMaterial: 'madera' });
  const roofs7 = [
    ['Pórtico del parqueadero (casa 7 m)', rect7(2, 0, 7, 6)],
    ['Cubierta de servicios (casa 7 m)', rect7(4.6, 12, 7, 18)],
    ['Alero del sendero', rect7(0, 6, 1, 31)],
  ];
  for (const [name, pts] of roofs7) ops.setRoofHeight(p, t, room(t, pts, name, 'roof'), 0.001);

  return serializeProject(p);
}, [RIGHT, TOTAL]);
await browser.close();
if (errors.length) throw new Error(errors.join('\n'));

const project = JSON.parse(json);
project.id = randomUUID();
const [ground, rooftop] = project.floors;
const X = (x) => RIGHT - x;
const Y = (y) => TOTAL - y;
const pt = (x, y) => ({ x: X(x), y: Y(y) });
/** Back to design coordinates (the mapping is its own inverse). */
const design = (q) => ({ x: X(q.x), y: Y(q.y) });

// ---------- Finishes: sand inside and out; the cube in slate framing a wooden face; a stone pillar by the front
// door ----------
function pointInPolygon(q, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
const enclosed = ground.rooms.filter((r) => r.kind === 'room');
const CUBE = [pt(1, 5), pt(8.8, 5), pt(8.8, 11), pt(1, 11)];
const near = (a, b) => Math.abs(a - b) < 1e-6;
const BLANCO = '#EEEAE4';
/** A wall in design coordinates: its x and y ranges. */
const span = (w) => {
  const [a, b] = [design(w.a), design(w.b)];
  return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) };
};
// The cube's face (y 5) is clad in wood; its frame fins (y 4,4–5) are slate on both sides.
const onFrame = (s) => near(s.y0, 5) && near(s.y1, 5) && s.x0 > 0.9 && s.x1 < 8.9;
const isFin = (s) => s.y0 < 4.99 && near(s.x0, s.x1) && (near(s.x0, 1) || near(s.x0, 8.8));
const onCube = (s) => s.x0 > 0.99 && s.x1 < 8.81 && s.y0 > 4.99 && s.y1 < 11.01 && (near(s.x0, s.x1) ? near(s.x0, 1) : near(s.y0, 5));
const faceOf = (w, side) => {
  const dx = w.b.x - w.a.x;
  const dy = w.b.y - w.a.y;
  const l = Math.hypot(dx, dy);
  const off = w.thickness / 2 + 0.05;
  return { x: (w.a.x + w.b.x) / 2 + (-dy / l) * side * off, y: (w.a.y + w.b.y) / 2 + (dx / l) * side * off };
};
/** The house across the street (plan y > 40) has its own finishes, below. */
const inBlock2 = (w) => w.a.y > 40;
for (const w of rooftop.walls) {
  if (inBlock2(w)) continue;
  const s = span(w);
  const face = (side) => {
    const q = faceOf(w, side);
    if (pointInPolygon(q, CUBE)) return { finish: 'pintura', color: PALETA.arena };
    if (isFin(s)) return { finish: 'pintura', color: PALETA.pizarra };
    return onFrame(s) ? { finish: 'madera' } : { finish: 'pintura', color: PALETA.pizarra };
  };
  w.sides = { left: face(1), right: face(-1) };
}
for (const w of ground.walls) {
  if (inBlock2(w)) continue;
  const s = span(w);
  const face = (side) => {
    const q = faceOf(w, side);
    if (enclosed.some((r) => pointInPolygon(q, r.points))) return { finish: 'pintura', color: PALETA.arena };
    if (isFin(s)) return { finish: 'pintura', color: PALETA.pizarra };
    const front = near(s.y0, 5) && near(s.y1, 5) && design(q).y < 5;
    if (front && s.x0 > 8.7 && s.x1 < 10.5) return { finish: 'piedra' };
    if (front && s.x0 > 10.3) return { finish: 'pintura', color: PALETA.pizarra };
    if (onFrame(s)) return { finish: 'madera' };
    if (onCube(s)) return { finish: 'pintura', color: PALETA.pizarra };
    return { finish: 'pintura', color: PALETA.arena };
  };
  w.sides = { left: face(1), right: face(-1) };
}
// Casa de 7 m: sand inside; the street face in wood (as the first house's cube), the upper box in slate.
for (const floor of [ground, rooftop]) {
  for (const w of floor.walls.filter(inBlock2)) {
    const front = near(w.a.y, 48) && near(w.b.y, 48);
    const face = (side) => {
      const q = faceOf(w, side);
      if (enclosed.some((r) => pointInPolygon(q, r.points)) || (floor === rooftop && q.x > 23 && q.x < 29 && q.y > 48 && q.y < 54)) return { finish: 'pintura', color: PALETA.arena };
      if (front) return { finish: 'madera' };
      return floor === rooftop ? { finish: 'pintura', color: PALETA.pizarra } : { finish: 'pintura', color: PALETA.arena };
    };
    w.sides = { left: face(1), right: face(-1) };
  }
}
const MATERIAL = [[/baño|ducha|sanitario|lavander|lavado/i, 'ceramica'], [/patio|jardín/i, 'cesped']];
for (const r of ground.rooms) {
  if (r.kind === 'roof' || r.kind === 'stairs') continue;
  r.floorMaterial = MATERIAL.find(([re]) => re.test(r.name))?.[1] ?? 'porcelanato';
}
ground.rooms.find((r) => r.name === 'Sendero lateral').floorMaterial = 'piedra';
for (const r of ground.rooms) if (r.railing === 'celosia') r.railingColor = PALETA.caramelo;
for (const r of rooftop.rooms) if (r.name.startsWith('Rooftop')) r.railingColor = PALETA.pizarra;
// Solid roofs: the cube's lid and frame in slate, sand over the rest; the carport white
// with a wooden ceiling.
const ROOFS = {
  'Techo del cubo': PALETA.pizarra, 'Cubierta de la suite': PALETA.arena, 'Cubierta de la cocina': PALETA.arena,
  'Cubierta del estudio': PALETA.arena, 'Cubierta de servicios': PALETA.arena,
  'Techo del monoambiente': PALETA.pizarra, 'Cubierta de servicios (casa 7 m)': PALETA.arena,
};
for (const [name, edgeColor] of Object.entries(ROOFS)) Object.assign(rooftop.rooms.find((r) => r.name === name), { floorMaterial: 'concreto', edgeColor });
for (const r of rooftop.rooms) if (r.name.startsWith('Pórtico')) Object.assign(r, { floorMaterial: 'madera', edgeColor: BLANCO });
for (const r of rooftop.rooms) if (r.name.startsWith('Alero')) Object.assign(r, { floorMaterial: 'madera', edgeColor: PALETA.caramelo });

// ---------- Site: parking strip, gardens, back patio, Lote 2, sidewalk and street ----------
/** A point of the 7 m lot (a across from its left side seen from the street, d from the street) in plan. */
const lot7 = (a, d) => ({ x: 30 - a, y: 42 + d });
const drect = (x0, y0, x1, y1) => [pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1)];
/** A rectangle straight in plan coordinates (Lote 2 and the street). */
const prect = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const EXTERIOR = [
  ['Parqueadero lote 1', drect(0, 0, 15, 3), 'porcelanato'],
  ['Parqueadero lote 2', prect(0, TOTAL - 3, 15, TOTAL), 'porcelanato'],
  ['Lote 2 (por diseñar)', prect(0, 0, 15, TOTAL - 3), 'tierra'],
  ['Jardín del frente', drect(0, 3, 8.8, 5), 'cesped'],
  ['Acceso bajo el pórtico', drect(8.8, 3, 15, 5), 'porcelanato'],
  ['Césped lateral derecho', drect(0, 5, 1, 20), 'cesped'],
  ['Césped lateral izquierdo', drect(14, 5, 15, 13), 'cesped'],
  ['Sendero lateral al patio trasero', drect(14, 13, 15, 24), 'piedra'],
  ['Patio trasero (lado derecho)', drect(0, 20, 1, 24), 'cesped'],
  ['Deck de la piscina', drect(0, 24, 15, 28.6), 'piedra'],
  ['Granjita', drect(0, 28.6, 15, 32), 'cesped'],
  ['Andén', prect(-3, TOTAL, 31, TOTAL + 1.5), 'concreto'],
  ['Calle', prect(-3, TOTAL + 1.5, 31, TOTAL + 8.5), 'asfalto'],
  // Block across the street (32 × 32 m, plan x −2 → 30, y 42 → 74): the 7 m house on its right, the rest to design.
  ['Andén (manzana del frente)', prect(-3, TOTAL + 8.5, 31, 42), 'concreto'],
  ['Lote vecino (por diseñar)', prect(-2, 42, 23, 74), 'tierra'],
  ['Parqueadero (casa 7 m)', [lot7(2, 0), lot7(7, 0), lot7(7, 6), lot7(2, 6)], 'porcelanato'],
  ['Acceso peatonal (casa 7 m)', [lot7(0, 0), lot7(2, 0), lot7(2, 6), lot7(0, 6)], 'piedra'],
  ['Jardín del fondo (casa 7 m)', [lot7(0, 31), lot7(7, 31), lot7(7, 32), lot7(0, 32)], 'cesped'],
];
for (const [name, points, floorMaterial] of EXTERIOR) ground.rooms.push({ id: randomUUID(), name, kind: 'exterior', points, floorMaterial });

// ---------- Furniture (design coordinates through X()/Y(); the plan is mirrored, so e/w sides and rotations are
// mirrored too: "e" below means the design's x 14 side) ----------
const catalog = readCatalog();
const ROT = { n: 0, s: 180, w: 270, e: 90 };
const MIRROR_SIDE = { e: 'w', w: 'e', n: 'n', s: 's' };
const round = (v) => Math.round(v * 1000) / 1000;
let target = ground;
const place = (type, x, y, rotation = 0, o = {}) => {
  const c = catalog.get(type);
  if (!c) throw new Error(`No existe en el catálogo: ${type}`);
  const f = {
    id: randomUUID(), type, x: round(x), y: round(y), rotation: ((rotation % 360) + 360) % 360,
    width: o.width ?? c.width, depth: o.depth ?? c.depth, height: o.height ?? c.height, elevation: o.elevation ?? c.elevation,
  };
  if (o.color) f.color = o.color;
  target.furniture.push(f);
};
/** A piece at plan point (x, y), rotated as in the design (mirrored here). */
const piece = (type, x, y, rotation = 0, o = {}) => place(type, x, y, 360 - rotation, o);
/** Back against the design wall `side` of the room, centred at plan coordinate `at` along it. */
const onWall = (r, side, type, at, o = {}) => {
  const s = MIRROR_SIDE[side];
  const d = (o.depth ?? catalog.get(type).depth) / 2 + (o.gap ?? 0);
  const pos = { n: [at, r.y0 + d], s: [at, r.y1 - d], w: [r.x0 + d, at], e: [r.x1 - d, at] }[s];
  place(type, pos[0], pos[1], ROT[s], o);
};
const R = (name) => interior(ground, ground.rooms.find((r) => r.name === name));
const { arena, taupe, oliva, pizarra, caramelo } = PALETA;

// Social space: living room under the double height facing a 70" TV on the side wall,
// the wooden stair along the cube's back wall; kitchen along the far wall and the dining table beside it.
let r = R('Sala-comedor-cocina');
onWall(r, 'w', 'mueble-tv', Y(7.0), { width: 2.0, color: oliva });
onWall(r, 'w', 'televisor-70', Y(7.0), { gap: 0.02 });
piece('alfombra', X(3.0), Y(7.0), 90, { width: 2.6, depth: 2.0, color: arena });
piece('mesa-centro', X(3.0), Y(7.0), 90, { color: caramelo });
piece('sofa-l', X(4.6), Y(7.0), 90, { color: taupe });
piece('sillon', X(2.4), Y(5.6), 180, { color: pizarra });
piece('lampara-pie', X(5.7), Y(8.6));
onWall(r, 'e', 'nevera', Y(10.5));
onWall(r, 'e', 'meson', Y(9.5), { color: arena });
onWall(r, 'e', 'lavaplatos', Y(8.5), { color: arena });
onWall(r, 'e', 'estufa', Y(7.8));
onWall(r, 'e', 'meson', Y(6.9), { color: arena });
onWall(r, 'e', 'alacena', Y(6.9), { width: 1.2, color: oliva, elevation: 1.5 });
piece('mesa-comedor-6', X(11.0), Y(8.9), 0, { color: caramelo });
for (const x of [10.45, 11.0, 11.55]) {
  piece('silla-comedor', X(x), Y(8.9) - 0.85, 0, { color: pizarra });
  piece('silla-comedor', X(x), Y(8.9) + 0.85, 180, { color: pizarra });
}
piece('matera-alta', X(10.8), Y(5.5), 0, { color: oliva });

r = R('Estudio');
onWall(r, 'w', 'escritorio', Y(13.0), { color: caramelo });
piece('silla-oficina', X(2.1), Y(13.0), 90);
onWall(r, 'n', 'estanteria', X(2.6), { color: caramelo });
piece('sillon', X(3.7), Y(11.7), 180, { color: taupe });

r = R('Baño social');
onWall(r, 'n', 'sanitario', X(11.0));
onWall(r, 'w', 'lavamanos', Y(11.6));
onWall(r, 'w', 'espejo', Y(11.6), { width: 0.5 });

r = R('Lavandería');
onWall(r, 'e', 'lavadero', Y(11.5));
onWall(r, 'e', 'lavadora', Y(12.3));

// Master bedroom: bed against the dressing-room wall, the 70" TV facing it, glass to the patio and to the back.
r = R('Cuarto principal');
const bed = Y(17.9);
piece('alfombra', X(4.7), bed, 90, { width: 2.6, depth: 2.2, color: taupe });
onWall(r, 'w', 'cama-king', bed, { color: arena });
onWall(r, 'w', 'mesa-noche', bed - 1.225, { color: caramelo });
onWall(r, 'w', 'mesa-noche', bed + 1.225, { color: caramelo });
onWall(r, 'w', 'cuadro-abstracto', bed, { width: 1.4, height: 0.7, elevation: 1.3, color: caramelo });
onWall(r, 'e', 'mueble-tv', bed, { color: oliva });
onWall(r, 'e', 'televisor-70', bed, { gap: 0.02 });
onWall(r, 'n', 'cortina', X(3.75), { width: 0.9, color: arena });
onWall(r, 'n', 'cortina', X(6.05), { width: 0.9, color: arena });

// L-shaped walk-in dressing room (x 1–3,2, y 15–17,6): walnut modules along the front and the outer wall; the
// master bathroom beyond it, at the end, with the shower under the high back window.
r = R('Vestier');
onWall(r, 's', 'vestier-colgar', X(1.6));
onWall(r, 'w', 'vestier-cajones', Y(16.15));
onWall(r, 'w', 'vestier-zapatos', Y(17.0));
onWall(r, 'e', 'espejo-cuerpo', Y(17.0), { width: 0.5 });
piece('puf', X(2.4), Y(16.6), 0, { color: caramelo });
r = R('Baño principal');
onWall(r, 'n', 'ducha', X(1.5));
onWall(r, 'w', 'sanitario', Y(18.3));
onWall(r, 'e', 'lavamanos', Y(19.0), { color: caramelo });
onWall(r, 'e', 'espejo', Y(19.0), { width: 0.6 });
onWall(r, 's', 'toallero', X(1.6));

// Piezas 1 and 2: bed against the shared wall, two closets on the outer wall, art over the bed; the bathroom in the
// back corner with shower, toilet and basin.
r = R('Pieza 1');
onWall(r, 'e', 'cama-doble', Y(17.2), { color: arena });
onWall(r, 'e', 'mesa-noche', Y(17.2) - 0.925, { color: caramelo });
onWall(r, 'e', 'mesa-noche', Y(17.2) + 0.925, { color: caramelo });
onWall(r, 'e', 'cuadro-byn', Y(16.85), { elevation: 1.3, color: caramelo });
onWall(r, 'e', 'cuadro-byn', Y(17.55), { elevation: 1.3, color: caramelo });
onWall(r, 'w', 'closet', Y(16.6), { color: taupe });
onWall(r, 'w', 'closet', Y(17.8), { color: taupe });
piece('alfombra', X(8.9), Y(17.2), 90, { width: 2.0, depth: 1.2, color: arena });
onWall(r, 'w', 'escritorio', Y(20.3), { color: caramelo });
piece('silla-oficina', X(7.75), Y(20.3), 90);
piece('sillon', X(9.6), Y(21.3), 0, { color: pizarra });

r = R('Baño pieza 1');
onWall(r, 'n', 'ducha', X(7.05));
onWall(r, 'e', 'sanitario', Y(23.5));
onWall(r, 'w', 'lavamanos', Y(22.4));

r = R('Pieza 2');
onWall(r, 'w', 'cama-doble', Y(17.2), { color: arena });
onWall(r, 'w', 'mesa-noche', Y(17.2) - 0.925, { color: caramelo });
onWall(r, 'w', 'mesa-noche', Y(17.2) + 0.925, { color: caramelo });
onWall(r, 'w', 'cuadro-paisaje', Y(17.2), { width: 1.1, height: 0.6, elevation: 1.25, color: caramelo });
onWall(r, 'e', 'closet', Y(16.9), { color: taupe });
onWall(r, 'e', 'closet', Y(18.1), { color: taupe });
piece('alfombra', X(11.7), Y(17.2), 90, { width: 2.0, depth: 1.2, color: taupe });
onWall(r, 'e', 'escritorio', Y(20.3), { color: caramelo });
piece('silla-oficina', X(12.85), Y(20.3), 270);
piece('sillon', X(11.0), Y(21.3), 0, { color: pizarra });

r = R('Baño pieza 2');
onWall(r, 'n', 'ducha', X(13.5));
onWall(r, 'w', 'sanitario', Y(23.5));
onWall(r, 'e', 'lavamanos', Y(22.4));


// Central patio: a tree in the lawn, a bench along the study, plants; the drying corner behind the celosía.
piece('arbol-pequeno', X(6.6), Y(13.0));
piece('banca', X(4.85), Y(13.2), 270, { width: 1.2, color: caramelo });
piece('jardinera', X(9.3), Y(11.35), 0, { width: 1.6, color: oliva });
piece('sillon-exterior', X(9.4), Y(13.6), 270, { color: pizarra });
piece('arbusto', X(13.4), Y(14.4));

// The suite's private garden: a tree, shrubs and a planter along the celosía, a bench to sit out; the way out to
// the pool deck stays clear (x 1,6–2,6).
piece('arbol-pequeno', X(1.7), Y(21.3));
piece('arbusto', X(5.8), Y(23.3));
piece('jardinera', X(4.1), Y(23.6), 0, { width: 2.0, color: oliva });
piece('banca', X(5.6), Y(21.3), 0, { width: 1.2, color: caramelo });

// Back patio: the pool on a stone deck with loungers and an umbrella, then the small farm-style garden: vegetable
// beds, fruit trees, a wooden kiosk with a table, benches and planters.
piece('piscina', X(7.5), Y(27.0), 0, { width: 8.0, depth: 3.0, height: 0.45, color: arena });
for (const x of [4.7, 6.9]) piece('asoleadora', X(x), Y(24.8), 90, { color: arena });
piece('sombrilla', X(13.0), Y(27.6), 0, { color: arena });
piece('asoleadora', X(13.0), Y(26.3), 270, { color: arena });
piece('matera-alta', X(1.4), Y(26.3), 0, { color: oliva });
piece('pergola', X(12.4), Y(30.4), 0, { width: 3.4, depth: 2.8, color: caramelo }); // kiosko
piece('mesa-exterior', X(12.4), Y(30.4), 0, { color: caramelo });
for (const x of [1.6, 3.6, 5.6, 7.6]) {
  piece('jardinera', X(x), Y(29.6), 0, { color: caramelo }); // huerta
  piece('jardinera', X(x), Y(30.8), 0, { color: caramelo });
}
piece('arbol-pequeno', X(1.5), Y(31.2));
piece('arbol-pequeno', X(9.6), Y(31.0));
piece('banca', X(9.6), Y(29.3), 0, { width: 1.4, color: caramelo });
piece('matera', X(10.6), Y(29.3), 0, { color: oliva });

// Front (reference facade): long slate planters with tropical plants in front of the wooden cube, a wall light on
// the wood, warm LED lines in the carport's wooden ceiling; one car under the carport nose to the street, another
// car and a motorbike along the street in front of the cube.
piece('jardinera', X(2.2), Y(3.75), 0, { color: pizarra });
piece('jardinera', X(4.1), Y(3.75), 0, { color: pizarra });
piece('jardinera', X(6.0), Y(3.75), 0, { color: pizarra });
piece('arbusto', X(7.6), Y(3.8));
piece('arbusto', X(0.55), Y(3.6));
piece('tira-led', X(7.6), Y(5) + 0.11, 0, { width: 0.25, elevation: 2.0, color: '#ffd9a0' }); // aplique de pared
piece('tira-led', X(11.85), Y(1.2), 0, { width: 5.4, elevation: 2.3, color: '#ffd9a0' });
piece('tira-led', X(11.85), Y(3.8), 0, { width: 5.4, elevation: 2.3, color: '#ffd9a0' });
piece('arbol-guayacan', X(-1.0), Y(-0.75));
piece('arbol-guayacan', X(16.0), Y(-0.75));
piece('carro', X(3.4), Y(1.5), 0);
piece('moto', X(7.2), Y(1.5), 0);
piece('carro', X(12.0), Y(2.6), 90, { color: '#1e2226' });

// Rooftop over bedrooms 2 and 3: lounge under a wooden pergola, BBQ and bar at the back, plants along the edges;
// green-roof planters over the kitchen, behind the carport, as in the reference.
target = rooftop;
piece('jardinera', X(10.6), Y(5.6), 0, { width: 2.0, color: pizarra });
piece('jardinera', X(12.7), Y(5.6), 0, { width: 2.0, color: pizarra });
piece('tira-led', X(4.9), Y(4.7), 0, { width: 7.4, elevation: 2.3, color: '#ffd9a0' }); // luz bajo el marco del cubo
piece('pergola', X(11.2), Y(16.8), 0, { width: 5.2, depth: 3.0, color: caramelo });
piece('sofa-exterior', X(11.2), Y(15.55), 180, { color: taupe });
piece('sillon-exterior', X(9.5), Y(16.8), 270, { color: pizarra });
piece('sillon-exterior', X(12.9), Y(16.8), 90, { color: pizarra });
piece('alfombra', X(11.2), Y(16.8), 0, { width: 2.6, depth: 1.6, color: arena });
piece('mesa-centro', X(11.2), Y(16.8), 0, { color: caramelo });
piece('parrilla', X(9.0), Y(19.55));
piece('bar', X(11.2), Y(19.55), 0, { color: caramelo });
piece('matera-alta', X(13.6), Y(19.5), 0, { color: oliva });
piece('matera-alta', X(7.5), Y(19.5), 0, { color: oliva });

// ---------- Casa de 7 m furniture, straight in plan (no mirror): sides n = street, s = back, w = party wall (a 7),
// e = side path (a 1); A()/D() turn lot coordinates into plan x/y ----------
const A = (a) => 30 - a;
const D = (d) => 42 + d;
const onWallP = (r, side, type, at, o = {}) => {
  const d = (o.depth ?? catalog.get(type).depth) / 2 + (o.gap ?? 0);
  const pos = { n: [at, r.y0 + d], s: [at, r.y1 - d], w: [r.x0 + d, at], e: [r.x1 - d, at] }[side];
  place(type, pos[0], pos[1], ROT[side], o);
};
target = ground;
// Double-height social space: living room at the front facing the TV on the party wall, dining table in the middle,
// the kitchen along the party wall at the back next to the pantry door.
r = R('Monoambiente (sala, comedor y cocina)');
onWallP(r, 'w', 'mueble-tv', D(7.6), { width: 2.0, color: oliva });
onWallP(r, 'w', 'televisor-70', D(7.6), { gap: 0.02 });
place('alfombra', A(4.6), D(7.6), 90, { width: 2.6, depth: 2.0, color: arena });
place('mesa-centro', A(4.6), D(7.6), 90, { color: caramelo });
place('sofa-l', A(3.2), D(7.6), 90, { color: taupe });
place('lampara-pie', A(2.2), D(6.6));
place('mesa-comedor-6', A(3.4), D(10.1), 0, { color: caramelo });
for (const a of [2.85, 3.4, 3.95]) {
  place('silla-comedor', A(a), D(10.1) - 0.85, 0, { color: pizarra });
  place('silla-comedor', A(a), D(10.1) + 0.85, 180, { color: pizarra });
}
onWallP(r, 'w', 'meson', D(9.3), { color: arena });
onWallP(r, 'w', 'estufa', D(10.2));
onWallP(r, 'w', 'lavaplatos', D(10.9), { color: arena });
onWallP(r, 'w', 'alacena', D(9.75), { width: 1.5, color: oliva, elevation: 1.5 });
onWallP(r, 's', 'nevera', A(5.95));
place('matera-alta', A(1.5), D(11.5), 0, { color: oliva });

r = R('Alacena');
onWallP(r, 'w', 'estanteria', D(12.9), { width: 1.4, color: caramelo });
onWallP(r, 's', 'estanteria', A(5.3), { width: 1.2, color: caramelo });
r = R('Baño de visitas');
onWallP(r, 'w', 'sanitario', D(15.1));
onWallP(r, 'n', 'lavamanos', A(6.3));
onWallP(r, 'n', 'espejo', A(6.3), { width: 0.5 });
r = R('Zona de lavado');
onWallP(r, 'w', 'lavadora', D(16.4));
onWallP(r, 'w', 'lavadero', D(17.2));

// Bedrooms 2 and 1: bed against the front wall, closets along the party wall, a desk under the window to the path;
// the bathroom in the back corner.
for (const [name, d0, art] of [['Habitación 2', 18, 'cuadro-paisaje'], ['Habitación 1', 22, 'cuadro-byn']]) {
  r = R(name);
  onWallP(r, 'n', 'cama-doble', A(3.2), { color: arena });
  onWallP(r, 'n', 'mesa-noche', A(3.2) - 0.925, { color: caramelo });
  onWallP(r, 'n', 'mesa-noche', A(3.2) + 0.925, { color: caramelo });
  onWallP(r, 'n', art, A(3.2), { elevation: 1.3, color: caramelo });
  onWallP(r, 'w', 'closet', D(d0 + 0.75), { color: taupe });
  onWallP(r, 's', 'escritorio', A(3.3), { color: caramelo });
  place('silla-oficina', A(3.3), D(d0 + 2.9), 0);
  place('alfombra', A(3.2), D(d0 + 2.3), 0, { width: 1.6, depth: 0.9, color: taupe });
  r = R(`Baño ${name.toLowerCase()}`);
  onWallP(r, 's', 'ducha', A(6.45));
  onWallP(r, 'w', 'sanitario', D(d0 + 2.4));
  onWallP(r, 'n', 'lavamanos', A(5.65));
}
// Master: king bed facing the glass door to the back garden; walk-in dressing room and
// bathroom along the party wall.
r = R('Habitación principal');
onWallP(r, 'n', 'cama-king', A(2.7), { color: arena });
onWallP(r, 'n', 'mesa-noche', A(2.7) - 1.225, { color: caramelo });
onWallP(r, 'n', 'mesa-noche', A(2.7) + 1.225, { color: caramelo });
onWallP(r, 'n', 'cuadro-abstracto', A(2.7), { width: 1.4, height: 0.7, elevation: 1.3, color: caramelo });
place('alfombra', A(2.7), D(28.6), 0, { width: 2.6, depth: 2.0, color: taupe });
place('sillon', A(3.7), D(30.3), 180, { color: pizarra });
r = R('Vestier principal');
onWallP(r, 'w', 'vestier-colgar', D(26.65));
onWallP(r, 'w', 'vestier-cajones', D(27.7));
onWallP(r, 'n', 'vestier-zapatos', A(5.0));
r = R('Baño habitación principal');
onWallP(r, 's', 'ducha', A(6.45));
onWallP(r, 'w', 'sanitario', D(29.3));
onWallP(r, 'e', 'lavamanos', D(29.6), { color: caramelo });
onWallP(r, 'e', 'espejo', D(29.6), { width: 0.6 });

// Patio garden: a tree, planters and a bench; plants along the side path and in the back garden.
place('arbol-pequeno', A(3.6), D(15.0));
place('jardinera', A(3.4), D(17.6), 0, { width: 2.0, color: oliva });
place('banca', A(4.25), D(13.2), 270, { width: 1.2, color: caramelo });
place('arbusto', A(2.6), D(12.6));
for (const d of [13.5, 20.0, 24.0, 28.0]) place('matera', A(0.5), D(d), 0, { color: oliva });
place('arbol-pequeno', A(5.5), D(31.5));
// Front: the car under the white carport nose to the street, planters along the pedestrian path, LED lines.
place('carro', A(4.5), D(3.2), 90, { color: '#1e2226' });
place('jardinera', A(0.45), D(2.5), 90, { width: 1.6, color: pizarra });
place('jardinera', A(0.45), D(4.5), 90, { width: 1.6, color: pizarra });
place('tira-led', A(4.5), D(1.0), 0, { width: 4.4, elevation: 2.3, color: '#ffd9a0' });
place('tira-led', A(4.5), D(5.0), 0, { width: 4.4, elevation: 2.3, color: '#ffd9a0' });
place('arbol-guayacan', A(-0.8), D(-0.8));
// Rooftop over the bedrooms: lounge under a pergola, BBQ and bar.
target = rooftop;
place('pergola', A(4.0), D(23.0), 0, { width: 5.0, depth: 3.0, color: caramelo });
place('sofa-exterior', A(4.0), D(21.8), 0, { color: taupe });
place('mesa-centro', A(4.0), D(23.0), 0, { color: caramelo });
place('sillon-exterior', A(2.2), D(23.2), 90, { color: pizarra });
place('sillon-exterior', A(5.8), D(23.2), 270, { color: pizarra });
place('parrilla', A(2.0), D(30.4), 180);
place('bar', A(4.6), D(30.4), 180, { color: caramelo });
for (const d of [19.0, 27.0]) place('matera-alta', A(6.5), D(d), 0, { color: oliva });

// ---------- Check: nothing may sit inside a wall; a piece a few centimetres into one is pushed out to its face ----------
const FREE = /alfombra|cuadro|tira-led|espejo|televisor|cortina|jardin-vertical|arbol|pergola|porton/;
for (const floor of project.floors) {
  for (const f of floor.furniture) {
    if (FREE.test(f.type) || f.rotation % 90) continue;
    const [w, d] = f.rotation % 180 ? [f.depth, f.width] : [f.width, f.depth];
    for (let pass = 0; pass < 2; pass++) {
      for (const wl of floor.walls) {
        const t = wl.thickness / 2;
        const horizontal = Math.abs(wl.a.y - wl.b.y) < 1e-6;
        const [along, across, size, spanAlong] = horizontal ? ['x', 'y', d, w] : ['y', 'x', w, d];
        const lo = Math.min(wl.a[along], wl.b[along]);
        const hi = Math.max(wl.a[along], wl.b[along]);
        if (Math.min(hi, f[along] + spanAlong / 2) - Math.max(lo, f[along] - spanAlong / 2) <= 0.02) continue;
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
