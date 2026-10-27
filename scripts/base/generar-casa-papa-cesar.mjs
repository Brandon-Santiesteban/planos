// Casa Papá César: house around a central patio on a 15 × 15 m lot, from the hand sketch (2026-10-27).
// 1 m of lawn at the front and on both sides; the house is 13 m wide × 11,6 m deep and leaves a 2,4 m back patio.
// Built with the app's own operations (Playwright drives the dev server), then finished in Node:
// wall finishes, floors, furniture in the family palette, lawn, back patio, sidewalk and street.
//
//   node scripts/base/generar-casa-papa-cesar.mjs [puerto]     (needs a dev server, default :5173)
//
// Design coordinates: x 0 → 13 from the left side of the house, y 0 (front, street) → 11,6 (back of the house);
// the back patio runs to y 14. P() turns them into plan coordinates (north up, street at the bottom): plan y = 11,6 − y.
// Layout (design metres):
//   front   comedor + sala x 0–6 y 0–3,6 · hall x 6–7,4 · garage x 7,4–13 y 0–5,4 (2 cars), open into the patio
//   middle  open kitchen x 0–3,2 · baño social x 3,2–4,6 · lavandería x 4,6–6 (y 3,6–5,6)
//   centre  patio x 6–8,6 (open to the sky and to the back patio) with a straight glass stair x 6–7,2 y 5–9 up to the rooftop
//   back    master suite 6 × 6 x 0–6 y 5,6–11,6: baño + vestier, bedroom with a big glass door to the back patio
//           cuarto 3 y 5,4–8,5 and cuarto 2 y 8,5–11,6 (x 8,6–13), each with its own bathroom, windows to the patio
//   up      rooftop ~5 × 5 over the living-dining room with a wooden pergola, BBQ and seating
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { interior, readCatalog } from '../casa-completa-muebles.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const OUT = join(root, 'public/ejemplos/casa-papa-cesar.casa.json');
const PORT = process.argv[2] ?? '5173';
const DEPTH = 11.6;

/** The family palette (user, 2026-10-27). */
const PALETA = { arena: '#E8DBD3', taupe: '#C6B1A0', oliva: '#8C8A7D', pizarra: '#495762', caramelo: '#B77E53' };

const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://localhost:${PORT}`);
await page.waitForTimeout(800);

const json = await page.evaluate(async (DEPTH) => {
  const ops = await import('/src/model/ops.ts');
  const { createEmptyProject } = await import('/src/model/defaults.ts');
  const { serializeProject } = await import('/src/persistence/projectFile.ts');
  const P = (x, y) => ({ x: Math.round(x * 1e6) / 1e6 + 0, y: Math.round((DEPTH - y) * 1e6) / 1e6 + 0 });
  const Q = (x, y) => ({ x, y });
  const p = createEmptyProject('Casa Papá César');
  const lengths = {};
  // Walls are stored reversed (design b → a), so an opening's offset is measured from the design start point a.
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

  // --- Outside walls (the garage front stays open to the street, the patio open to the back patio) ---
  // The cube's front in three pieces: the middle one (x 1,2–4,8) frames the tall window in wood on both levels.
  wall(g, Q(0, 0), Q(1.2, 0), 0.2);
  opening(g, 'window', wall(g, Q(1.2, 0), Q(4.8, 0), 0.2), 1.8, { width: 2.8, sill: 0.3, height: 2.3 }); // lower half of the tall window
  wall(g, Q(4.8, 0), Q(6, 0), 0.2);
  wall(g, Q(13, 0), Q(13, 5.4), 0.2); // costado del garaje
  opening(g, 'window', wall(g, Q(13, 5.4), Q(13, 7.2), 0.2), 0.9, high); // baño cuarto 3
  opening(g, 'window', wall(g, Q(13, 7.2), Q(13, 8.5), 0.2), 0.65, { width: 0.9 }); // cuarto 3
  opening(g, 'window', wall(g, Q(13, 8.5), Q(13, 9.8), 0.2), 0.65, { width: 0.9 }); // cuarto 2
  opening(g, 'window', wall(g, Q(13, 9.8), Q(13, 11.6), 0.2), 0.9, high); // baño cuarto 2
  const backRight = wall(g, Q(13, 11.6), Q(8.6, 11.6), 0.2);
  opening(g, 'window', backRight, 13 - 12.2, high); // baño cuarto 2 → patio trasero
  opening(g, 'window', backRight, 13 - 10.6, { width: 1.2 }); // cuarto 2 → patio trasero
  const backSuite = wall(g, Q(6, 11.6), Q(0, 11.6), 0.2);
  glassDoor(g, backSuite, 3.0, { width: 3.6, height: 2.3 }); // ventanal del cuarto principal al patio trasero
  wall(g, Q(0, 11.6), Q(0, 8), 0.2); // cabecera de la cama: sin ventana
  opening(g, 'window', wall(g, Q(0, 8), Q(0, 5.6), 0.2), 1.2, { ...high, width: 0.8 }); // baño principal
  opening(g, 'window', wall(g, Q(0, 5.6), Q(0, 0), 0.2), 3.6, { width: 1.6 }); // comedor

  // --- Social zone: the cube is one open space (living, dining, kitchen); the laundry moved to the garage ---
  // Entrance porch: recessed 1,5 m into the hall's bay (x 6–7,4), under the roof, lined in wood; the front door is
  // at the back of it. The cube's side and the garage wall frame it.
  wall(g, Q(6, 0), Q(6, 1.5), 0.2); // porche | cubo
  wall(g, Q(7.4, 0), Q(7.4, 1.5), 0.15); // porche | garaje
  const frontDoor = wall(g, Q(6, 1.5), Q(7.4, 1.5), 0.2);
  opening(g, 'door', frontDoor, 0.7, { width: 1.0, height: 2.3 }); // puerta principal (pivotante, alta)
  opening(g, 'door', wall(g, Q(6, 1.5), Q(6, 3.6)), 1.3, { width: 1.0 }); // hall → sala
  glassDoor(g, wall(g, Q(6, 3.6), Q(6, 5.6)), 0.8, { width: 1.0 }); // cocina-comedor → patio
  glassDoor(g, wall(g, Q(6, 3.6), Q(7.4, 3.6)), 0.7, { width: 1.0 }); // hall → patio
  opening(g, 'door', wall(g, Q(7.4, 1.5), Q(7.4, 3.6), 0.15), 1.2, { width: 0.9 }); // hall → garaje
  wall(g, Q(7.4, 3.6), Q(7.4, 5.4), 0.15); // the garage's laundry nook backs onto it
  const cubeBack = wall(g, Q(0, 5.6), Q(6, 5.6)); // cubo | suite y baño social
  opening(g, 'door', cubeBack, 5.2, { width: 0.7 }); // cubo → baño social

  // --- Master suite 6 × 6: bedroom, walk-in dressing room and bathroom with no walls between them; the open walnut
  // dressing modules are the partitions (see the furniture). The social bathroom beside it keeps its walls. ---
  wall(g, Q(4.4, 5.6), Q(4.4, 8)); // vestier | baño social
  wall(g, Q(4.4, 8), Q(6, 8)); // baño social | dormitorio
  opening(g, 'window', wall(g, Q(6, 5.6), Q(6, 8)), 1.2, high); // baño social, ventana alta al patio
  // Towards the patio: the 70" TV hangs on this wall facing the bed, the glass door sits by the dressing room.
  glassDoor(g, wall(g, Q(6, 8), Q(6, 11.6)), 0.6, { width: 1.0 }); // dormitorio ↔ patio

  // --- Bedrooms 2 and 3, each with its own bathroom, opening onto the patio ---
  wall(g, Q(8.6, 5.4), Q(13, 5.4), 0.15); // garaje | cuarto 3
  const c3Patio = wall(g, Q(8.6, 5.4), Q(8.6, 8.5));
  opening(g, 'window', c3Patio, 1.1, { width: 1.4 });
  opening(g, 'door', c3Patio, 2.5, { width: 0.8 });
  wall(g, Q(8.6, 8.5), Q(13, 8.5)); // cuarto 3 | cuarto 2
  const c2Patio = wall(g, Q(8.6, 8.5), Q(8.6, 11.6));
  opening(g, 'door', c2Patio, 0.6, { width: 0.8 });
  opening(g, 'window', c2Patio, 2.0, { width: 1.4 });
  wall(g, Q(11.4, 5.4), Q(11.4, 7.2));
  opening(g, 'door', wall(g, Q(11.4, 7.2), Q(13, 7.2)), 0.45, { width: 0.7 }); // cuarto 3 → su baño
  wall(g, Q(11.4, 9.8), Q(11.4, 11.6));
  opening(g, 'door', wall(g, Q(11.4, 9.8), Q(13, 9.8)), 0.45, { width: 0.7 }); // cuarto 2 → su baño

  room(g, rect(0, 0, 6, 5.6), 'Sala-comedor-cocina');
  room(g, rect(6, 0, 7.4, 1.5), 'Porche de entrada', 'balcony', { openEdges: [0, 1, 2, 3] });
  room(g, rect(6, 1.5, 7.4, 3.6), 'Hall');
  room(g, rect(7.4, 0, 13, 5.4), 'Garaje y lavandería');
  room(g, rect(0, 5.6, 2, 8), 'Baño principal');
  room(g, rect(2, 5.6, 4.4, 8), 'Vestier');
  room(g, rect(4.4, 5.6, 6, 8), 'Baño social');
  room(g, rect(0, 8, 6, 11.6), 'Cuarto principal');
  room(g, poly([8.6, 5.4], [11.4, 5.4], [11.4, 7.2], [13, 7.2], [13, 8.5], [8.6, 8.5]), 'Cuarto 3');
  room(g, rect(11.4, 5.4, 13, 7.2), 'Baño cuarto 3');
  room(g, poly([8.6, 8.5], [13, 8.5], [13, 9.8], [11.4, 9.8], [11.4, 11.6], [8.6, 11.6]), 'Cuarto 2');
  room(g, rect(11.4, 9.8, 13, 11.6), 'Baño cuarto 2');
  // Central patio, open to the sky, to the garage (x 7,4–8,6) and to the back patio; the glass stair rises in it.
  room(g, poly([6, 3.6], [7.4, 3.6], [7.4, 5.4], [8.6, 5.4], [8.6, 11.6], [6, 11.6], [6, 9], [7.2, 9], [7.2, 5], [6, 5]),
    'Patio central', 'balcony', { openEdges: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
  // Wooden treads with a glass railing; rises towards the back, from beside the hall door up to the landing at y 9
  // next to the rooftop.
  room(g, rect(6, 5, 7.2, 9), 'Escalera (madera y vidrio)', 'stairs', { up: 'n', glass: true });

  // ======================= Rooftop =======================
  // The living-dining-kitchen block (x 0–6, y 0–5,6) is a double-height cube: its walls carry on up this level and
  // close it with a roof, with no slab in between. Behind it, over the master suite, the rooftop: the cube's back
  // wall screens it from the street.
  const t = ops.addFloor(p);
  ops.renameFloor(p, t, 'Rooftop');
  wall(t, Q(0, 0), Q(1.2, 0), 0.2);
  opening(t, 'window', wall(t, Q(1.2, 0), Q(4.8, 0), 0.2), 1.8, { width: 2.8, sill: 0, height: 2.2 }); // upper half of the tall window
  wall(t, Q(4.8, 0), Q(6, 0), 0.2);
  opening(t, 'window', wall(t, Q(0, 5.6), Q(0, 0), 0.2), 2.6, { width: 0.6, sill: 0.4, height: 1.8 }); // ranura lateral
  wall(t, Q(6, 0), Q(6, 5.6), 0.2);
  wall(t, Q(0, 5.6), Q(6, 5.6), 0.2); // privacy wall of the rooftop
  ops.setRoofHeight(p, t, room(t, rect(0, 0, 6, 5.6), 'Techo del cubo', 'roof'), 2.6);
  // Deck over the suite plus the stair landing (x 6–7,2 y 9–10,2); open against the cube wall (edge 0) and where
  // the stair arrives (edge 2), glass railing everywhere else.
  room(t, poly([0, 5.6], [6, 5.6], [6, 9], [7.2, 9], [7.2, 10.2], [6, 10.2], [6, 11.6], [0, 11.6]), 'Rooftop', 'balcony',
    { openEdges: [0, 2], railing: 'vidrio', floorMaterial: 'madera' });
  // Solid roof slabs over the rest of the one-storey part (the patio and the stairwell stay open). Over the porch,
  // hall and garage it runs 0,9 m past the front as an eave with a wooden fascia; see the finishes below.
  const roofs = [
    ['Alero y cubierta del garaje', poly([6, -0.9], [13, -0.9], [13, 5.4], [7.4, 5.4], [7.4, 5], [6, 5])],
    ['Cubierta de los cuartos', rect(8.6, 5.4, 13, 11.6)],
  ];
  for (const [name, pts] of roofs) ops.setRoofHeight(p, t, room(t, pts, name, 'roof'), 0.001);

  return serializeProject(p);
}, DEPTH);
await browser.close();
if (errors.length) throw new Error(errors.join('\n'));

const project = JSON.parse(json);
project.id = randomUUID();
const [ground, rooftop] = project.floors;

// ---------- Finishes: the palette's sand inside and out, wood on the front of the hall ----------
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
// The porch (plan x 6–7,4, y 10,1 → 11,6) is lined in wood on its three sides.
const PORCH = [{ x: 6, y: DEPTH - 1.5 }, { x: 7.4, y: DEPTH - 1.5 }, { x: 7.4, y: DEPTH }, { x: 6, y: DEPTH }];
// The cube (plan x 0–6, y 6 → 11,6) reads as one slate volume from outside, on both levels.
const CUBE = [{ x: 0, y: DEPTH - 5.6 }, { x: 6, y: DEPTH - 5.6 }, { x: 6, y: DEPTH }, { x: 0, y: DEPTH }];
// The middle of the cube's front (x 1,2–4,8, around the tall window) is lined in wood outside, on both levels.
const onFrame = (w) => w.a.y === DEPTH && w.b.y === DEPTH && Math.min(w.a.x, w.b.x) > 1.1 && Math.max(w.a.x, w.b.x) < 4.9;
const onCube = (w) => [w.a, w.b].every((q) => q.x >= -0.01 && q.x <= 6.01 && q.y >= DEPTH - 5.61 && q.y <= DEPTH + 0.01)
  && (w.a.x === w.b.x ? w.a.x === 0 : w.a.y === DEPTH);
for (const w of rooftop.walls) {
  const dx = w.b.x - w.a.x;
  const dy = w.b.y - w.a.y;
  const l = Math.hypot(dx, dy);
  const face = (s) => {
    const off = w.thickness / 2 + 0.05;
    const q = { x: (w.a.x + w.b.x) / 2 + (-dy / l) * s * off, y: (w.a.y + w.b.y) / 2 + (dx / l) * s * off };
    if (pointInPolygon(q, CUBE)) return { finish: 'pintura', color: PALETA.arena };
    return onFrame(w) ? { finish: 'madera' } : { finish: 'pintura', color: PALETA.pizarra };
  };
  w.sides = { left: face(1), right: face(-1) };
}
for (const w of ground.walls) {
  const dx = w.b.x - w.a.x;
  const dy = w.b.y - w.a.y;
  const l = Math.hypot(dx, dy);
  const face = (s) => {
    const off = w.thickness / 2 + 0.05;
    const q = { x: (w.a.x + w.b.x) / 2 + (-dy / l) * s * off, y: (w.a.y + w.b.y) / 2 + (dx / l) * s * off };
    if (enclosed.some((r) => pointInPolygon(q, r.points))) return { finish: 'pintura', color: PALETA.arena };
    if (onFrame(w)) return { finish: 'madera' };
    if (onCube(w)) return { finish: 'pintura', color: PALETA.pizarra };
    return pointInPolygon(q, PORCH) ? { finish: 'madera' } : { finish: 'pintura', color: PALETA.arena };
  };
  w.sides = { left: face(1), right: face(-1) };
}
const MATERIAL = [[/garaje/i, 'concreto'], [/baño|lavander/i, 'ceramica'], [/patio/i, 'cesped'], [/porche/i, 'piedra']];
for (const r of ground.rooms) {
  if (r.kind === 'roof' || r.kind === 'stairs') continue;
  r.floorMaterial = MATERIAL.find(([re]) => re.test(r.name))?.[1] ?? 'porcelanato';
}
rooftop.rooms.find((r) => r.name === 'Rooftop').railingColor = PALETA.pizarra;
// Solid roofs instead of the light sheet: the cube's lid in slate, a caramel wooden band over the porch and garage,
// sand over the bedrooms.
const ROOFS = { 'Techo del cubo': PALETA.pizarra, 'Alero y cubierta del garaje': PALETA.caramelo, 'Cubierta de los cuartos': PALETA.arena };
for (const [name, edgeColor] of Object.entries(ROOFS)) Object.assign(rooftop.rooms.find((r) => r.name === name), { floorMaterial: 'concreto', edgeColor });

// ---------- Lot: lawn, back patio, sidewalk and street (design coordinates, outside the house) ----------
const D = (x, y) => ({ x, y: DEPTH - y });
const drect = (x0, y0, x1, y1) => [D(x0, y0), D(x1, y0), D(x1, y1), D(x0, y1)];
const EXTERIOR = [
  ['Césped lateral izquierdo', drect(-1, 0, 0, 11.6), 'cesped'],
  ['Césped lateral derecho', drect(13, 0, 14, 11.6), 'cesped'],
  ['Terraza del patio trasero', drect(0, 11.6, 6, 13.4), 'piedra'],
  ['Patio trasero (césped)', drect(-1, 13.4, 14, 14), 'cesped'],
  ['Patio trasero izquierdo', drect(-1, 11.6, 0, 13.4), 'cesped'],
  ['Patio trasero derecho', drect(6, 11.6, 14, 13.4), 'cesped'],
  ['Césped del frente', drect(-1, -1, 6, 0), 'cesped'],
  ['Acceso peatonal', drect(6, -1, 7.4, 0), 'piedra'],
  ['Acceso vehicular', drect(7.4, -1, 13, 0), 'concreto'],
  ['Césped esquina', drect(13, -1, 14, 0), 'cesped'],
  ['Andén', drect(-4, -2.5, 17, -1), 'concreto'],
  ['Calle', drect(-4, -9.5, 17, -2.5), 'asfalto'],
];
for (const [name, points, floorMaterial] of EXTERIOR) ground.rooms.push({ id: randomUUID(), name, kind: 'exterior', points, floorMaterial });

// ---------- Furniture (plan coordinates: plan y = 11,6 − design y; n = back of the lot, s = street) ----------
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
/** Back against the wall `side` of the room, centred at `at` along it. */
const onWall = (r, side, type, at, o = {}) => {
  const d = (o.depth ?? catalog.get(type).depth) / 2 + (o.gap ?? 0);
  const pos = { n: [at, r.y0 + d], s: [at, r.y1 - d], w: [r.x0 + d, at], e: [r.x1 - d, at] }[side];
  piece(type, pos[0], pos[1], ROT[side], o);
};
const R = (name) => interior(ground, ground.rooms.find((r) => r.name === name));
const { arena, taupe, oliva, pizarra, caramelo } = PALETA;

// The cube (plan y 6 → 11,6): kitchen along the back wall with an island, dining table, living room facing the TV
// on the hall wall.
let r = R('Sala-comedor-cocina');
onWall(r, 'n', 'nevera', 0.45);
onWall(r, 'n', 'meson', 1.4, { color: arena });
onWall(r, 'n', 'alacena', 1.4, { color: oliva });
onWall(r, 'n', 'lavaplatos', 2.4, { color: arena });
onWall(r, 'n', 'estufa', 3.1);
onWall(r, 'n', 'meson', 4.0, { color: arena });
onWall(r, 'n', 'alacena', 4.0, { color: oliva });
piece('bar', 2.4, 7.55, 0, { color: caramelo }); // isla con taburetes
piece('mesa-comedor-6', 1.6, 9.9, 0, { color: caramelo });
for (const x of [1.05, 1.6, 2.15]) {
  piece('silla-comedor', x, 9.05, 0, { color: pizarra });
  piece('silla-comedor', x, 10.75, 180, { color: pizarra });
}
piece('alfombra', 4.85, 9.5, 90, { color: arena });
piece('sofa-3', 3.75, 9.5, 270, { color: taupe });
piece('mesa-centro', 4.85, 9.5, 90, { color: caramelo });
onWall(r, 'e', 'mueble-tv', 9.4, { color: oliva });
onWall(r, 'e', 'televisor', 9.4, { gap: 0.12 });
piece('lampara-pie', 3.4, 11.2);

r = R('Baño social');
onWall(r, 'n', 'sanitario', 5.2);
onWall(r, 'w', 'lavamanos', 4.8);

// Master suite: bed against the left wall (where the window was), the 70" TV facing it on the patio wall, big glass
// door to the back patio.
r = R('Cuarto principal');
const SPLIT = r.y1; // plan y 3,6: bedroom | bathroom + dressing room (no wall: the dressing modules divide them)
piece('alfombra', 1.9, 1.6, 90, { width: 2.8, depth: 2.2, color: taupe });
onWall(r, 'w', 'cama-king', 1.6, { color: arena });
onWall(r, 'w', 'mesa-noche', 0.375, { color: caramelo });
onWall(r, 'w', 'mesa-noche', 2.825, { color: caramelo });
onWall(r, 'w', 'cuadro-abstracto', 1.6, { width: 1.4, height: 0.7, elevation: 1.3, color: caramelo });
onWall(r, 'e', 'mueble-tv', 1.6, { color: oliva });
onWall(r, 'e', 'televisor-70', 1.6, { gap: 0.02 });
piece('sillon', 4.5, 0.75, 30, { color: pizarra });
onWall(r, 'n', 'cortina', 0.75, { color: arena });
onWall(r, 'n', 'cortina', 5.25, { color: arena });
// Towards the bedroom: open modules facing it in front of the bathroom, then a chest of drawers backing onto the
// dressing room's hanging module, then the 1,1 m way into the dressing room.
onWall(r, 's', 'vestier-repisas', 0.4);
onWall(r, 's', 'vestier-cajones', 1.35);
onWall(r, 's', 'comoda', 2.55, { color: caramelo });

// Walk-in dressing room (user's reference photo) as the suite's lobby, with no walls: the open walnut modules are
// the partitions. Towards the bathroom (x 2) a shoe module facing the dressing room, then the 1 m way into the
// bathroom by the cube wall.
r = R('Vestier');
piece('vestier-colgar', 2.55, SPLIT + 0.275, 0);
piece('vestier-zapatos', 2.275, SPLIT + 0.9, 270);
onWall(r, 'e', 'vestier-repisas', 4.75);
onWall(r, 'e', 'vestier-zapatos', 5.5);
onWall(r, 's', 'vestier-cajones', 3.2, { width: 1.15 });
onWall(r, 's', 'espejo-cuerpo', 2.3, { width: 0.5 });
piece('alfombra', 3.2, 4.85, 0, { width: 1.2, depth: 1.0, color: taupe });
piece('puf', 3.2, 4.85, 0, { color: caramelo });

// Compact master bathroom: the same rain shower, toilet and a single basin; reached through the dressing room.
r = R('Baño principal');
piece('ducha', 0.5, SPLIT + 0.45, 0);
onWall(r, 'w', 'sanitario', 5.0);
onWall(r, 's', 'lavamanos', 1.3);
onWall(r, 's', 'espejo', 1.3, { width: 0.6 });

r = R('Cuarto 3');
onWall(r, 'n', 'cama-doble', 10.3, { color: arena });
onWall(r, 'n', 'mesa-noche', 9.35, { color: caramelo });
onWall(r, 'n', 'mesa-noche', 11.25, { color: caramelo });
onWall(r, 's', 'closet', 9.4, { color: taupe });
onWall(r, 'n', 'cuadro-paisaje', 10.3, { width: 1.1, height: 0.6, elevation: 1.25, color: caramelo });
piece('alfombra', 10.3, 4.7, 0, { width: 2.0, depth: 1.2, color: taupe });
piece('matera', 10.95, 5.85, 0, { color: oliva });

r = R('Baño cuarto 3');
onWall(r, 's', 'ducha', 12.5);
onWall(r, 'w', 'sanitario', 5.0);
onWall(r, 'e', 'lavamanos', 4.85);

r = R('Cuarto 2');
onWall(r, 's', 'cama-doble', 10.3, { color: arena });
onWall(r, 's', 'mesa-noche', 9.35, { color: caramelo });
onWall(r, 's', 'mesa-noche', 11.25, { color: caramelo });
onWall(r, 'n', 'closet', 9.3, { color: taupe });
onWall(r, 's', 'cuadro-byn', 9.95, { color: caramelo });
onWall(r, 's', 'cuadro-byn', 10.65, { color: caramelo });
piece('alfombra', 10.3, 1.0, 0, { width: 2.0, depth: 1.2, color: arena });
piece('matera', 11.1, 0.35, 0, { color: oliva });

r = R('Baño cuarto 2');
onWall(r, 'n', 'ducha', 11.9);
onWall(r, 'e', 'lavamanos', 0.5);
onWall(r, 'e', 'sanitario', 1.3);

// Garage: the two cars on the right, the laundry nook against the left wall by the way out to the patio.
piece('carro', 9.7, DEPTH - 0.3 - 2.25, 270);
piece('carro', 11.9, DEPTH - 0.3 - 2.25, 270, { color: pizarra });
piece('lavadero', 7.775, 6.6, 270);
piece('lavadora', 7.8, 7.6, 270);

// Central patio: plants along the strip by the bedrooms, a tree at the back where it opens to the back patio.
piece('arbol-pequeno', 7.5, 1.0);
piece('arbusto', 8.05, 3.3);
piece('matera', 8.15, 5.4, 0, { color: oliva });
piece('matera', 7.6, 7.3, 0, { color: caramelo });
piece('arbusto', 6.5, 2.0);

// Back patio: stone terrace in front of the master bedroom's glass door, lounge around a fire pit.
piece('brasero', 3.0, -0.9);
piece('sofa-exterior', 3.0, -1.55, 0, { color: taupe });
piece('sillon-exterior', 1.5, -0.75, 270, { color: pizarra });
piece('sillon-exterior', 4.5, -0.75, 90, { color: pizarra });
piece('puf', 2.2, -0.3, 0, { color: caramelo });
piece('jardinera', 3.0, -2.2, 0, { color: oliva });
piece('arbol-pequeno', 9.6, -1.1);
piece('arbol-pequeno', 12.3, -1.1);
piece('matera-alta', 0.4, -1.5, 0, { color: oliva });
piece('matera-alta', 5.6, -1.5, 0, { color: oliva });

// Front porch: a wooden portico over the stone path, a bench and tall plants inside the recess; long planters along
// the cube's tall window give the living room privacy from the street.
// Warm LED lines under the eave (over the porch and the driveway) for the night view.
piece('tira-led', 6.7, DEPTH + 0.5, 0, { width: 1.2, elevation: 2.3, color: '#ffd9a0' });
piece('tira-led', 10.2, DEPTH + 0.5, 0, { width: 5.2, elevation: 2.3, color: '#ffd9a0' });
piece('banca', 7.15, DEPTH - 0.75, 90, { width: 1.1, color: caramelo });
piece('matera-alta', 6.3, DEPTH - 0.3, 0, { color: oliva });
piece('cuadro-paisaje', 6.7, DEPTH - 1.4, 180, { width: 0.6, height: 0.5, elevation: 2.35 }); // número de la casa
piece('jardinera', 1.6, DEPTH + 0.5, 0, { color: pizarra });
piece('jardinera', 3.5, DEPTH + 0.5, 0, { color: pizarra });
piece('arbusto', 5.3, DEPTH + 0.5);
piece('arbusto', 0.3, DEPTH + 0.5);
piece('porton-telescopico', 10.2, DEPTH + 1 - 0.06, 0, { width: 5.6, color: caramelo });
// Landscaping: a small tree at the corner of the lot by the cube, guayacanes on the sidewalk.
piece('arbol-pequeno', -0.5, DEPTH + 0.5);
piece('arbol-guayacan', -1.6, DEPTH + 1.75);
piece('arbol-guayacan', 14.8, DEPTH + 1.75);

// Rooftop over the master suite (plan x 0 → 6, y 0 → 6): lounge under a wooden pergola against the cube's privacy
// wall, BBQ and dining at the back, plants along the edges.
target = rooftop;
piece('pergola', 3.0, 4.3, 0, { width: 5.2, depth: 3.2, color: caramelo });
piece('sofa-exterior', 2.6, 5.5, 180, { color: taupe });
piece('sillon-exterior', 0.9, 4.2, 270, { color: pizarra });
piece('sillon-exterior', 4.3, 4.2, 90, { color: pizarra });
piece('alfombra', 2.6, 4.3, 0, { width: 2.6, depth: 1.8, color: arena });
piece('mesa-centro', 2.6, 4.3, 0, { color: caramelo });
piece('puf', 3.5, 3.4, 0, { color: caramelo });
piece('jardin-vertical', 5.0, 5.85, 180, { width: 1.4 });
piece('parrilla', 1.0, 0.45);
piece('bar', 3.0, 0.45, 0, { color: caramelo });
piece('mesa-exterior', 3.0, 1.9, 0, { color: caramelo });
piece('jardinera', 0.35, 2.6, 90, { color: oliva });
piece('matera-alta', 5.6, 0.4, 0, { color: oliva });
piece('matera-alta', 0.4, 5.6, 0, { color: oliva });

writeFileSync(OUT, JSON.stringify(project, null, 2) + '\n');
execFileSync(process.execPath, [join(root, 'scripts/nuevo-id-ejemplo.mjs'), OUT], { stdio: 'inherit' });
console.log(`Listo: ${OUT}`);
