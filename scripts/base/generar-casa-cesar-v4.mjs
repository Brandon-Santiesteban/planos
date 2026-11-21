// Casa Cesar versión 4: house for César Virgil's parents on lot E10-45, 7 × 32 m (user's sketch and brief, 2026-11-13;
// layout as of 2026-11-14, docs/casa-cesar-v4/propuesta-03.png plus the user's later changes).
//
//   node scripts/base/generar-casa-cesar-v4.mjs [puerto]     (needs a dev server, default :5173)
//
// Plan coordinates = design coordinates: x 0 → 15 from the left boundary (the site is 15 × 32; the house's lot is x 0–7), y 0 (back boundary) → 32 (street).
// The house is 5,5 m wide (x 1–6,5).
//   y 0–2      back garden
//   y 2–8      master suite: bedroom x 3,6–6,5 (entered from the corridor), walk-in (y 2–5) and bathroom (y 5–8, back to back with Hab. 2’s) x 1–3,6
//   y 8–12     Hab. 2 x 1–5,7 (bath + walk-in on the left), open corridor x 5,7–6,5; Hab. 3 above, same layout, off a balcony
//   y 12–19    garden open to the sky; under the bridge (x 5,7–6,5): the way to the corridor, the service area, the alacena;
//              the social bathroom under flight 2 of the stair, along the kitchen's back wall
//   y 19–26    kitchen (right wall) and dining, living room with double height; the stair's flight 1 starts from the corridor
//              on the left; terrace over the kitchen; light roof over the stair, terrace and bridge
//   y 26–32    stone path in line with the front door (lawn on its left), parking for 2 cars on the right
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { interior, readCatalog } from '../casa-completa-muebles.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const OUT = join(root, 'public/ejemplos/casa-cesar-v4.casa.json');
const PORT = process.argv[2] ?? '5173';
const H = 3.0; // floor height: the terrace sits at +3,00

const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://localhost:${PORT}`);
await page.waitForTimeout(800);

const json = await page.evaluate(async (H) => {
  const ops = await import('/src/model/ops.ts');
  const { createEmptyProject } = await import('/src/model/defaults.ts');
  const { serializeProject } = await import('/src/persistence/projectFile.ts');
  const Q = (x, y) => ({ x, y });
  const p = createEmptyProject('Casa Cesar versión 4');
  const len = {};
  const wall = (f, a, b, t = 0.15, height = null) => {
    const id = ops.addWall(p, f, Q(...a), Q(...b), t);
    if (!id) throw new Error(`muro ${JSON.stringify([a, b])}`);
    len[id] = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (height != null) ops.updateWall(p, f, id, { height });
    return id;
  };
  /** Opening centred `at` metres from the wall's first point. */
  const opening = (f, kind, wallId, at, patch = {}) => {
    let id = ops.addOpening(p, f, wallId, kind, at);
    if (!id && patch.width && patch.width + 0.05 < len[wallId]) {
      // The default width does not fit this short wall; place it at its own width directly.
      id = crypto.randomUUID();
      floorOf(f).openings.push({ id, wallId, kind, offset: at, width: patch.width, height: patch.height ?? (kind === 'door' ? 2.1 : 1.2), sill: patch.sill ?? (kind === 'door' ? 0 : 0.9) });
      return id;
    }
    if (!id) throw new Error(`no cabe ${kind} en ${at}`);
    if (Object.keys(patch).length && !ops.updateOpening(p, f, id, { ...patch, offset: at })) throw new Error(`medidas de ${kind} en ${at}`);
    return id;
  };
  const door = (f, w, at, width = 0.8, extra = {}) => opening(f, 'door', w, at, { width, ...extra });
  const vano = (f, w, at, width = 0.8) => { const id = door(f, w, at, width); ops.setDoorVano(p, f, id, true); return id; };
  const glassDoor = (f, w, at, patch) => { const id = opening(f, 'door', w, at, patch); ops.setDoorGlass(p, f, id, true); return id; };
  const win = (f, w, at, width = 1.2, extra = {}) => opening(f, 'window', w, at, { width, ...extra });
  const high = { sill: 1.5, height: 0.6 }; // bathroom window
  const floorOf = (f) => p.floors.find((x) => x.id === f);
  const room = (f, pts, name, kind, extra = {}) => {
    const id = ops.addRoom(p, f, pts.map((q) => Q(...q)), name);
    if (!id) throw new Error(name);
    if (kind) ops.setRoomKind(p, f, id, kind);
    Object.assign(floorOf(f).rooms.find((x) => x.id === id), extra);
    return id;
  };
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

  // ======================= Primer piso =======================
  const g = p.floors[0].id;
  ops.renameFloor(p, g, 'Primer piso');
  ops.setFloorHeight(p, g, H);
  const E = 0.2; // outside walls

  // --- Master suite (y 2–8), mirrored (user, 2026-11-14): bedroom on the right, entered from the right-hand corridor;
  // walk-in at the back and the bathroom next to Hab. 2’s (user, 2026-11-14: shared plumbing wall at y 8).
  const back = wall(g, [1, 2], [6.5, 2], E);
  glassDoor(g, back, 4.05, { width: 1.8, height: 2.3 }); // bedroom → back garden
  win(g, back, 1.3, 0.6, high); // walk-in
  win(g, wall(g, [1, 2], [1, 8], E), 4.5, 0.6, high); // bathroom
  win(g, wall(g, [6.5, 2], [6.5, 8], E), 1.6, 2.0, { sill: 0.45, height: 2.0 }); // bedroom → house garden
  vano(g, wall(g, [3.6, 2], [3.6, 8]), 0.9, 0.8); // bedroom → walk-in
  vano(g, wall(g, [1, 5], [3.6, 5]), 1.9, 0.8); // walk-in → bathroom
  door(g, wall(g, [1, 8], [6.5, 8], E), 5.1, 0.7); // corridor → master bedroom

  // --- Hab. 2 (y 8–12), the only other bedroom downstairs, right after the master suite (user, 2026-11-14) so there is a
  // single, wider garden. Corridor along the right (x 5,7–6,5). Bathroom + walk-in on the left wall, bed against the
  // back wall; Hab. 3 above has the same layout (bath over bath).
  const habWalls = (f, northWall) => {
    // On the ground floor the master suite's wall is the north wall; upstairs it gets a clerestory over the headboard.
    if (northWall) win(f, wall(f, [1, 8], [5.7, 8], E), 3.15, 2.0, { sill: 1.75, height: 0.5 });
    wall(f, [1, 8], [1, 12], E);
    const side = wall(f, [5.7, 8], [5.7, 12], E);
    win(f, side, 1.3, 2.0, { sill: 0.45, height: 2.0 }); // panoramic, onto the corridor and the garden
    door(f, side, 3.2, 0.8); // corridor/balcony → bedroom
    wall(f, [1, 12], [5.7, 12], E);
    wall(f, [2.6, 8], [2.6, 10.3]);
    vano(f, wall(f, [2.6, 10.3], [2.6, 12]), 1.0, 0.7); // bedroom → walk-in
    door(f, wall(f, [1, 10.3], [2.6, 10.3]), 0.8, 0.65); // walk-in → bathroom
  };
  habWalls(g, false);

  // --- Garden (y 12–19), open to the sky, with a small tree. Stair in two flights (user, 2026-11-14): flight 1 inside, from the living room's
  // corridor up to a half landing (+1,50) just outside the back wall; flight 2 outside along the back wall, to an
  // arrival platform (+3,00) that joins the terrace and the bridge. Social bathroom under flight 2.
  wall(g, [2.6, 17.4], [4.35, 17.4], 0.12, 2.5);
  wall(g, [2.6, 17.4], [2.6, 17.9], 0.12, 2.5);
  wall(g, [2.6, 17.9], [2.6, 18.9], 0.12, 1.75);
  wall(g, [4.35, 17.4], [4.35, 18.9], 0.12, H);
  ops.setRoofHeight(p, g, room(g, rect(2.54, 17.34, 4.41, 17.95), 'Techo del baño social', 'roof'), 2.5);
  // Under the bridge (x 5,7–6,5): alacena by the kitchen, then the service area, then the way through to the corridor.
  wall(g, [5.7, 18], [6.5, 18], 0.1, H);
  wall(g, [5.7, 18], [5.7, 19], 0.1, H);
  wall(g, [6.5, 16], [6.5, 19], E, H);
  wall(g, [5.7, 16], [6.5, 16], 0.1, H);

  // --- Social block (y 19–26) ---
  const kBack = wall(g, [2, 19], [6.5, 19], E); // x 1–2 stays open: flight 1 goes through to the landing
  door(g, kBack, 1.95, 0.7); // dining → social bathroom
  glassDoor(g, kBack, 3.02, { width: 1.15, height: 2.4 }); // sliding glass door → patio, under the arrival platform
  door(g, kBack, 4.1, 0.6); // kitchen → alacena (sliding)
  const kLeft = wall(g, [1, 19], [1, 26], E);
  win(g, kLeft, 3.2, 1.2, { sill: 0.45, height: 2.0 }); // corridor
  win(g, kLeft, 5.5, 2.4, { sill: 0.45, height: 2.0 }); // corridor by the living room, panoramic
  const kRight = wall(g, [6.5, 19], [6.5, 26], E);
  win(g, kRight, 2.2, 0.8, { sill: 1.05, height: 1.0 }); // over the sink
  const front = wall(g, [1, 26], [6.5, 26], E);
  door(g, front, 0.75, 1.1, { height: 2.6 }); // front door, under its canopy, in line with the corridor
  win(g, front, 3.45, 3.7, { sill: 0.05, height: 2.85 }); // glass façade, lower half

  room(g, rect(3.6, 2, 6.5, 8), 'Hab. principal');
  room(g, rect(1, 2, 3.6, 5), 'Vestier principal');
  room(g, rect(1, 5, 3.6, 8), 'Baño principal');
  room(g, rect(5.7, 8, 6.5, 16), 'Pasillo lateral', 'balcony', { openEdges: [0, 1, 2, 3], floorMaterial: 'piedra' });
  const habRooms = (f, n) => {
    room(f, rect(2.6, 8, 5.7, 12), `Hab. ${n}`);
    room(f, rect(1, 8, 2.6, 10.3), `Baño hab. ${n}`);
    room(f, rect(1, 10.3, 2.6, 12), `Vestidor hab. ${n}`);
  };
  habRooms(g, 2);
  room(g, [[0, 12], [5.7, 12], [5.7, 19], [4.35, 19], [4.35, 17.4], [2.6, 17.4], [2.6, 19], [0, 19]], 'Jardín', 'balcony',
    { openEdges: [0, 1, 2, 3, 4, 5, 6, 7], floorMaterial: 'cesped' });
  room(g, rect(1.1, 18.9, 2.0, 21.14), 'Escalera (tramo 1)', 'stairs', { up: 'n', glass: true, stairRise: 1.5 });
  room(g, rect(1.0, 17.9, 2.0, 18.9), 'Descanso de la escalera', 'stairs', { up: 'e', glass: true, railAtStart: true, stairBase: 1.33, stairRise: 0.17 });
  room(g, rect(2.0, 17.9, 4.24, 18.9), 'Escalera (tramo 2)', 'stairs', { up: 'e', railAtStart: true, stairBase: 1.5, stairRise: 1.5 });
  room(g, rect(2.6, 17.4, 4.35, 18.9), 'Baño social');
  room(g, rect(5.7, 18, 6.5, 19), 'Alacena');
  room(g, rect(5.7, 16, 6.5, 18), 'Zona de servicio');
  room(g, rect(1, 19, 6.5, 23), 'Cocina y comedor');
  ops.setRoofHeight(p, g, room(g, rect(0.95, 26, 2.65, 27.1), 'Alero de la entrada', 'roof'), 2.75);
  room(g, rect(1, 23, 6.5, 26), 'Sala doble altura');

  // ======================= Segundo piso: terraza y Hab. 3 =======================
  const t = ops.addFloor(p);
  ops.renameFloor(p, t, 'Segundo piso');
  ops.setFloorHeight(p, t, H);
  const salaBack = wall(t, [1, 23], [6.5, 23], E);
  win(t, salaBack, 3.45, 3.7, { sill: 0.95, height: 1.6 }); // the terrace looks into the double height
  win(t, wall(t, [1, 23], [1, 26], E), 1.5, 2.4, { sill: 1.4, height: 0.9 });
  win(t, wall(t, [6.5, 23], [6.5, 26], E), 1.5, 2.4, { sill: 1.4, height: 0.9 });
  win(t, wall(t, [1, 26], [6.5, 26], E), 3.45, 3.7, { sill: 0, height: 2.6 }); // glass façade, upper half
  ops.setRoofHeight(p, t, room(t, rect(0.9, 22.9, 6.6, 26.1), 'Techo de la sala', 'roof'), H);
  // Terrace over the kitchen, with the well of flight 1; the arrival platform; the bridge and the balcony to Hab. 3.
  room(t, [[2, 19], [4.24, 19], [6.5, 19], [6.5, 23], [1, 23], [1, 21.14], [2, 21.14]], 'Terraza', 'balcony',
    { openEdges: [1, 3], floorMaterial: 'madera', railing: 'vidrio' });
  room(t, rect(4.24, 17.9, 5.7, 19), 'Llegada de la escalera', 'balcony', { openEdges: [1, 2, 3], floorMaterial: 'madera', railing: 'vidrio' });
  room(t, [[5.7, 12], [6.5, 12], [6.5, 19], [5.7, 19], [5.7, 17.9]], 'Puente', 'balcony', { openEdges: [0, 2, 3], floorMaterial: 'madera', railing: 'vidrio' });
  room(t, rect(5.7, 8, 6.5, 12), 'Balcón hab. 3', 'balcony', { openEdges: [2, 3], floorMaterial: 'madera', railing: 'vidrio' });
  habWalls(t, true);
  habRooms(t, 3);
  ops.setRoofHeight(p, t, room(t, rect(0.9, 8.0, 6.6, 12.1), 'Cubierta hab. 3', 'roof'), H);
  // Light roof over the stair, the terrace and the bridge: steel beams and sandwich panel on slim steel posts.
  for (const [x, y] of [[1.0, 19.06], [6.44, 19.06], [6.44, 15.6], [6.44, 12.16]]) wall(t, [x - 0.06, y], [x + 0.06, y], 0.12, 2.7);
  ops.setRoofHeight(p, t, room(t, [[0.85, 17.75], [5.6, 17.75], [5.6, 12.1], [6.65, 12.1], [6.65, 23], [0.85, 23]], 'Techo liviano', 'roof'), 2.7);
  // Roof slab over the master suite.
  ops.setRoofHeight(p, t, room(t, rect(0.9, 1.9, 6.6, 8.1), 'Cubierta hab. principal', 'roof'), 0.001);

  return serializeProject(p);
}, H);
await browser.close();
if (errors.length) throw new Error(errors.join('\n'));

const project = JSON.parse(json);
project.id = randomUUID();
const [ground, terrace] = project.floors;

// ---------- Finishes ----------
const ARENA = '#E8DBD3';
const MATERIAL = [[/baño/i, 'ceramica'], [/alacena|servicio/i, 'ceramica'], [/hab|vestier|vestidor/i, 'madera']];
for (const r of [...ground.rooms, ...terrace.rooms]) {
  if (r.kind !== 'room') continue;
  r.floorMaterial = MATERIAL.find(([re]) => re.test(r.name))?.[1] ?? 'porcelanato';
}
for (const r of terrace.rooms) if (r.kind === 'roof' && !r.name.includes('liviano')) Object.assign(r, { floorMaterial: 'concreto', edgeColor: ARENA });
for (const r of ground.rooms) if (r.kind === 'roof') Object.assign(r, { edgeColor: '#B77E53' });

// ---------- Lot outside the house ----------
const ext = (name, x0, y0, x1, y1, floorMaterial) =>
  ground.rooms.push({ id: randomUUID(), name, kind: 'exterior', points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], floorMaterial });
ext('Jardín posterior', 0, 0, 7, 2, 'cesped');
ext('Jardín de la casa (lado derecho)', 7, 0, 15, 32, 'cesped');
ext('Jardín lateral izquierdo', 0, 2, 1, 8, 'cesped');
ext('Jardín lateral izquierdo (hab. 2)', 0, 8, 1, 12, 'cesped');
ext('Jardín lateral derecho', 6.5, 2, 7, 8, 'cesped');
ext('Jardín lateral derecho (pasillo)', 6.5, 8, 7, 19, 'cesped');
ext('Jardín lateral izquierdo (cocina)', 0, 19, 1, 26, 'cesped');
ext('Jardín lateral derecho (cocina)', 6.5, 19, 7, 26, 'cesped');
ext('Césped del frente', 0, 26, 1.15, 32, 'cesped');
ext('Camino de entrada', 1.15, 26, 2.35, 32, 'piedra');
ext('Estacionamiento', 2.35, 26, 7, 32, 'concreto');
ext('Andén', -3, 32, 18, 33.5, 'concreto');
ext('Calle', -3, 33.5, 18, 40.5, 'asfalto');

// ---------- Furniture (plan coordinates) ----------
const catalog = readCatalog();
const ROT = { n: 0, s: 180, w: 270, e: 90 };
const round = (v) => Math.round(v * 1000) / 1000;
let target = ground;
const piece = (type, x, y, rotation = 0, o = {}) => {
  const c = catalog.get(type);
  if (!c) throw new Error(`No existe en el catálogo: ${type}`);
  const f = { id: randomUUID(), type, x: round(x), y: round(y), rotation: ((rotation % 360) + 360) % 360,
    width: o.width ?? c.width, depth: o.depth ?? c.depth, height: o.height ?? c.height, elevation: o.elevation ?? c.elevation };
  if (o.color) f.color = o.color;
  target.furniture.push(f);
};
/** Back against the wall `side` of the room, centred at `at` along it. */
const onWall = (r, side, type, at, o = {}) => {
  const d = (o.depth ?? catalog.get(type).depth) / 2 + (o.gap ?? 0);
  const pos = { n: [at, r.y0 + d], s: [at, r.y1 - d], w: [r.x0 + d, at], e: [r.x1 - d, at] }[side];
  piece(type, pos[0], pos[1], ROT[side], o);
};
const R = (name) => interior(ground, ground.rooms.find((r) => r.name === name));
const MADERA = '#B77E53', TAUPE = '#C6B1A0', OLIVA = '#8C8A7D', PIZARRA = '#495762', GRAFITO = '#3d3a38';

let r = { x0: 3.7, y0: 2.1, x1: 6.4, y1: 7.9 }; // master bedroom
onWall(r, 'w', 'cama-king', 6.25, { color: ARENA });
onWall(r, 'w', 'mesa-noche', 4.95, { color: MADERA });
onWall(r, 'w', 'mesa-noche', 7.55, { color: MADERA });
onWall(r, 'w', 'cuadro-abstracto', 6.25, { width: 1.4, height: 0.7, elevation: 1.35 });
onWall(r, 'e', 'televisor-70', 6.25, { elevation: 1.0 });
piece('alfombra', 4.9, 6.25, 90, { width: 2.4, depth: 1.6, color: '#d8ccbf' });
onWall(r, 'e', 'cortina', 2.45, { width: 0.4 });
onWall(r, 'e', 'cortina', 4.75, { width: 0.4 });
r = R('Baño principal');
onWall(r, 's', 'ducha', 1.6); // against the wall shared with Hab. 2’s shower
onWall(r, 'w', 'sanitario', 6.0);
onWall(r, 'e', 'lavamanos-doble', 6.5, { color: MADERA });
r = R('Vestier principal');
onWall(r, 'w', 'vestier-colgar', 3.0);
onWall(r, 'w', 'vestier-repisas', 4.2);
onWall(r, 'n', 'vestier-cajones', 2.6);
// Hab. 2 (ground) and Hab. 3 (above), same layout: queen bed on the back wall, TV in front, art, rug, curtains.
const habFurniture = (n) => {
  const fl = n === 2 ? ground : terrace;
  const RR = (name) => interior(fl, fl.rooms.find((x) => x.name === name));
  r = { x0: 2.7, y0: 8.1, x1: 5.6, y1: 11.9 };
  onWall(r, 'n', 'cama-queen', 4.15, { color: ARENA });
  onWall(r, 'n', 'mesa-noche', 3.05, { color: MADERA });
  onWall(r, 'n', 'mesa-noche', 5.25, { color: MADERA });
  onWall(r, 's', 'mueble-tv', 4.15, { color: MADERA, width: 1.4 });
  onWall(r, 's', 'televisor-70', 4.15, { width: 1.23, height: 0.72, elevation: 1.05 });
  onWall(r, 'w', 'cuadro-byn', 9.1);
  onWall(r, 'e', 'cortina', 8.35, { width: 0.4 });
  onWall(r, 'e', 'cortina', 10.25, { width: 0.4 });
  piece('alfombra', 4.15, 10.4, 0, { width: 2.2, depth: 1.5, color: '#d8ccbf' });
  r = RR(`Baño hab. ${n}`);
  onWall(r, 'n', 'ducha', 1.55);
  onWall(r, 'e', 'lavamanos', 8.65);
  onWall(r, 'e', 'sanitario', 9.65);
  r = RR(`Vestidor hab. ${n}`);
  onWall(r, 's', 'vestier-colgar', 1.75, { width: 1.3 });
};
habFurniture(2);
r = R('Baño social');
onWall(r, 'n', 'sanitario', 3.95);
onWall(r, 'n', 'lavamanos', 3.05, { color: MADERA });
onWall(r, 'n', 'espejo', 3.05, { elevation: 1.15 });
r = R('Alacena');
onWall(r, 'n', 'vestier-repisas', 6.1, { width: 0.7, depth: 0.4, color: ARENA });
piece('lavadora', 6.15, 16.45, 90);
piece('lavadero', 6.15, 17.35, 90);
// Kitchen on the right wall, island with stools, dining beside flight 1.
r = { x0: 2.1, y0: 19.1, x1: 6.4, y1: 22.9 };
onWall(r, 'e', 'nevera', 20.2);
onWall(r, 'e', 'meson', 20.68, { width: 0.2, color: GRAFITO });
onWall(r, 'e', 'lavaplatos', 21.2, { color: GRAFITO });
onWall(r, 'e', 'meson', 21.75, { width: 0.3, color: GRAFITO });
onWall(r, 'e', 'estufa', 22.2);
onWall(r, 'e', 'campana', 22.2, { height: 1.2 });
piece('bar', 4.72, 21.05, 90, { width: 1.7, color: GRAFITO });
piece('mesa-comedor-6', 2.9, 20.6, 90, { color: MADERA });
for (const y of [20.0, 20.6, 21.2]) {
  piece('silla-comedor', 2.3, y, 270, { color: GRAFITO });
  piece('silla-comedor', 3.5, y, 90, { color: GRAFITO });
}
piece('lampara-colgante', 2.9, 20.2, 0, { elevation: 1.75 });
piece('lampara-colgante', 2.9, 21.0, 0, { elevation: 1.75 });
// Living room on the right: entertainment unit on the right wall, the sofa facing it; the corridor on the left stays free.
r = { x0: 2.1, y0: 23.0, x1: 6.4, y1: 25.9 };
onWall(r, 'e', 'centro-entretenimiento', 24.5, { color: '#5b4636' });
piece('sofa-l', 3.65, 24.45, 270, { color: TAUPE });
piece('mesa-centro', 4.8, 24.4, 90, { color: MADERA });
piece('alfombra', 4.6, 24.4, 90, { width: 2.6, depth: 2.0, color: ARENA });
piece('lampara-pie', 2.45, 25.6);
piece('monstera', 6.05, 23.35);
piece('jarron-pampas', 6.15, 25.7);
onWall(r, 's', 'cortina', 2.8, { width: 0.4, height: 2.8 });
onWall(r, 's', 'cortina', 6.15, { width: 0.4, height: 2.8 });
onWall({ x0: 1.1, y0: 19, x1: 6.4, y1: 26 }, 'w', 'cuadro-abstracto', 22.25, { width: 0.9, height: 0.6, elevation: 1.4 });
// Garden (y 12–19): a small tree with an uplight, shrubs and a bench.
piece('arbol-pequeno', 2.6, 14.6);
piece('luz-piso', 2.6, 13.7);
piece('banca', 4.3, 12.5, 0, { color: MADERA });
piece('arbusto', 1.3, 12.5);
piece('arbusto', 0.5, 16.6);
piece('arbusto', 4.8, 15.6, 0, { width: 0.7, depth: 0.7, height: 0.8 });
// Parking: two cars nose-in, moved right so the path to the door stays free.
piece('carro', 3.65, 29.0, 90);
piece('carro', 5.9, 29.0, 90, { color: PIZARRA });

// Boundary hedge, 1,30 m high (user: a hedge of at most 1,30–1,35 m instead of the wall): overlapping clipped
// shrubs along the left, back and right boundaries and the front of the garden; the path and parking stay open.
const hedge = (x0, y0, x1, y1, depth = 0.6) => {
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / 2.0));
  const rot = Math.abs(x1 - x0) > Math.abs(y1 - y0) ? 0 : 90;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    piece('seto', x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, rot, { width: L / n + 0.02, depth, height: 1.3 });
  }
};
hedge(0.1, 0.1, 0.1, 31.9, 0.2); // left, full length to the street, as thin as a clipped hedge allows
hedge(0.1, 0.1, 14.9, 0.1, 0.2); // back
// No hedge on the right boundary (towards the neighbour), as the user asked.
// The front of the garden stays open (no hedge).

// Front: planter and shrub on the lawn by the door, a façade light, bollards along the path, garden trees with uplights.
piece('matera-alta', 0.6, 26.45, 0, { color: GRAFITO });
piece('arbusto', 0.6, 27.3, 0, { width: 0.6, depth: 0.6, height: 0.7 });
piece('aplique-exterior', 2.48, 26.17, 0);
for (const y of [27.6, 29.2, 30.8]) piece('baliza', 1.0, y);
piece('arbol-pequeno', 9.5, 29.0);
piece('luz-piso', 9.5, 28.1);
piece('arbol-pequeno', 12.5, 22.0);
piece('luz-piso', 12.5, 21.1);
for (const y of [4, 10, 16.5, 22.5, 28]) piece('baliza', 7.25, y);
piece('luz-piso', 6.85, 26.3); // grazes the façade's right corner
piece('aplique-exterior', 6.65, 17.0, 90);

target = terrace;
habFurniture(3);
piece('sofa-exterior', 3.6, 22.4, 180, { color: TAUPE });
piece('mesa-centro', 3.6, 21.5, 0, { color: MADERA, width: 1.0, depth: 0.55 });
piece('sillon-exterior', 2.55, 20.6, 90, { color: TAUPE });
piece('sillon-exterior', 4.65, 20.6, 270, { color: TAUPE });
piece('mesa-exterior', 5.7, 21.9, 0, { color: MADERA });
piece('jardinera', 3.1, 19.25, 0, { color: GRAFITO, width: 2.0 });
piece('matera-alta', 6.2, 22.7, 0, { color: GRAFITO });
piece('matera-alta', 6.2, 8.4, 0, { color: GRAFITO });
piece('jardin-vertical', 1.85, 26.16, 0, { width: 1.3 }); // over the front door, outside
piece('luz-empotrada', 3.6, 21.4, 0, { elevation: 2.66 });
piece('luz-empotrada', 5.7, 21.4, 0, { elevation: 2.66 });
piece('luz-empotrada', 6.1, 17.0, 0, { elevation: 2.66 });

writeFileSync(OUT, JSON.stringify(project, null, 2) + '\n');
console.log(`Listo: ${OUT}`);
