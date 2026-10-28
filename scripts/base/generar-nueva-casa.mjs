// Nueva casa (2026-10-28): a 30 × 32 m site split into two 15 × 32 m lots, with a 3 m parking strip along the whole
// front. Lote 1 (right) gets Casa Papá César's programme as a modern tropical house; Lote 2 (left) is still to be
// designed. Built with the app's own operations (Playwright drives the dev server), then finished in Node.
//
//   node scripts/base/generar-nueva-casa.mjs [puerto]     (needs a dev server, default :5173)
//
// Design coordinates are Lote 1's own: x 0 → 15 from its left boundary, y 0 (street) → 32 (back). X()/Y() (and P()
// inside the page) turn them into plan coordinates for the whole site: plan x = 15 + x, plan y = 32 − y (north up).
// Brief (user, 2026-10-28): modern and elegant, no corridors, lots of air flow for the tropical climate, double-height
// spaces. Principles taken from courtyard houses in hot climates: every room opens straight onto the central patio
// (no hall anywhere), each room has openings on opposite sides for cross-ventilation, double-height volumes with
// high windows let hot air out, a slatted screen (celosía) lets the breeze into the patio.
// Layout of Lote 1 (design metres), 1 m of lawn on both sides:
//   y 0–3     parking; a white carport over its right part (one car under it), a car and a motorbike in front of
//             the cube
//   y 5–12    one open social space: double-height cube x 1–8,8 (living, dining, a tree inside) and the kitchen
//             x 8,8–14; the front door opens straight into it
//   y 12–18   study x 1–4,5 · central patio x 4,5–10,5 with the floating wooden stair · social bathroom and laundry
//             x 10,5–14, the drying corner behind a celosía
//   y 18–24   master suite x 1–7, double height (bedroom between the patio and the back patio; dressing room and
//             bathroom gallery on the left) · bedrooms 2 and 3 x 7–14, each with its bathroom
//   y 24–32   back patio: stone terrace with a fire-pit lounge, lawn and trees
//   up        rooftop over bedrooms 2 and 3 (BBQ, bar, wooden pergola)
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
  // in vertical wood with a tall window slit; the front door by a stone pillar and the kitchen's window under a low
  // white carport with a wooden ceiling. ---
  opening(g, 'window', wall(g, Q(1, 5), Q(8.8, 5), 0.2), 7.1, { width: 0.7, sill: 0.3, height: 2.3 }); // ranura, mitad baja
  wall(g, Q(1, 4.4), Q(1, 5), 0.2); // marco del cubo
  wall(g, Q(8.8, 4.4), Q(8.8, 5), 0.2);
  opening(g, 'door', wall(g, Q(8.8, 5), Q(10.4, 5), 0.2), 0.8, { width: 1.1, height: 2.4 }); // puerta principal
  opening(g, 'window', wall(g, Q(10.4, 5), Q(14, 5), 0.2), 1.8, { width: 2.4, sill: 0.9, height: 1.4 }); // cocina
  wall(g, Q(14.8, 0), Q(14.8, 5), 0.2); // muro blanco del pórtico del parqueadero

  // --- Sides: windows facing each other across the house so the breeze crosses it (x 1 ↔ x 14) ---
  opening(g, 'window', wall(g, Q(1, 12), Q(1, 5), 0.2), 3.5, { width: 1.6, height: 1.5 }); // sala
  opening(g, 'window', wall(g, Q(1, 18), Q(1, 12), 0.2), 3.0, { width: 2.0, height: 1.6 }); // estudio
  opening(g, 'window', wall(g, Q(1, 24), Q(1, 18), 0.2), 3.3, { width: 1.2, sill: 1.6, height: 0.5 }); // vestier y baño, alta
  opening(g, 'window', wall(g, Q(14, 5), Q(14, 12), 0.2), 4.0, { width: 2.0, sill: 1.0, height: 1.2 }); // cocina
  opening(g, 'window', wall(g, Q(14, 12), Q(14, 14), 0.2), 1.0, high); // baño social
  opening(g, 'window', wall(g, Q(14, 14), Q(14, 16), 0.2), 1.0, high); // lavandería
  opening(g, 'window', wall(g, Q(14, 18), Q(14, 22), 0.2), 2.0, { width: 1.2 }); // cuarto 3
  opening(g, 'window', wall(g, Q(14, 22), Q(14, 24), 0.2), 1.0, high); // baño cuarto 3

  // --- Back (y 24): every bedroom also opens to the back, opposite its door to the patio ---
  const backSuite = wall(g, Q(7, 24), Q(1, 24), 0.2);
  glassDoor(g, backSuite, 1.8, { width: 3.0, height: 2.4 }); // ventanal del cuarto principal
  opening(g, 'window', backSuite, 4.8, { width: 1.2, sill: 0.9, height: 1.3 }); // sobre la tina
  opening(g, 'window', wall(g, Q(10.5, 24), Q(7, 24), 0.2), 0.85, { width: 1.4 }); // cuarto 2
  opening(g, 'window', wall(g, Q(14, 24), Q(10.5, 24), 0.2), 2.65, { width: 1.4 }); // cuarto 3

  // --- Social zone: one open space, no hall. The front door opens straight into it: the double-height cube
  // (living and dining) and the kitchen beside it with no wall between them; big glass doors to the patio. ---
  const kitchenBack = wall(g, Q(8.8, 12), Q(14, 12)); // cocina | patio y servicios
  glassDoor(g, kitchenBack, 0.85, { width: 1.0 }); // cocina → patio
  const cubeBack = wall(g, Q(1, 12), Q(8.8, 12)); // cubo | estudio y patio
  glassDoor(g, cubeBack, 1.75, { width: 1.2 }); // sala → estudio
  glassDoor(g, cubeBack, 5.65, { width: 3.6, height: 2.4 }); // sala-comedor ↔ patio central

  // --- Around the patio, every room opens straight onto it ---
  const studyPatio = wall(g, Q(4.5, 12), Q(4.5, 18)); // estudio | patio
  glassDoor(g, studyPatio, 1.5, { width: 1.0 });
  opening(g, 'window', studyPatio, 4.2, { width: 1.8 });
  const service = wall(g, Q(10.5, 12), Q(10.5, 16)); // patio | baño social y lavandería
  opening(g, 'door', service, 1.0, { width: 0.8 }); // baño social
  opening(g, 'door', service, 3.0, { width: 0.8 }); // lavandería
  wall(g, Q(10.5, 14), Q(14, 14));
  opening(g, 'door', wall(g, Q(10.5, 16), Q(14, 16)), 2.6, { width: 0.8 }); // lavandería → tendedero (rincón del patio)

  // --- Master suite (x 1–7, y 18–24), double height: the bedroom (x 3,4–7) opens to the patio at the front and to
  // the back patio through the big glass door; the dressing room and bathroom (user's reference photo) run along
  // the left: toilet by the entrance, walnut shelving on the bedroom wall, double vanity on the outer wall, and the
  // glass wet room with shower and freestanding tub at the end, under the back window. ---
  wall(g, Q(1, 18), Q(4.5, 18)); // estudio | vestier
  glassDoor(g, wall(g, Q(4.5, 18), Q(7, 18)), 1.25, { width: 2.0, height: 2.4 }); // cuarto principal ↔ patio
  opening(g, 'door', wall(g, Q(3.4, 18), Q(3.4, 22)), 1.0, { width: 0.75 }); // dormitorio → vestier y baño
  wall(g, Q(3.4, 22), Q(3.4, 24));
  opening(g, 'door', wall(g, Q(1, 19.4), Q(2.2, 19.4), 0.1), 0.6, { width: 0.6 }); // cuarto del sanitario
  wall(g, Q(2.2, 18), Q(2.2, 19.4), 0.1);
  const wetGlass = wall(g, Q(1, 22), Q(3.4, 22), 0.06); // mampara de vidrio de la zona húmeda
  glassDoor(g, wetGlass, 0.6, { width: 0.7 });
  opening(g, 'window', wetGlass, 1.75, { width: 1.0, sill: 0.02, height: 2.1 });
  wall(g, Q(7, 18), Q(7, 24)); // cuarto principal | cuarto 2 (the TV hangs here)

  // --- Bedrooms 2 and 3: glass door to the patio, window to the back patio, bathroom in the back corner ---
  glassDoor(g, wall(g, Q(7, 18), Q(10.5, 18)), 2.4, { width: 1.0 }); // cuarto 2 ↔ patio
  const c3Front = wall(g, Q(10.5, 18), Q(14, 18));
  glassDoor(g, c3Front, 1.0, { width: 1.0 }); // cuarto 3 ↔ patio
  opening(g, 'window', c3Front, 2.7, { width: 1.0 });
  wall(g, Q(10.5, 18), Q(10.5, 24)); // cuarto 2 | cuarto 3
  wall(g, Q(8.8, 22), Q(8.8, 24));
  opening(g, 'door', wall(g, Q(7, 22), Q(8.8, 22)), 0.9, { width: 0.7 }); // cuarto 2 → su baño
  wall(g, Q(12.2, 22), Q(12.2, 24));
  opening(g, 'door', wall(g, Q(12.2, 22), Q(14, 22)), 0.9, { width: 0.7 }); // cuarto 3 → su baño

  room(g, poly([1, 5], [14, 5], [14, 12], [1, 12]), 'Sala-comedor-cocina');
  room(g, rect(1, 12, 4.5, 18), 'Estudio');
  room(g, rect(10.5, 12, 14, 14), 'Baño social');
  room(g, rect(10.5, 14, 14, 16), 'Lavandería');
  room(g, rect(1, 18, 2.2, 19.4), 'Sanitario');
  room(g, poly([1, 19.4], [2.2, 19.4], [2.2, 18], [3.4, 18], [3.4, 22], [1, 22]), 'Vestier y baño principal');
  room(g, rect(1, 22, 3.4, 24), 'Ducha y tina');
  room(g, rect(3.4, 18, 7, 24), 'Cuarto principal');
  room(g, poly([7, 18], [10.5, 18], [10.5, 24], [8.8, 24], [8.8, 22], [7, 22]), 'Cuarto 2');
  room(g, rect(7, 22, 8.8, 24), 'Baño cuarto 2');
  room(g, poly([10.5, 18], [14, 18], [14, 22], [12.2, 22], [12.2, 24], [10.5, 24]), 'Cuarto 3');
  room(g, rect(12.2, 22, 14, 24), 'Baño cuarto 3');
  // Central patio, open to the sky; a wooden-slat screen (celosía) on its side towards the lot boundary (edge 3)
  // lets the breeze in and hides the drying corner. The stair floats in it (x 7–8,2, y 14–18).
  room(g, poly([4.5, 12], [10.5, 12], [10.5, 16], [14, 16], [14, 18], [8.2, 18], [8.2, 14], [7, 14], [7, 18], [4.5, 18]),
    'Patio central', 'balcony', { openEdges: [0, 1, 2, 4, 5, 6, 7, 8, 9], railing: 'celosia' });
  // Wooden treads with a glass railing, rising towards the bedrooms; it lands on the rooftop over them.
  room(g, rect(7, 14, 8.2, 18), 'Escalera (madera y vidrio)', 'stairs', { up: 'n', glass: true });

  // ======================= Rooftop =======================
  // Two double-height volumes carry on up this level: the social cube at the front and the master suite at the back.
  // Their high windows on opposite sides let the hot air out (stack effect). The rooftop sits over bedrooms 2 and 3.
  const t = ops.addFloor(p);
  ops.renameFloor(p, t, 'Rooftop');
  opening(t, 'window', wall(t, Q(1, 5), Q(8.8, 5), 0.2), 7.1, { width: 0.7, sill: 0, height: 2.2 }); // ranura, mitad alta
  wall(t, Q(1, 4.4), Q(1, 5), 0.2);
  wall(t, Q(8.8, 4.4), Q(8.8, 5), 0.2);
  opening(t, 'window', wall(t, Q(1, 12), Q(1, 5), 0.2), 3.5, { width: 1.6, sill: 0.6, height: 1.4 }); // alta, lateral
  opening(t, 'window', wall(t, Q(8.8, 5), Q(8.8, 12), 0.2), 3.5, { width: 3.0, sill: 0.6, height: 1.4 }); // alta, sobre la cocina
  opening(t, 'window', wall(t, Q(1, 12), Q(8.8, 12), 0.2), 5.65, { width: 3.6, sill: 0.6, height: 1.4 }); // alta, al patio
  ops.setRoofHeight(p, t, room(t, rect(1, 4.4, 8.8, 12), 'Techo del cubo', 'roof'), 2.6);
  opening(t, 'window', wall(t, Q(1, 18), Q(7, 18), 0.2), 4.0, { width: 3.0, sill: 0.8, height: 1.2 }); // suite, alta al patio
  opening(t, 'window', wall(t, Q(7, 24), Q(1, 24), 0.2), 3.0, { width: 4.0, sill: 0.8, height: 1.2 }); // suite, alta atrás
  wall(t, Q(1, 18), Q(1, 24), 0.2);
  wall(t, Q(7, 18), Q(7, 24), 0.2);
  ops.setRoofHeight(p, t, room(t, rect(1, 18, 7, 24), 'Techo de la suite', 'roof'), 2.6);
  // Deck over bedrooms 2 and 3; the stair arrives on edge 0, edge 4 runs along the suite's wall.
  room(t, poly([7, 18], [8.2, 18], [14, 18], [14, 24], [7, 24]), 'Rooftop', 'balcony',
    { openEdges: [0, 4], railing: 'vidrio', floorMaterial: 'madera' });
  // Solid roofs over the one-storey parts, and the carport over the entrance and the driveway.
  const roofs = [
    ['Pórtico del parqueadero', rect(8.8, 0, 14.9, 5)],
    ['Cubierta de la cocina', rect(8.8, 5, 14, 12)],
    ['Cubierta del estudio', rect(1, 12, 4.5, 18)],
    ['Cubierta de servicios', rect(10.5, 12, 14, 16)],
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

// ---------- Finishes: sand inside and out; the cube in slate framing a wooden face; the suite's upper volume in
// wood; a stone pillar by the front door ----------
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
const CUBE = [pt(1, 5), pt(8.8, 5), pt(8.8, 12), pt(1, 12)];
const SUITE = [pt(1, 18), pt(7, 18), pt(7, 24), pt(1, 24)];
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
    const q = faceOf(w, s);
    if (pointInPolygon(q, CUBE) || pointInPolygon(q, SUITE)) return { finish: 'pintura', color: PALETA.arena };
    if (isFin(w)) return { finish: 'pintura', color: PALETA.pizarra };
    if (onFrame(w)) return { finish: 'madera' };
    return Math.max(w.a.y, w.b.y) <= Y(18) + 0.01 ? { finish: 'madera' } : { finish: 'pintura', color: PALETA.pizarra };
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
    if (front && Math.min(w.a.x, w.b.x) > X(8.7) && Math.max(w.a.x, w.b.x) < X(10.5)) return { finish: 'piedra' };
    if (front && Math.min(w.a.x, w.b.x) > X(10.3)) return { finish: 'pintura', color: PALETA.pizarra };
    if (onFrame(w)) return { finish: 'madera' };
    if (onCube(w)) return { finish: 'pintura', color: PALETA.pizarra };
    return { finish: 'pintura', color: PALETA.arena };
  };
  w.sides = { left: face(1), right: face(-1) };
}
const MATERIAL = [[/baño|ducha|sanitario|lavander/i, 'ceramica'], [/patio/i, 'cesped']];
for (const r of ground.rooms) {
  if (r.kind === 'roof' || r.kind === 'stairs') continue;
  r.floorMaterial = MATERIAL.find(([re]) => re.test(r.name))?.[1] ?? 'porcelanato';
}
ground.rooms.find((r) => r.name === 'Patio central').railingColor = PALETA.caramelo;
rooftop.rooms.find((r) => r.name === 'Rooftop').railingColor = PALETA.pizarra;
// Solid roofs: the cube's lid and frame in slate, the suite's in wood tone, sand over the rest; the carport white
// with a wooden ceiling.
const ROOFS = {
  'Techo del cubo': PALETA.pizarra, 'Techo de la suite': PALETA.caramelo, 'Cubierta de la cocina': PALETA.arena,
  'Cubierta del estudio': PALETA.arena, 'Cubierta de servicios': PALETA.arena,
};
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

// Social space: living under the double height facing a 70" TV on the side wall, a tree growing inside the cube,
// dining by the big glass doors to the patio, kitchen along the right wall with an island; a tall plant by the door.
let r = R('Sala-comedor-cocina');
onWall(r, 'w', 'mueble-tv', Y(6.8), { width: 2.0, color: oliva });
onWall(r, 'w', 'televisor-70', Y(6.8), { gap: 0.02 });
piece('alfombra', X(3.0), Y(6.9), 90, { width: 2.6, depth: 2.0, color: arena });
piece('mesa-centro', X(3.0), Y(6.9), 90, { color: caramelo });
piece('sofa-l', X(4.6), Y(6.9), 90, { color: taupe });
piece('sillon', X(2.4), Y(5.6), 180, { color: pizarra });
piece('lampara-pie', X(5.6), Y(8.2));
piece('arbol-pequeno', X(2.0), Y(10.4)); // árbol interior bajo la doble altura
piece('mesa-comedor-6', X(6.6), Y(10.0), 0, { color: caramelo });
for (const x of [6.05, 6.6, 7.15]) {
  piece('silla-comedor', X(x), Y(10.0) - 0.85, 0, { color: pizarra });
  piece('silla-comedor', X(x), Y(10.0) + 0.85, 180, { color: pizarra });
}
onWall(r, 'e', 'nevera', Y(10.9));
onWall(r, 'e', 'meson', Y(9.95), { color: arena });
onWall(r, 'e', 'lavaplatos', Y(8.95), { color: arena });
onWall(r, 'e', 'estufa', Y(8.25));
onWall(r, 'e', 'meson', Y(7.35), { color: arena });
onWall(r, 'e', 'alacena', Y(6.55), { width: 1.2, color: oliva, elevation: 1.5 });
piece('bar', X(11.9), Y(8.9), 90, { color: caramelo }); // isla con taburetes
piece('matera-alta', X(10.8), Y(5.5), 0, { color: oliva });

r = R('Estudio');
onWall(r, 'w', 'escritorio', Y(15.0), { color: caramelo });
piece('silla-oficina', X(2.1), Y(15.0), 90);
onWall(r, 'n', 'estanteria', X(2.6), { color: caramelo });
piece('sillon', X(3.6), Y(12.9), 180, { color: taupe });
onWall(r, 'w', 'cuadro-abstracto', Y(13.2), { color: caramelo });

r = R('Baño social');
onWall(r, 'e', 'sanitario', Y(12.6));
onWall(r, 'n', 'lavamanos', X(12.4));
onWall(r, 'n', 'espejo', X(12.4), { width: 0.6 });

r = R('Lavandería');
onWall(r, 'e', 'lavadero', Y(14.6));
onWall(r, 'e', 'lavadora', Y(15.45));
onWall(r, 's', 'meson', X(12.2), { width: 1.2, color: arena }); // mesón para doblar

// Master bedroom: bed against the dressing-room wall, the 70" TV facing it, glass to the patio and to the back.
r = R('Cuarto principal');
const bed = Y(21.3);
piece('alfombra', X(4.9), bed, 90, { width: 2.8, depth: 2.2, color: taupe });
onWall(r, 'w', 'cama-king', bed, { color: arena });
onWall(r, 'w', 'mesa-noche', bed - 1.225, { color: caramelo });
onWall(r, 'w', 'mesa-noche', bed + 1.225, { color: caramelo });
onWall(r, 'w', 'cuadro-abstracto', bed, { width: 1.4, height: 0.7, elevation: 1.3, color: caramelo });
onWall(r, 'e', 'mueble-tv', bed, { color: oliva });
onWall(r, 'e', 'televisor-70', bed, { gap: 0.02 });
onWall(r, 'n', 'cortina', X(4.1), { width: 1.0, color: arena });
onWall(r, 'n', 'cortina', X(6.3), { width: 1.0, color: arena });
piece('matera-alta', X(6.6), Y(18.5), 0, { color: oliva });

// Dressing room and bathroom in one (x 1–3,4, y 18–24): walnut shelving on the bedroom wall, the double vanity on
// the outer wall, the glass wet room at the end; the toilet in its own room by the entrance.
r = R('Vestier y baño principal');
piece('vestier-colgar', X(3.4) - 0.325, Y(20.4), 90);
piece('vestier-repisas', X(3.4) - 0.325, Y(21.25), 90);
onWall(r, 'w', 'lavamanos-doble', Y(20.7), { color: caramelo });
onWall(r, 'w', 'espejo', Y(20.4), { width: 0.55, height: 0.8 });
onWall(r, 'w', 'espejo', Y(21.0), { width: 0.55, height: 0.8 });
r = R('Sanitario');
onWall(r, 's', 'sanitario', X(1.6));
r = R('Ducha y tina');
onWall(r, 'n', 'banera', X(1.95));
onWall(r, 'e', 'ducha', Y(22.5));
onWall(r, 'w', 'toallero', Y(22.4));

r = R('Cuarto 2');
onWall(r, 'e', 'cama-doble', Y(20.4), { color: arena });
onWall(r, 'e', 'mesa-noche', Y(20.4) - 0.925, { color: caramelo });
onWall(r, 'e', 'mesa-noche', Y(20.4) + 0.925, { color: caramelo });
onWall(r, 'e', 'cuadro-byn', Y(20.05), { elevation: 1.3, color: caramelo });
onWall(r, 'e', 'cuadro-byn', Y(20.75), { elevation: 1.3, color: caramelo });
onWall(r, 'w', 'closet', Y(19.4), { color: taupe });
piece('alfombra', X(8.6), Y(20.4), 90, { width: 2.0, depth: 1.2, color: arena });
piece('matera', X(10.0), Y(23.5), 0, { color: oliva });

r = R('Baño cuarto 2');
onWall(r, 'n', 'ducha', X(7.5));
onWall(r, 'e', 'sanitario', Y(23.5));
onWall(r, 'w', 'lavamanos', Y(22.55));

r = R('Cuarto 3');
onWall(r, 'w', 'cama-doble', Y(20.4), { color: arena });
onWall(r, 'w', 'mesa-noche', Y(20.4) - 0.925, { color: caramelo });
onWall(r, 'w', 'mesa-noche', Y(20.4) + 0.925, { color: caramelo });
onWall(r, 'w', 'cuadro-paisaje', Y(20.4), { width: 1.1, height: 0.6, elevation: 1.25, color: caramelo });
onWall(r, 'e', 'closet', Y(18.8), { color: taupe });
piece('alfombra', X(12.4), Y(20.4), 90, { width: 2.0, depth: 1.2, color: taupe });
piece('matera', X(11.0), Y(23.5), 0, { color: oliva });

r = R('Baño cuarto 3');
onWall(r, 'n', 'ducha', X(13.5));
onWall(r, 'w', 'sanitario', Y(23.5));
onWall(r, 'e', 'lavamanos', Y(22.55));

// Central patio: a tree in the middle of the lawn, a bench along the study, plants, and the drying corner behind
// the celosía.
piece('arbol-pequeno', X(5.9), Y(15.2));
piece('banca', X(4.85), Y(16.9), 270, { width: 1.4, color: caramelo });
piece('jardinera', X(9.4), Y(12.4), 0, { width: 1.6, color: oliva });
piece('matera', X(10.1), Y(15.6), 0, { color: caramelo });
piece('arbusto', X(13.4), Y(17.3));
piece('sillon-exterior', X(9.1), Y(15.3), 270, { color: pizarra });

// Back patio: stone terrace with a lounge around a fire pit in front of the master bedroom, an outdoor dining table,
// lawn and trees at the back.
piece('brasero', X(5.2), Y(25.8));
piece('sofa-exterior', X(5.2), Y(26.8), 0, { color: taupe });
piece('sillon-exterior', X(3.6), Y(25.8), 270, { color: pizarra });
piece('sillon-exterior', X(6.8), Y(25.8), 90, { color: pizarra });
piece('mesa-exterior', X(9.0), Y(26.2), 0, { color: caramelo });
piece('jardinera', X(5.2), Y(27.6), 0, { color: oliva });
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

// Rooftop over bedrooms 2 and 3: lounge under a wooden pergola, BBQ and bar at the back, plants along the edges;
// green-roof planters over the kitchen, behind the carport, as in the reference.
target = rooftop;
piece('jardinera', X(10.6), Y(5.6), 0, { width: 2.0, color: pizarra });
piece('jardinera', X(12.7), Y(5.6), 0, { width: 2.0, color: pizarra });
piece('tira-led', X(4.9), Y(4.7), 0, { width: 7.4, elevation: 2.3, color: '#ffd9a0' }); // luz bajo el marco del cubo
piece('pergola', X(11.2), Y(20.0), 0, { width: 5.2, depth: 3.2, color: caramelo });
piece('sofa-exterior', X(11.2), Y(18.6), 180, { color: taupe });
piece('sillon-exterior', X(9.5), Y(20.0), 270, { color: pizarra });
piece('sillon-exterior', X(12.9), Y(20.0), 90, { color: pizarra });
piece('alfombra', X(11.2), Y(20.0), 0, { width: 2.6, depth: 1.8, color: arena });
piece('mesa-centro', X(11.2), Y(20.0), 0, { color: caramelo });
piece('parrilla', X(9.0), Y(23.55));
piece('bar', X(11.2), Y(23.55), 0, { color: caramelo });
piece('mesa-exterior', X(11.2), Y(22.3), 0, { color: caramelo });
piece('jardinera', X(13.65), Y(22.5), 90, { color: oliva });
piece('matera-alta', X(7.5), Y(23.6), 0, { color: oliva });
piece('matera-alta', X(13.6), Y(18.4), 0, { color: oliva });

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
