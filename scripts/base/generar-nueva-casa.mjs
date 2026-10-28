// Nueva casa (2026-10-28): a 30 × 32 m site split into two 15 × 32 m lots, with a 3 m parking strip along the whole
// front. Lote 1 (right) gets Casa Papá César's programme reorganised for the bigger lot; Lote 2 (left) is still to
// be designed. Built with the app's own operations (Playwright drives the dev server), then finished in Node.
//
//   node scripts/base/generar-nueva-casa.mjs [puerto]     (needs a dev server, default :5173)
//
// Design coordinates are Lote 1's own: x 0 → 15 from its left boundary, y 0 (street) → 32 (back). X()/Y() (and P()
// inside the page) turn them into plan coordinates for the whole site: plan x = 15 + x, plan y = 32 − y (north up).
// Layout of Lote 1 (design metres), 1 m of lawn on both sides:
//   y 0–3     parking (two cars and a motorbike parked along the street, the walk to the entrance between them)
//   y 3–5     front garden
//   y 5–12    double-height cube x 1–8,8: one open living-dining-kitchen space · covered entrance passage (zaguán)
//             x 8,8–10 straight from the parking to the patio · study, laundry and social bathroom x 10–14
//   y 12–18   central patio x 1–10 with the wooden stair (glass railing) along the suite up to the rooftop
//   y 18–24   master suite 6 × 6 x 1–7 (dressing room + bathroom gallery, bedroom to the back patio) · open
//             passage x 7–10 from the patio to the back patio · cuartos 3 and 2 (x 10–14, y 12–24) with their bathrooms
//   y 24–32   back patio: stone terrace with a fire-pit lounge, lawn and trees
//   up        rooftop over the master suite (BBQ, seating, wooden pergola), screened from the street by the cube
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
const OX = 15; // Lote 1 starts 15 m from the site's left edge
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

const json = await page.evaluate(async ([OX, TOTAL]) => {
  const ops = await import('/src/model/ops.ts');
  const { createEmptyProject } = await import('/src/model/defaults.ts');
  const { serializeProject } = await import('/src/persistence/projectFile.ts');
  const P = (x, y) => ({ x: Math.round((OX + x) * 1e6) / 1e6 + 0, y: Math.round((TOTAL - y) * 1e6) / 1e6 + 0 });
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

  // --- Front (user's reference facade, 2026-10-28): the cube's face set back 0,6 m inside a deep slate frame, clad
  // in vertical wood with a tall dark window slit next to the stone pillar (the zaguán's front); the zaguán's wooden
  // door and the study's big window sit under a low white carport with a wooden ceiling. ---
  opening(g, 'window', wall(g, Q(1, 5), Q(8.8, 5), 0.2), 7.1, { width: 0.7, sill: 0.3, height: 2.3 }); // ranura, mitad baja
  wall(g, Q(1, 4.4), Q(1, 5), 0.2); // marco del cubo
  wall(g, Q(8.8, 4.4), Q(8.8, 5), 0.2);
  opening(g, 'door', wall(g, Q(8.8, 5), Q(10, 5), 0.2), 0.6, { width: 1.0, height: 2.3 }); // puerta del zaguán
  opening(g, 'window', wall(g, Q(10, 5), Q(14, 5), 0.2), 2.0, { width: 2.4, sill: 0.4, height: 2.0 }); // estudio
  wall(g, Q(14.8, 0), Q(14.8, 5), 0.2); // muro blanco del pórtico del parqueadero

  // --- Right side (x 14), facing the 1 m side lawn ---
  opening(g, 'window', wall(g, Q(14, 5), Q(14, 8.2), 0.2), 1.6, { width: 1.2 }); // estudio
  opening(g, 'window', wall(g, Q(14, 8.2), Q(14, 10.2), 0.2), 1.0, high); // lavandería
  opening(g, 'window', wall(g, Q(14, 10.2), Q(14, 12), 0.2), 0.9, high); // baño social
  opening(g, 'window', wall(g, Q(14, 12), Q(14, 15.8), 0.2), 1.8, { width: 1.2 }); // cuarto 3
  opening(g, 'window', wall(g, Q(14, 15.8), Q(14, 18), 0.2), 1.1, high); // baño cuarto 3
  opening(g, 'window', wall(g, Q(14, 18), Q(14, 20.2), 0.2), 1.1, high); // baño cuarto 2
  wall(g, Q(14, 20.2), Q(14, 24), 0.2); // cabecera de la cama del cuarto 2

  // --- Back (y 24): cuarto 2's window, the open passage x 7–10, the master bedroom's big glass door ---
  opening(g, 'window', wall(g, Q(14, 24), Q(10, 24), 0.2), 2.0, { width: 1.6 }); // cuarto 2 → patio trasero
  glassDoor(g, wall(g, Q(7, 24), Q(1, 24), 0.2), 3.0, { width: 3.6, height: 2.3 }); // ventanal del cuarto principal

  // --- Left side (x 1), facing Lote 2 ---
  wall(g, Q(1, 24), Q(1, 20.4), 0.2); // cabecera de la cama: sin ventana
  opening(g, 'window', wall(g, Q(1, 20.4), Q(1, 18), 0.2), 1.2, { width: 0.6, sill: 0.9, height: 1.3 }); // sobre la tina
  wall(g, Q(1, 18), Q(1, 12), 0.2); // muro del patio hacia el lote 2
  opening(g, 'window', wall(g, Q(1, 12), Q(1, 5), 0.2), 2.8, { width: 1.4 }); // comedor

  // --- Social zone: the cube (one open space), the zaguán from the street to the patio, the service rooms ---
  opening(g, 'door', wall(g, Q(8.8, 5), Q(8.8, 12)), 1.4, { width: 1.0 }); // zaguán → sala (entrada principal)
  const service = wall(g, Q(10, 5), Q(10, 12)); // zaguán | estudio, lavandería, baño social
  opening(g, 'door', service, 2.0, { width: 0.8 }); // estudio
  opening(g, 'door', service, 4.2, { width: 0.8 }); // lavandería
  opening(g, 'door', service, 6.1, { width: 0.7 }); // baño social
  wall(g, Q(10, 8.2), Q(14, 8.2));
  wall(g, Q(10, 10.2), Q(14, 10.2));
  wall(g, Q(10, 12), Q(14, 12));
  glassDoor(g, wall(g, Q(1, 12), Q(8.8, 12)), 5.8, { width: 3.0, height: 2.3 }); // cubo ↔ patio central

  // --- Master suite 6 × 6 (user's reference photo): from the bedroom an open doorway leads into one long space that
  // is dressing room and bathroom at once: walnut shelving along the bedroom wall, a long double vanity along the
  // patio wall, at the far end a glass wet room with the rain shower and a freestanding tub under the window. The
  // toilet has its own small room by the entrance, its door facing the dressing room. ---
  opening(g, 'window', wall(g, Q(1, 18), Q(7, 18)), 0.9, high); // zona húmeda; the stair runs along the rest
  const wetGlass = wall(g, Q(2.8, 18), Q(2.8, 20.4), 0.06); // mampara de vidrio de la zona húmeda
  glassDoor(g, wetGlass, 0.7, { width: 0.7 });
  opening(g, 'window', wetGlass, 1.75, { width: 1.0, sill: 0.02, height: 2.1 });
  opening(g, 'door', wall(g, Q(6, 18), Q(6, 19.2), 0.1), 0.6, { width: 0.6 }); // cuarto del sanitario
  wall(g, Q(6, 19.2), Q(7, 19.2), 0.1);
  wall(g, Q(7, 18), Q(7, 20.4));
  opening(g, 'door', wall(g, Q(1, 20.4), Q(7, 20.4)), 5.55, { width: 0.75 }); // dormitorio → vestier y baño
  // Towards the patio passage: the 70" TV hangs on this wall facing the bed, the glass door by the gallery.
  glassDoor(g, wall(g, Q(7, 20.4), Q(7, 24)), 0.7, { width: 0.9 });

  // --- Bedrooms 3 and 2 along the right, each with its own bathroom, doors and windows onto the patio ---
  const c3Patio = wall(g, Q(10, 12), Q(10, 18));
  opening(g, 'door', c3Patio, 1.0, { width: 0.8 });
  opening(g, 'window', c3Patio, 3.6, { width: 1.6 });
  wall(g, Q(10, 18), Q(14, 18)); // cuarto 3 | cuarto 2
  wall(g, Q(12.2, 15.8), Q(12.2, 18));
  opening(g, 'door', wall(g, Q(12.2, 15.8), Q(14, 15.8)), 0.9, { width: 0.7 }); // cuarto 3 → su baño
  const c2Patio = wall(g, Q(10, 18), Q(10, 24));
  opening(g, 'door', c2Patio, 1.0, { width: 0.8 });
  opening(g, 'window', c2Patio, 3.5, { width: 1.6 });
  wall(g, Q(12.2, 18), Q(12.2, 20.2));
  opening(g, 'door', wall(g, Q(12.2, 20.2), Q(14, 20.2)), 0.9, { width: 0.7 }); // cuarto 2 → su baño

  room(g, rect(1, 5, 8.8, 12), 'Sala-comedor-cocina');
  room(g, rect(8.8, 5, 10, 12), 'Zaguán de entrada', 'balcony', { openEdges: [0, 1, 2, 3] });
  room(g, rect(10, 5, 14, 8.2), 'Estudio');
  room(g, rect(10, 8.2, 14, 10.2), 'Lavandería');
  room(g, rect(10, 10.2, 14, 12), 'Baño social');
  room(g, rect(1, 18, 2.8, 20.4), 'Ducha y tina');
  room(g, poly([2.8, 18], [6, 18], [6, 19.2], [7, 19.2], [7, 20.4], [2.8, 20.4]), 'Vestier y baño principal');
  room(g, rect(6, 18, 7, 19.2), 'Sanitario');
  room(g, rect(1, 20.4, 7, 24), 'Cuarto principal');
  room(g, poly([10, 12], [14, 12], [14, 15.8], [12.2, 15.8], [12.2, 18], [10, 18]), 'Cuarto 3');
  room(g, rect(12.2, 15.8, 14, 18), 'Baño cuarto 3');
  room(g, poly([10, 18], [12.2, 18], [12.2, 20.2], [14, 20.2], [14, 24], [10, 24]), 'Cuarto 2');
  room(g, rect(12.2, 18, 14, 20.2), 'Baño cuarto 2');
  // Central patio, open to the sky, to the zaguán and (by the passage x 7–10) to the back patio; the stair runs along
  // the suite's patio wall (x 3–7, y 16,8–18).
  room(g, poly([1, 12], [10, 12], [10, 24], [7, 24], [7, 16.8], [3, 16.8], [3, 18], [1, 18]),
    'Patio central', 'balcony', { openEdges: [0, 1, 2, 3, 4, 5, 6, 7] });
  // Wooden treads with a glass railing, rising towards the patio passage; it lands next to the rooftop.
  room(g, rect(3, 16.8, 7, 18), 'Escalera (madera y vidrio)', 'stairs', { up: 'e', glass: true });

  // ======================= Rooftop =======================
  // The cube's walls carry on up this level and close it with a roof (double height, no slab in between). The
  // rooftop sits over the master suite, at the back: the cube screens it from the street.
  const t = ops.addFloor(p);
  ops.renameFloor(p, t, 'Rooftop');
  opening(t, 'window', wall(t, Q(1, 5), Q(8.8, 5), 0.2), 7.1, { width: 0.7, sill: 0, height: 2.2 }); // ranura, mitad alta
  wall(t, Q(1, 4.4), Q(1, 5), 0.2);
  wall(t, Q(8.8, 4.4), Q(8.8, 5), 0.2);
  opening(t, 'window', wall(t, Q(1, 12), Q(1, 5), 0.2), 2.8, { width: 0.6, sill: 0.4, height: 1.8 }); // ranura lateral
  wall(t, Q(8.8, 5), Q(8.8, 12), 0.2);
  opening(t, 'window', wall(t, Q(1, 12), Q(8.8, 12), 0.2), 3.9, { width: 4.0, sill: 0.8, height: 1.3 }); // clerestorio al patio
  ops.setRoofHeight(p, t, room(t, rect(1, 4.4, 8.8, 12), 'Techo del cubo', 'roof'), 2.6);
  // Deck over the suite plus the landing (x 7–8,2, y 16,8–19,2) where the stair arrives (edge 1, left open).
  room(t, poly([1, 18], [7, 18], [7, 16.8], [8.2, 16.8], [8.2, 19.2], [7, 19.2], [7, 24], [1, 24]), 'Rooftop', 'balcony',
    { openEdges: [1], railing: 'vidrio', floorMaterial: 'madera' });
  // Solid roofs over the one-storey parts, and the carport over the entrance and the driveway (x 8,8–14,9, y 0–5).
  const roofs = [
    ['Pórtico del parqueadero', rect(8.8, 0, 14.9, 5)],
    ['Cubierta del frente', rect(8.8, 5, 14, 12)],
    ['Cubierta de los cuartos', rect(10, 12, 14, 24)],
  ];
  for (const [name, pts] of roofs) ops.setRoofHeight(p, t, room(t, pts, name, 'roof'), 0.001);

  return serializeProject(p);
}, [OX, TOTAL]);
await browser.close();
if (errors.length) throw new Error(errors.join('\n'));

const project = JSON.parse(json);
project.id = randomUUID();
const [ground, rooftop] = project.floors;
const X = (x) => OX + x;
const Y = (y) => TOTAL - y;
const pt = (x, y) => ({ x: X(x), y: Y(y) });

// ---------- Finishes: sand inside and out, the cube in slate with a wooden frame, the zaguán lined in wood ----------
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
const ZAGUAN = [pt(8.8, 5), pt(10, 5), pt(10, 12), pt(8.8, 12)];
const CUBE = [pt(1, 5), pt(8.8, 5), pt(8.8, 12), pt(1, 12)];
const near = (a, b) => Math.abs(a - b) < 1e-6;
const BLANCO = '#EEEAE4';
// The cube's face (y 5) is clad in wood; its frame fins (y 4,4–5) are slate on both sides.
const onFrame = (w) => near(w.a.y, Y(5)) && near(w.b.y, Y(5)) && Math.min(w.a.x, w.b.x) > X(0.9) && Math.max(w.a.x, w.b.x) < X(8.9);
const isFin = (w) => Math.max(w.a.y, w.b.y) > Y(5) + 0.01 && near(w.a.x, w.b.x) && (near(w.a.x, X(1)) || near(w.a.x, X(8.8)));
const onCube = (w) => [w.a, w.b].every((q) => q.x >= X(1) - 0.01 && q.x <= X(8.8) + 0.01 && q.y >= Y(12) - 0.01 && q.y <= Y(5) + 0.01)
  && (near(w.a.x, w.b.x) ? near(w.a.x, X(1)) : near(w.a.y, Y(5)));
const faceOf = (w, s) => {
  const dx = w.b.x - w.a.x;
  const dy = w.b.y - w.a.y;
  const l = Math.hypot(dx, dy);
  const off = w.thickness / 2 + 0.05;
  return { x: (w.a.x + w.b.x) / 2 + (-dy / l) * s * off, y: (w.a.y + w.b.y) / 2 + (dx / l) * s * off };
};
for (const w of rooftop.walls) {
  const face = (s) => {
    if (pointInPolygon(faceOf(w, s), CUBE)) return { finish: 'pintura', color: PALETA.arena };
    if (isFin(w)) return { finish: 'pintura', color: PALETA.pizarra };
    return onFrame(w) ? { finish: 'madera' } : { finish: 'pintura', color: PALETA.pizarra };
  };
  w.sides = { left: face(1), right: face(-1) };
}
for (const w of ground.walls) {
  const face = (s) => {
    const q = faceOf(w, s);
    if (enclosed.some((r) => pointInPolygon(q, r.points))) return { finish: 'pintura', color: PALETA.arena };
    if (isFin(w)) return { finish: 'pintura', color: PALETA.pizarra };
    if (near(w.a.x, X(14.8)) && near(w.b.x, X(14.8))) return { finish: 'pintura', color: BLANCO };
    const front = near(w.a.y, Y(5)) && near(w.b.y, Y(5)) && q.y > Y(5);
    if (front && Math.min(w.a.x, w.b.x) > X(8.7) && Math.max(w.a.x, w.b.x) < X(10.1)) return { finish: 'piedra' };
    if (front && Math.min(w.a.x, w.b.x) > X(9.9)) return { finish: 'pintura', color: PALETA.pizarra };
    if (onFrame(w)) return { finish: 'madera' };
    if (onCube(w)) return { finish: 'pintura', color: PALETA.pizarra };
    return pointInPolygon(q, ZAGUAN) ? { finish: 'madera' } : { finish: 'pintura', color: PALETA.arena };
  };
  w.sides = { left: face(1), right: face(-1) };
}
const MATERIAL = [[/baño|ducha|sanitario|lavander/i, 'ceramica'], [/patio/i, 'cesped'], [/zagu/i, 'piedra']];
for (const r of ground.rooms) {
  if (r.kind === 'roof' || r.kind === 'stairs') continue;
  r.floorMaterial = MATERIAL.find(([re]) => re.test(r.name))?.[1] ?? 'porcelanato';
}
rooftop.rooms.find((r) => r.name === 'Rooftop').railingColor = PALETA.pizarra;
// Solid roofs: the cube's lid and frame in slate, sand over the rest; the carport white with a wooden ceiling.
const ROOFS = { 'Techo del cubo': PALETA.pizarra, 'Cubierta del frente': PALETA.arena, 'Cubierta de los cuartos': PALETA.arena };
for (const [name, edgeColor] of Object.entries(ROOFS)) Object.assign(rooftop.rooms.find((r) => r.name === name), { floorMaterial: 'concreto', edgeColor });
Object.assign(rooftop.rooms.find((r) => r.name === 'Pórtico del parqueadero'), { floorMaterial: 'madera', edgeColor: BLANCO });

// ---------- Site: parking strip, gardens, back patio, Lote 2, sidewalk and street (Lote 1 design coordinates) ----------
const drect = (x0, y0, x1, y1) => [pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1)];
const EXTERIOR = [
  ['Parqueadero lote 1', drect(0, 0, 15, 3), 'porcelanato'],
  ['Parqueadero lote 2', drect(-15, 0, 0, 3), 'concreto'],
  ['Lote 2 (por diseñar)', drect(-15, 3, 0, 32), 'tierra'],
  ['Jardín del frente', drect(0, 3, 8.8, 5), 'cesped'],
  ['Acceso bajo el pórtico', drect(8.8, 3, 15, 5), 'porcelanato'],
  ['Césped lateral izquierdo', drect(0, 5, 1, 24), 'cesped'],
  ['Césped lateral derecho', drect(14, 5, 15, 24), 'cesped'],
  ['Terraza del patio trasero', drect(1, 24, 10, 28), 'piedra'],
  ['Patio trasero (césped)', drect(0, 28, 15, 32), 'cesped'],
  ['Patio trasero izquierdo', drect(0, 24, 1, 28), 'cesped'],
  ['Patio trasero derecho', drect(10, 24, 15, 28), 'cesped'],
  ['Andén', drect(-16, -1.5, 16, 0), 'concreto'],
  ['Calle', drect(-16, -8.5, 16, -1.5), 'asfalto'],
];
for (const [name, points, floorMaterial] of EXTERIOR) ground.rooms.push({ id: randomUUID(), name, kind: 'exterior', points, floorMaterial });

// ---------- Furniture (plan coordinates through X()/Y(); n = back of the lot, s = street) ----------
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
/** Back against the wall `side` of the room, centred at `at` along it (plan coordinate). */
const onWall = (r, side, type, at, o = {}) => {
  const d = (o.depth ?? catalog.get(type).depth) / 2 + (o.gap ?? 0);
  const pos = { n: [at, r.y0 + d], s: [at, r.y1 - d], w: [r.x0 + d, at], e: [r.x1 - d, at] }[side];
  piece(type, pos[0], pos[1], ROT[side], o);
};
const R = (name) => interior(ground, ground.rooms.find((r) => r.name === name));
const { arena, taupe, oliva, pizarra, caramelo } = PALETA;

// The cube: kitchen along the patio wall with an island, dining by the big glass door to the patio, living room at
// the front facing a 70" TV on the left wall.
let r = R('Sala-comedor-cocina');
onWall(r, 'n', 'nevera', X(1.45));
onWall(r, 'n', 'meson', X(2.4), { color: arena });
onWall(r, 'n', 'alacena', X(2.4), { color: oliva });
onWall(r, 'n', 'lavaplatos', X(3.4), { color: arena });
onWall(r, 'n', 'estufa', X(4.1));
onWall(r, 'n', 'alacena', X(3.75), { color: oliva });
piece('bar', X(2.8), Y(10.1), 0, { color: caramelo }); // isla con taburetes
piece('mesa-comedor-6', X(6.8), Y(10.0), 0, { color: caramelo });
for (const x of [6.25, 6.8, 7.35]) {
  piece('silla-comedor', X(x), Y(10.0) - 0.85, 0, { color: pizarra });
  piece('silla-comedor', X(x), Y(10.0) + 0.85, 180, { color: pizarra });
}
onWall(r, 'w', 'mueble-tv', Y(6.8), { width: 2.0, color: oliva });
onWall(r, 'w', 'televisor-70', Y(6.8), { gap: 0.02 });
piece('alfombra', X(3.0), Y(6.8), 90, { width: 2.6, depth: 2.0, color: arena });
piece('mesa-centro', X(3.0), Y(6.8), 90, { color: caramelo });
piece('sofa-l', X(4.4), Y(6.8), 90, { color: taupe });
piece('sillon', X(2.6), Y(5.65), 180, { color: pizarra });
piece('lampara-pie', X(5.4), Y(8.2));
onWall(r, 'e', 'cuadro-abstracto', Y(9.0), { width: 1.4, height: 0.9, elevation: 1.4, color: caramelo });

// Zaguán: a tall plant by the front door, a bench halfway, plants towards the patio; house number outside.
r = R('Zaguán de entrada');
piece('matera-alta', X(9.4), Y(5.45), 0, { color: oliva });
onWall(r, 'w', 'banca', Y(9.0), { width: 1.2, color: caramelo });
piece('matera', X(9.4), Y(11.5), 0, { color: caramelo });
piece('cuadro-paisaje', X(9.4), Y(5) + 0.12, 0, { width: 0.6, height: 0.25, elevation: 2.35 }); // número de la casa

r = R('Estudio');
onWall(r, 'e', 'escritorio', Y(6.6), { color: caramelo });
piece('silla-oficina', X(12.9), Y(6.6), 270);
onWall(r, 'n', 'estanteria', X(11.0), { color: caramelo });
piece('sillon', X(10.75), Y(5.75), 180, { color: taupe });

r = R('Lavandería');
onWall(r, 'n', 'lavadero', X(12.75));
onWall(r, 'n', 'lavadora', X(13.5));
onWall(r, 's', 'meson', X(13.2), { width: 1.4, color: arena }); // mesón para doblar

r = R('Baño social');
onWall(r, 'n', 'sanitario', X(13.4));
onWall(r, 'e', 'lavamanos', Y(10.9));
onWall(r, 'e', 'espejo', Y(10.9), { width: 0.6 });

// Master bedroom: bed against the left wall, the 70" TV facing it, big glass door to the back patio.
r = R('Cuarto principal');
const bed = Y(22.4);
piece('alfombra', X(2.9), bed, 90, { width: 2.8, depth: 2.2, color: taupe });
onWall(r, 'w', 'cama-king', bed, { color: arena });
onWall(r, 'w', 'mesa-noche', bed - 1.225, { color: caramelo });
onWall(r, 'w', 'mesa-noche', bed + 1.225, { color: caramelo });
onWall(r, 'w', 'cuadro-abstracto', bed, { width: 1.4, height: 0.7, elevation: 1.3, color: caramelo });
onWall(r, 'e', 'mueble-tv', bed, { color: oliva });
onWall(r, 'e', 'televisor-70', bed, { gap: 0.02 });
piece('sillon', X(5.5), Y(23.25), 30, { color: pizarra });
onWall(r, 'n', 'cortina', X(1.75), { color: arena });
onWall(r, 'n', 'cortina', X(6.25), { color: arena });
onWall(r, 's', 'comoda', X(4.0), { color: caramelo });

// Dressing room and bathroom in one (x 2,8–7, y 18–20,4): walnut shelving on the bedroom wall, the double vanity on
// the patio wall, the aisle leads to the glass wet room; the toilet in its own room by the entrance.
const GAL = { y0: Y(20.4) + 0.05, y1: Y(18) - 0.05 };
piece('vestier-colgar', X(3.35), GAL.y0 + 0.275, 0);
piece('vestier-repisas', X(4.2), GAL.y0 + 0.275, 0);
piece('vestier-zapatos', X(4.9), GAL.y0 + 0.275, 0);
piece('vestier-cajones', X(5.7), GAL.y0 + 0.275, 0, { width: 0.9 });
piece('lavamanos-doble', X(3.9), GAL.y1 - 0.25, 180, { color: caramelo });
piece('espejo', X(3.6), GAL.y1 - 0.02, 180, { width: 0.6, height: 0.8 });
piece('espejo', X(4.3), GAL.y1 - 0.02, 180, { width: 0.6, height: 0.8 });
piece('alfombra', X(4.4), Y(19.2), 0, { width: 1.0, depth: 0.6, color: arena });
piece('banera', X(1.45), Y(19.2), 90);
piece('ducha', X(2.3), GAL.y0 + 0.45, 0);
piece('toallero', X(2.3), GAL.y1 - 0.06, 180);
piece('sanitario', X(6.5), GAL.y1 - 0.35, 180);

r = R('Cuarto 3');
onWall(r, 's', 'cama-doble', X(12.0), { color: arena });
onWall(r, 's', 'mesa-noche', X(11.075), { color: caramelo });
onWall(r, 's', 'mesa-noche', X(12.925), { color: caramelo });
onWall(r, 's', 'cuadro-paisaje', X(12.0), { width: 1.1, height: 0.6, elevation: 1.25, color: caramelo });
onWall(r, 'w', 'closet', Y(17.3), { color: taupe });
piece('alfombra', X(12.0), Y(14.6), 0, { width: 2.0, depth: 1.2, color: taupe });
piece('matera', X(13.6), Y(15.4), 0, { color: oliva });

r = R('Baño cuarto 3');
onWall(r, 'n', 'ducha', X(13.5));
onWall(r, 'w', 'sanitario', Y(17.3));
onWall(r, 'e', 'lavamanos', Y(16.45));

r = R('Cuarto 2');
onWall(r, 'e', 'cama-doble', Y(22.0), { color: arena });
onWall(r, 'e', 'mesa-noche', Y(22.0) - 0.925, { color: caramelo });
onWall(r, 'e', 'mesa-noche', Y(22.0) + 0.925, { color: caramelo });
onWall(r, 'e', 'cuadro-byn', Y(21.65), { elevation: 1.3, color: caramelo });
onWall(r, 'e', 'cuadro-byn', Y(22.35), { elevation: 1.3, color: caramelo });
onWall(r, 'w', 'closet', Y(23.2), { color: taupe });
piece('alfombra', X(11.5), Y(22.0), 90, { width: 2.0, depth: 1.2, color: arena });
piece('matera', X(11.85), Y(18.4), 0, { color: oliva });

r = R('Baño cuarto 2');
onWall(r, 's', 'ducha', X(13.5));
onWall(r, 'w', 'sanitario', Y(18.8));
onWall(r, 'e', 'lavamanos', Y(19.6));

// Central patio: a tree and benches on the left, plants along the bedrooms, a lounge corner by the passage.
piece('arbol-pequeno', X(2.6), Y(14.4));
piece('banca', X(1.35), Y(15.5), 270, { width: 1.4, color: caramelo });
piece('jardinera', X(5.0), Y(16.5), 0, { width: 2.6, color: oliva });
piece('arbusto', X(9.4), Y(14.0));
piece('matera', X(9.6), Y(16.8), 0, { color: caramelo });
piece('sillon-exterior', X(8.4), Y(21.0), 90, { color: pizarra });
piece('sillon-exterior', X(8.4), Y(22.2), 90, { color: pizarra });
piece('matera-alta', X(9.6), Y(23.5), 0, { color: oliva });

// Back patio: stone terrace with a lounge around a fire pit in front of the master bedroom, an outdoor dining table,
// lawn and trees at the back.
piece('brasero', X(4.0), Y(25.6));
piece('sofa-exterior', X(4.0), Y(26.6), 0, { color: taupe });
piece('sillon-exterior', X(2.4), Y(25.6), 270, { color: pizarra });
piece('sillon-exterior', X(5.6), Y(25.6), 90, { color: pizarra });
piece('mesa-exterior', X(8.4), Y(26.0), 0, { color: caramelo });
piece('jardinera', X(4.0), Y(27.6), 0, { color: oliva });
piece('arbol-pequeno', X(2.5), Y(30.0));
piece('arbol-pequeno', X(8.0), Y(30.5));
piece('arbol-pequeno', X(13.0), Y(29.5));
piece('arbusto', X(12.5), Y(25.5));

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

// Rooftop over the master suite: lounge under a wooden pergola on the patio side, BBQ and dining at the back,
// plants along the edges.
target = rooftop;
// Over the front block, behind the carport: a green roof of planters, seen from the street as in the reference.
piece('jardinera', X(11.0), Y(5.6), 0, { width: 2.0, color: pizarra });
piece('jardinera', X(13.0), Y(5.6), 0, { width: 1.8, color: pizarra });
piece('tira-led', X(4.9), Y(4.7), 0, { width: 7.4, elevation: 2.3, color: '#ffd9a0' }); // luz bajo el marco del cubo
piece('pergola', X(4.0), Y(19.7), 0, { width: 5.2, depth: 3.2, color: caramelo });
piece('sofa-exterior', X(3.6), Y(18.5), 180, { color: taupe });
piece('sillon-exterior', X(1.9), Y(19.8), 270, { color: pizarra });
piece('sillon-exterior', X(5.3), Y(19.8), 90, { color: pizarra });
piece('alfombra', X(3.6), Y(19.7), 0, { width: 2.6, depth: 1.8, color: arena });
piece('mesa-centro', X(3.6), Y(19.7), 0, { color: caramelo });
piece('puf', X(4.5), Y(20.6), 0, { color: caramelo });
piece('parrilla', X(2.0), Y(23.55));
piece('bar', X(4.0), Y(23.55), 0, { color: caramelo });
piece('mesa-exterior', X(4.0), Y(22.1), 0, { color: caramelo });
piece('jardinera', X(1.35), Y(21.4), 90, { color: oliva });
piece('matera-alta', X(6.6), Y(23.6), 0, { color: oliva });
piece('matera-alta', X(1.4), Y(18.4), 0, { color: oliva });

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
