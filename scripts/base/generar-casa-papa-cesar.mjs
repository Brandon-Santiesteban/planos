// Casa Papá César: one-storey house on a 15 × 15 m lot, from the hand sketch (2026-10-27).
// 1 m of lawn at the front and on both sides, none at the back: the house is 13 m wide × 14 m deep.
// Built with the app's own operations (Playwright drives the dev server), then finished in Node:
// wall finishes, floors, furniture, lawn strips, sidewalk and street.
//
//   node scripts/base/generar-casa-papa-cesar.mjs [puerto]     (needs a dev server, default :5173)
//
// Design coordinates: x 0 → 13 from the left side of the house, y 0 (front, street) → 14 (back of the lot).
// P() turns them into plan coordinates (north up, street at the bottom): plan y = 14 − design y.
// Layout (design metres):
//   front   sala-comedor x 0–5,6 · hall x 5,6–7,4 · garage x 7,4–13 y 0–5,6 (2 cars, open to the street)
//   middle  patio jardín x 0–3,4 y 3,6–8 · cocina y 3,6–6,4 / lavandería y 6,4–8 (x 3,4–6) · pasillo x 6–7,4 to the
//           back · baño social x 7,4–9,4 and jardinera (open) x 9,4–13, both y 5,6–7,6
//   back    master suite 6 × 6 m x 0–6 y 8–14: baño principal x 0–3,2 and vestier x 3,2–6 (y 8–10,4), bedroom
//           y 10,4–14 · cuarto 3 x 7,4–13 y 7,6–10,6 · cuarto 2 y 10,6–14
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { COLORES } from '../casa-completa-acabados.mjs';
import { interior, readCatalog } from '../casa-completa-muebles.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const OUT = join(root, 'public/ejemplos/casa-papa-cesar.casa.json');
const PORT = process.argv[2] ?? '5173';
const DEPTH = 14;

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

  // ======================= Primer piso =======================
  const g = p.floors[0].id;
  ops.renameFloor(p, g, 'Primer piso');

  // --- Outside walls (the garage front stays open to the street) ---
  const frontSala = wall(g, Q(0, 0), Q(5.6, 0), 0.2);
  opening(g, 'window', frontSala, 2.8, { width: 2.4, sill: 0.9, height: 1.4 });
  const frontHall = wall(g, Q(5.6, 0), Q(7.4, 0), 0.2);
  opening(g, 'door', frontHall, 0.9, { width: 1.0 }); // puerta principal
  wall(g, Q(13, 0), Q(13, 5.6), 0.2); // costado del garaje
  wall(g, Q(13, 5.6), Q(13, 7.6), 0.2); // costado de la jardinera
  const rightC3 = wall(g, Q(13, 7.6), Q(13, 10.6), 0.2);
  opening(g, 'window', rightC3, 1.5, { width: 1.4 });
  const rightC2 = wall(g, Q(13, 10.6), Q(13, 14), 0.2);
  opening(g, 'window', rightC2, 1.7, { width: 1.4 });
  wall(g, Q(13, 14), Q(0, 14), 0.2); // fondo: lindero, sin ventanas
  const leftPrincipal = wall(g, Q(0, 14), Q(0, 10.4), 0.2);
  opening(g, 'window', leftPrincipal, 1.8, { width: 1.6 });
  const leftBano = wall(g, Q(0, 10.4), Q(0, 8.0), 0.2);
  opening(g, 'window', leftBano, 1.2, { width: 0.8, sill: 1.5, height: 0.6 });
  wall(g, Q(0, 8.0), Q(0, 3.6), 0.2); // muro del patio hacia el césped lateral
  const leftSala = wall(g, Q(0, 3.6), Q(0, 0), 0.2);
  opening(g, 'window', leftSala, 1.8, { width: 1.6 });

  // --- Inside walls ---
  const salaPatio = wall(g, Q(0, 3.6), Q(3.4, 3.6));
  glassDoor(g, salaPatio, 2.6, { width: 1.4 }); // sala → patio jardín
  const salaCocina = wall(g, Q(3.4, 3.6), Q(6.0, 3.6));
  opening(g, 'door', salaCocina, 1.2, { width: 0.9 }); // comedor → cocina
  const salaHall = wall(g, Q(5.6, 0), Q(5.6, 3.6));
  opening(g, 'door', salaHall, 1.8, { width: 1.2 }); // hall → sala
  const patioCocina = wall(g, Q(3.4, 3.6), Q(3.4, 8.0));
  opening(g, 'window', patioCocina, 1.4, { width: 1.2, sill: 1.0, height: 1.1 }); // cocina → patio
  opening(g, 'door', patioCocina, 3.6, { width: 0.8 }); // lavandería → patio
  const cocinaLav = wall(g, Q(3.4, 6.4), Q(6.0, 6.4));
  opening(g, 'door', cocinaLav, 1.3, { width: 0.8 });
  // Master suite: 6 × 6 m (x 0–6, y 8–14) with its own bathroom and dressing room.
  const patioBano = wall(g, Q(0, 8.0), Q(3.4, 8.0));
  opening(g, 'window', patioBano, 1.6, { width: 1.2, sill: 1.5, height: 0.6 }); // baño principal → patio
  wall(g, Q(3.4, 8.0), Q(6.0, 8.0)); // lavandería | vestier
  const banoVestier = wall(g, Q(3.2, 8.0), Q(3.2, 10.4));
  opening(g, 'door', banoVestier, 1.4, { width: 0.8 });
  const suiteBack = wall(g, Q(0, 10.4), Q(6.0, 10.4)); // baño y vestier | dormitorio
  opening(g, 'door', suiteBack, 4.6, { width: 1.0 }); // dormitorio → vestier
  // Pasillo, left side (cocina, lavandería, vestier, dormitorio principal)
  const pasCocina = wall(g, Q(6.0, 3.6), Q(6.0, 6.4));
  opening(g, 'door', pasCocina, 1.4, { width: 0.9 });
  wall(g, Q(6.0, 6.4), Q(6.0, 8.0));
  wall(g, Q(6.0, 8.0), Q(6.0, 10.4));
  const pasPrincipal = wall(g, Q(6.0, 10.4), Q(6.0, 14));
  opening(g, 'door', pasPrincipal, 0.7, { width: 0.9 });
  // Pasillo, right side (garaje, baño social, cuarto 3, cuarto 2)
  const hallGaraje = wall(g, Q(7.4, 0), Q(7.4, 3.6), 0.15);
  opening(g, 'door', hallGaraje, 2.2, { width: 0.9 });
  wall(g, Q(7.4, 3.6), Q(7.4, 5.6), 0.15);
  const pasBano = wall(g, Q(7.4, 5.6), Q(7.4, 7.6));
  opening(g, 'door', pasBano, 1.0, { width: 0.7 });
  const pasC3 = wall(g, Q(7.4, 7.6), Q(7.4, 10.6));
  opening(g, 'door', pasC3, 2.2, { width: 0.8 });
  const pasC2 = wall(g, Q(7.4, 10.6), Q(7.4, 14));
  opening(g, 'door', pasC2, 0.8, { width: 0.8 });
  wall(g, Q(7.4, 5.6), Q(13, 5.6), 0.15); // garaje | baño social y jardinera
  const banoJardin = wall(g, Q(9.4, 5.6), Q(9.4, 7.6));
  opening(g, 'window', banoJardin, 1.0, { width: 0.6, sill: 1.5, height: 0.6 });
  const jardinC3 = wall(g, Q(7.4, 7.6), Q(13, 7.6));
  opening(g, 'window', jardinC3, 3.6, { width: 1.6 }); // cuarto 3 → jardinera
  wall(g, Q(7.4, 10.6), Q(13, 10.6)); // cuarto 3 | cuarto 2

  room(g, rect(0, 0, 5.6, 3.6), 'Sala-comedor');
  room(g, rect(5.6, 0, 7.4, 3.6), 'Hall');
  room(g, rect(6.0, 3.6, 7.4, 14), 'Pasillo');
  room(g, rect(3.4, 3.6, 6.0, 6.4), 'Cocina');
  room(g, rect(3.4, 6.4, 6.0, 8.0), 'Lavandería');
  room(g, rect(0, 8.0, 3.2, 10.4), 'Baño principal');
  room(g, rect(3.2, 8.0, 6.0, 10.4), 'Vestier');
  room(g, rect(0, 10.4, 6.0, 14), 'Cuarto principal');
  room(g, rect(7.4, 5.6, 9.4, 7.6), 'Baño social');
  room(g, rect(7.4, 10.6, 13, 14), 'Cuarto 2');
  room(g, rect(7.4, 7.6, 13, 10.6), 'Cuarto 3');
  room(g, rect(7.4, 0, 13, 5.6), 'Garaje');
  // Open to the sky: the garden court and the planter between the garage and cuarto 3.
  room(g, rect(0, 3.6, 3.4, 8.0), 'Patio jardín', 'balcony', { openEdges: [0, 1, 2, 3] });
  room(g, rect(9.4, 5.6, 13, 7.6), 'Jardinera', 'balcony', { openEdges: [0, 1, 2, 3] });

  // ======================= Cubierta =======================
  // The roof on its own level, so picking "Primer piso" in the 3D view shows the rooms from above.
  const c = ops.addFloor(p);
  ops.renameFloor(p, c, 'Cubierta');
  const roofs = [[0, 0, 13, 3.6], [3.4, 3.6, 13, 5.6], [3.4, 5.6, 9.4, 7.6], [3.4, 7.6, 13, 8.0], [0, 8.0, 13, 14]];
  roofs.forEach(([x0, y0, x1, y1], i) => {
    const id = room(c, rect(x0, y0, x1, y1), `Cubierta ${i + 1}`, 'roof');
    ops.setRoofHeight(p, c, id, 0.001);
  });

  return serializeProject(p);
}, DEPTH);
await browser.close();
if (errors.length) throw new Error(errors.join('\n'));

const project = JSON.parse(json);
project.id = randomUUID();
const [ground] = project.floors;

// ---------- Finishes ----------
const TOL = 0.01;
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
for (const w of ground.walls) {
  const dx = w.b.x - w.a.x;
  const dy = w.b.y - w.a.y;
  const l = Math.hypot(dx, dy);
  const face = (s) => {
    const off = w.thickness / 2 + 0.05;
    const q = { x: (w.a.x + w.b.x) / 2 + (-dy / l) * s * off, y: (w.a.y + w.b.y) / 2 + (dx / l) * s * off };
    const inside = enclosed.some((r) => pointInPolygon(q, r.points));
    return { finish: 'pintura', color: inside ? COLORES.hueso : COLORES.huesoArenilla };
  };
  w.sides = { left: face(1), right: face(-1) };
}
const MATERIAL = [[/garaje/i, 'concreto'], [/baño|lavander/i, 'ceramica'], [/patio|jardinera/i, 'cesped']];
for (const r of ground.rooms) {
  if (r.kind === 'roof') continue;
  r.floorMaterial = MATERIAL.find(([re]) => re.test(r.name))?.[1] ?? 'porcelanato';
  if (r.kind === 'balcony') r.railingColor = COLORES.huesoArenilla;
}

// ---------- Lot, lawn, sidewalk and street (design coordinates, outside the house) ----------
const D = (x, y) => ({ x, y: DEPTH - y });
const drect = (x0, y0, x1, y1) => [D(x0, y0), D(x1, y0), D(x1, y1), D(x0, y1)];
const EXTERIOR = [
  ['Césped lateral izquierdo', drect(-1, 0, 0, 14), 'cesped'],
  ['Césped lateral derecho', drect(13, 0, 14, 14), 'cesped'],
  ['Césped del frente', drect(-1, -1, 5.8, 0), 'cesped'],
  ['Acceso peatonal', drect(5.8, -1, 7.4, 0), 'piedra'],
  ['Acceso vehicular', drect(7.4, -1, 13, 0), 'concreto'],
  ['Césped esquina', drect(13, -1, 14, 0), 'cesped'],
  ['Andén', drect(-4, -2.5, 17, -1), 'concreto'],
  ['Calle', drect(-4, -9.5, 17, -2.5), 'asfalto'],
];
for (const [name, points, floorMaterial] of EXTERIOR) ground.rooms.push({ id: randomUUID(), name, kind: 'exterior', points, floorMaterial });

// ---------- Furniture ----------
const catalog = readCatalog();
const ROT = { n: 0, s: 180, w: 270, e: 90 };
const round = (v) => Math.round(v * 1000) / 1000;
const piece = (type, x, y, rotation = 0, o = {}) => {
  const c = catalog.get(type);
  if (!c) throw new Error(`No existe en el catálogo: ${type}`);
  const f = {
    id: randomUUID(), type, x: round(x), y: round(y), rotation: ((rotation % 360) + 360) % 360,
    width: o.width ?? c.width, depth: o.depth ?? c.depth, height: o.height ?? c.height, elevation: o.elevation ?? c.elevation,
  };
  if (o.color) f.color = o.color;
  ground.furniture.push(f);
};
/** Back against the wall `side` of the room (plan terms: n = back of the lot, s = street), centred at `at`. */
const onWall = (r, side, type, at, o = {}) => {
  const d = (o.depth ?? catalog.get(type).depth) / 2 + (o.gap ?? 0);
  const pos = { n: [at, r.y0 + d], s: [at, r.y1 - d], w: [r.x0 + d, at], e: [r.x1 - d, at] }[side];
  piece(type, pos[0], pos[1], ROT[side], o);
};
const R = (name) => interior(ground, ground.rooms.find((r) => r.name === name));

// Plan y = 14 − design y. Sala-comedor: y 10,4 → 14.
let r = R('Sala-comedor');
const salaMid = (r.y0 + r.y1) / 2;
onWall(r, 'n', 'mueble-tv', 1.1);
onWall(r, 'n', 'televisor', 1.1, { gap: 0.12 });
onWall(r, 's', 'sofa-3', 1.2);
piece('alfombra', 1.2, salaMid);
piece('mesa-centro', 1.2, salaMid);
piece('mesa-comedor-6', 4.0, salaMid, 90);
for (const dy of [-0.55, 0, 0.55]) {
  piece('silla-comedor', 3.3, salaMid + dy, 270);
  piece('silla-comedor', 4.7, salaMid + dy, 90);
}
piece('lampara-pie', r.x0 + 0.3, r.y1 - 0.3);

r = R('Hall');
onWall(r, 'w', 'matera', r.y0 + 0.5);

r = R('Cocina');
onWall(r, 'w', 'meson', 8.25);
onWall(r, 'w', 'alacena', 8.25);
onWall(r, 'w', 'lavaplatos', 9.25);
onWall(r, 'w', 'estufa', 9.95);
onWall(r, 'n', 'nevera', r.x1 - 0.4);

r = R('Lavandería');
onWall(r, 'n', 'lavadero', 4.75);
onWall(r, 'n', 'lavadora', 5.55);

// Master suite: bedroom with a king bed, dressing room and its own bathroom.
r = R('Cuarto principal');
piece('alfombra', 3.0, r.y0 + 1.6, 0, { width: 2.8, depth: 2.0 });
onWall(r, 'n', 'cama-king', 3.0);
onWall(r, 'n', 'mesa-noche', 1.7);
onWall(r, 'n', 'mesa-noche', 4.3);
onWall(r, 's', 'mueble-tv', 2.6);
onWall(r, 's', 'televisor', 2.6, { gap: 0.12 });
piece('sillon', 0.7, r.y1 - 0.7, 45);
piece('lampara-pie', 0.35, r.y1 - 1.4);

r = R('Vestier');
onWall(r, 's', 'closet', 3.95);
onWall(r, 's', 'closet', 5.2);
onWall(r, 'e', 'closet', 4.4);
onWall(r, 'w', 'espejo-cuerpo', 3.9);

r = R('Baño principal');
onWall(r, 'n', 'ducha', 0.6);
onWall(r, 'n', 'sanitario', 1.6);
onWall(r, 's', 'lavamanos-doble', 1.7);
onWall(r, 's', 'espejo', 1.7, { width: 1.2 });

r = R('Baño social');
onWall(r, 'n', 'ducha', 8.85);
onWall(r, 'e', 'sanitario', 7.7);
onWall(r, 's', 'lavamanos', 8.0);
onWall(r, 's', 'espejo', 8.0);

r = R('Cuarto 2');
onWall(r, 'n', 'cama-doble', 10.6);
onWall(r, 'n', 'mesa-noche', 9.65);
onWall(r, 'n', 'mesa-noche', 11.55);
onWall(r, 's', 'closet', 12.0);
onWall(r, 's', 'escritorio', 9.2);

r = R('Cuarto 3');
onWall(r, 'n', 'cama-doble', 10.6);
onWall(r, 'n', 'mesa-noche', 9.65);
onWall(r, 'n', 'mesa-noche', 11.55);
onWall(r, 's', 'escritorio', 11.0);
onWall(r, 's', 'closet', 8.5);

piece('carro', 8.9, 14 - 0.3 - 2.25, 270);
piece('carro', 11.6, 14 - 0.3 - 2.25, 270);

piece('arbusto', 10.0, 7.4);
piece('arbol-pequeno', 11.6, 7.4);
piece('matera', 12.6, 6.9);

piece('arbol-pequeno', 1.4, 7.2);
piece('arbusto', 0.7, 9.6);
piece('matera', 2.9, 6.5);
piece('banca', 2.7, 8.6, 90);

// Front: shrubs on the lawn and the sliding gate on the lot line in front of the garage (closed).
piece('arbusto', 1.0, DEPTH + 0.5);
piece('arbusto', 4.6, DEPTH + 0.5);
piece('porton-telescopico', 10.2, DEPTH + 1 - 0.06, 0, { width: 5.6 });

writeFileSync(OUT, JSON.stringify(project, null, 2) + '\n');
execFileSync(process.execPath, [join(root, 'scripts/nuevo-id-ejemplo.mjs'), OUT], { stdio: 'inherit' });
console.log(`Listo: ${OUT}`);
