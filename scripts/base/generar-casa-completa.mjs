// Complete house on the 5,5 × 20 m lot: module 1 (front 9 m, as in casa-etapa-1) + module 2 (back 11 m), 3 floors.
// Built with the app's own operations (Playwright drives the dev server), then finished in Node:
// wall finishes, floors, railings (scripts/casa-completa-acabados.mjs), furniture (scripts/casa-completa-muebles.mjs)
// and the street (scripts/ejemplo-entorno.mjs).
//
//   npx vite --port 5187 --strictPort        (in another terminal)
//   node scripts/base/generar-casa-completa.mjs [puerto]
//
// Module 2 (design y 9 → 20): light court 9 → 11,6; 3-floor block 11,6 → 15,8 on the ground (living room) and
// 11,6 → 17 above (the overhang shades the covered terrace); back stair tower x 3,6 → 5,5, y 17 → 20 (stacked U,
// serves only module 2); pool deck x 0 → 3,6, y 17 → 20 open to the sky. The terrain behind is higher: the app is
// flat, the back wall of the deck stands for the retaining wall.
// Writes public/ejemplos/casa-completa.casa.json. Design coordinates have the street at y = 0 and the back of the
// lot at y = 20; P() turns them into plan coordinates (north up, street at the bottom): plan y = 9 − design y.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { aplicarAcabados } from '../casa-completa-acabados.mjs';
import { amueblar } from '../casa-completa-muebles.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const OUT = join(root, 'public/ejemplos/casa-completa.casa.json');
const PORT = process.argv[2] ?? '5187';

const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://localhost:${PORT}`);
await page.waitForTimeout(800);

const json = await page.evaluate(async () => {
  const ops = await import('/src/model/ops.ts');
  const { createEmptyProject } = await import('/src/model/defaults.ts');
  const { serializeProject } = await import('/src/persistence/projectFile.ts');
  const P = (x, y) => ({ x: Math.round(x * 1e6) / 1e6 + 0, y: Math.round((9 - y) * 1e6) / 1e6 + 0 });
  const Q = (x, y) => ({ x, y });
  const p = createEmptyProject('Casa completa (3 pisos)');
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
  const roof = (f, pts, name, h = 2.6) => {
    const id = room(f, pts, name, 'roof');
    ops.setRoofHeight(p, f, id, h);
  };
  const rect = (x0, y0, x1, y1) => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];
  const poly = (...qs) => qs.map(([x, y]) => P(x, y));
  const stairs = (f, pts, name, up) => room(f, pts, name, 'stairs', { stairShape: 'u', up });

  // Module 1 shell; the front is split at the stair volume (x = 3,3) so it can take its own (wood) finish.
  const shell = (f) => ({
    front: wall(f, Q(0, 0), Q(3.3, 0), 0.2),
    frontStair: wall(f, Q(3.3, 0), Q(5.5, 0), 0.2),
    right: wall(f, Q(5.5, 0), Q(5.5, 9), 0.2),
    back: wall(f, Q(5.5, 9), Q(0, 9), 0.2), // runs right → left: offset = 5,5 − x
    left: wall(f, Q(0, 9), Q(0, 0), 0.2),
  });
  // Module 2: party walls of the lot, split where what's beside them changes (inside / covered terrace / outdoors).
  const party = (f, ys) => {
    for (let i = 0; i + 1 < ys.length; i++) {
      wall(f, Q(0, ys[i]), Q(0, ys[i + 1]), 0.2);
      wall(f, Q(5.5, ys[i]), Q(5.5, ys[i + 1]), 0.2);
    }
  };

  // ======================= Primer piso =======================
  const g = p.floors[0].id;
  ops.renameFloor(p, g, 'Primer piso');
  const G = shell(g);
  G.parkingSide = wall(g, Q(3.3, 0), Q(3.3, 5));
  G.parkingBack = wall(g, Q(0, 5), Q(3.3, 5));
  opening(g, 'window', G.parkingBack, 1.0, { width: 1.0, sill: 1.0, height: 1.0 }); // cocina ↔ parqueadero
  opening(g, 'door', G.front, 1.65, { width: 2.6 }); // garaje
  opening(g, 'window', G.frontStair, 1.1, { width: 1.2, sill: 0.9, height: 1.7 }); // ventana alta de la escalera
  opening(g, 'door', G.parkingSide, 4.0, { width: 0.8 }); // parqueadero → entrada
  glassDoor(g, G.back, 5.5 - 4.25, { width: 1.6 }); // comedor → patio de luz (corrediza de vidrio)
  opening(g, 'door', G.back, 5.5 - 1.4, { width: 0.7 }); // cocina → zona de ropas
  room(g, rect(0, 0, 3.3, 5), 'Parqueadero');
  stairs(g, rect(3.3, 0, 5.5, 3), 'Escalera', 's');
  room(g, rect(3.3, 3, 5.5, 5), 'Entrada');
  room(g, rect(0, 5, 2, 9), 'Cocina');
  room(g, rect(2, 5, 5.5, 9), 'Comedor');
  const garden = room(g, rect(3.3, -1.2, 5.5, 0), 'Antejardín enrejado', 'balcony');
  Object.assign(floorOf(g).rooms.find((x) => x.id === garden), { railing: 'celosia', openEdges: [3] });
  room(g, rect(0, -1.2, 3.3, 0), 'Acceso vehicular (portón corredizo)', 'exterior', { floorMaterial: 'concreto' });

  // --- Patio de luz (9 → 11,6) with the laundry behind the kitchen ---
  party(g, [9, 11.6]);
  const ropasSide = wall(g, Q(1.8, 9), Q(1.8, 10.6));
  wall(g, Q(0, 10.6), Q(1.8, 10.6));
  opening(g, 'window', ropasSide, 0.8, { width: 0.9, sill: 1.0, height: 1.1 }); // zona de ropas → patio
  room(g, rect(0, 9, 1.8, 10.6), 'Zona de ropas');
  roof(g, rect(0, 9, 1.8, 10.6), 'Techo zona de ropas');
  room(g, poly([1.8, 9], [5.5, 9], [5.5, 11.6], [0, 11.6], [0, 10.6], [1.8, 10.6]), 'Patio de luz', 'balcony', { openEdges: [0, 1, 2, 3, 4, 5] });

  // --- Module 2, ground: big living room (11,6 → 15,8), covered terrace, pool deck, back stair ---
  party(g, [11.6, 15.8, 17, 20]);
  const m2Front = wall(g, Q(0, 11.6), Q(5.5, 11.6), 0.2);
  glassDoor(g, m2Front, 2.3, { width: 2.4 }); // sala ↔ patio de luz
  opening(g, 'window', m2Front, 4.55, { width: 0.6, sill: 1.5, height: 0.6 }); // baño social
  const m2Back = wall(g, Q(0, 15.8), Q(5.5, 15.8), 0.2);
  glassDoor(g, m2Back, 2.65, { width: 1.5 }); // sala → terraza y piscina
  glassDoor(g, m2Back, 4.0, { width: 0.8 }); // sala → terraza, frente a la escalera
  const bathSide = wall(g, Q(3.6, 11.6), Q(3.6, 13.4));
  const bathBack = wall(g, Q(3.6, 13.4), Q(5.5, 13.4));
  opening(g, 'door', bathBack, 0.95, { width: 0.7 }); // sala → baño social
  void bathSide;
  const towerSide = wall(g, Q(3.6, 17), Q(3.6, 20), 0.2); // escalera | deck
  const backPool = wall(g, Q(0, 20), Q(3.6, 20), 0.3); // muro de contención
  const backTower = wall(g, Q(3.6, 20), Q(5.5, 20), 0.2);
  opening(g, 'window', backTower, 0.95, { width: 1.0, sill: 1.5, height: 0.9 }); // luz al descanso de la escalera
  void towerSide;
  void backPool;
  room(g, poly([0, 11.6], [3.6, 11.6], [3.6, 13.4], [5.5, 13.4], [5.5, 15.8], [0, 15.8]), 'Sala principal');
  room(g, rect(3.6, 11.6, 5.5, 13.4), 'Baño social');
  room(g, rect(0, 15.8, 5.5, 17), 'Terraza cubierta', 'balcony', { openEdges: [0, 1, 2, 3] });
  room(g, rect(0, 17, 3.6, 20), 'Deck de la piscina', 'balcony', { openEdges: [0, 1, 2, 3] });
  stairs(g, rect(3.6, 17, 5.5, 20), 'Escalera módulo 2', 'n');

  // ======================= Segundo piso =======================
  const u = ops.addFloor(p);
  ops.renameFloor(p, u, 'Segundo piso');
  const U = shell(u);
  U.bedSide = wall(u, Q(3.3, 0), Q(3.3, 4.2));
  U.bedBack = wall(u, Q(0, 4.2), Q(3.3, 4.2));
  U.core = wall(u, Q(2.6, 4.2), Q(2.6, 9));
  U.bathTop = wall(u, Q(0, 6.2), Q(2.6, 6.2));
  U.office = wall(u, Q(2.6, 6.4), Q(5.5, 6.4));
  glassDoor(u, U.front, 1.65, { width: 1.6 }); // habitación → balcón
  opening(u, 'window', U.frontStair, 1.1, { width: 1.2, sill: 0, height: 2.6 });
  opening(u, 'door', U.bedSide, 3.6, { width: 0.8 });
  opening(u, 'door', U.bedBack, 1.3, { width: 0.8 });
  opening(u, 'door', U.bathTop, 1.3, { width: 0.8 });
  opening(u, 'door', U.office, 2.4, { width: 0.8 });
  opening(u, 'window', U.back, 5.5 - 1.3, { width: 0.6, sill: 1.5, height: 0.6 }); // baño → patio de luz
  opening(u, 'window', U.back, 5.5 - 4.0, { width: 1.4 }); // oficina → patio de luz
  room(u, rect(0, 0, 3.3, 4.2), 'Habitación principal');
  stairs(u, rect(3.3, 0, 5.5, 3), 'Escalera', 's');
  room(u, rect(3.3, 3, 5.5, 4.2), 'Pasillo');
  room(u, rect(0, 4.2, 2.6, 6.2), 'Vestier');
  room(u, rect(0, 6.2, 2.6, 9), 'Baño (ducha)');
  room(u, rect(2.6, 4.2, 5.5, 6.4), 'Salita');
  room(u, rect(2.6, 6.4, 5.5, 9), 'Oficina');
  room(u, rect(0.2, -1.2, 3.1, 0), 'Balcón', 'balcony');

  // --- Module 2, 2nd floor: one large suite (11,6 → 17) + the back stair ---
  party(u, [9, 11.6]);
  party(u, [11.6, 17]);
  wall(u, Q(5.5, 17), Q(5.5, 20), 0.2); // medianera de la escalera (sobre el deck no hay muro: la piscina queda abierta)
  const u2Front = wall(u, Q(0, 11.6), Q(5.5, 11.6), 0.2);
  opening(u, 'window', u2Front, 1.8, { width: 2.2, sill: 0.9, height: 1.4 }); // habitación → patio de luz
  opening(u, 'window', u2Front, 4.55, { width: 0.6, sill: 1.5, height: 0.6 }); // baño
  const u2Back = wall(u, Q(0, 17), Q(3.6, 17), 0.2);
  opening(u, 'window', u2Back, 1.8, { width: 2.4, sill: 0.6, height: 1.6 }); // habitación → piscina
  const u2Core = wall(u, Q(3.6, 11.6), Q(3.6, 17));
  opening(u, 'door', u2Core, 14.8 - 11.6, { width: 0.8 }); // habitación → vestier
  opening(u, 'door', u2Core, 16.4 - 11.6, { width: 0.8 }); // hall → habitación
  const u2Bath = wall(u, Q(3.6, 13.8), Q(5.5, 13.8));
  opening(u, 'door', u2Bath, 0.6, { width: 0.7 }); // vestier → baño
  wall(u, Q(3.6, 15.8), Q(5.5, 15.8)); // vestier | hall
  wall(u, Q(3.6, 17), Q(3.6, 20), 0.2);
  const u2Tower = wall(u, Q(3.6, 20), Q(5.5, 20), 0.2);
  opening(u, 'window', u2Tower, 0.95, { width: 1.0, sill: 0.9, height: 1.2 });
  room(u, rect(0, 11.6, 3.6, 17), 'Habitación módulo 2');
  room(u, rect(3.6, 11.6, 5.5, 13.8), 'Baño módulo 2');
  room(u, rect(3.6, 13.8, 5.5, 15.8), 'Vestier módulo 2');
  room(u, rect(3.6, 15.8, 5.5, 17), 'Hall módulo 2');
  stairs(u, rect(3.6, 17, 5.5, 20), 'Escalera módulo 2', 'n');

  // ======================= Tercer piso =======================
  const t = ops.addFloor(p);
  ops.renameFloor(p, t, 'Tercer piso');
  // Module 1 rooftop, unchanged: stair head, wide exit, terrace slab leaving the stairwell open.
  wall(t, Q(3.3, 0), Q(3.3, 3));
  const headBack = wall(t, Q(3.3, 3), Q(5.5, 3));
  wall(t, Q(3.3, 0), Q(5.5, 0), 0.2);
  wall(t, Q(5.5, 0), Q(5.5, 3), 0.2);
  opening(t, 'door', headBack, 1.1, { width: 1.9, height: 2.1 });
  room(t, poly([0, 0], [3.3, 0], [3.3, 3], [5.5, 3], [5.5, 9], [0, 9]), 'Terraza (pretil)', 'balcony');
  roof(t, rect(3.3, 0, 5.5, 3), 'Techo casetón');

  // --- Module 2, 3rd floor: rest & entertainment room looking over the court to the front, gym at the back ---
  party(t, [11.6, 17]);
  wall(t, Q(5.5, 17), Q(5.5, 20), 0.2);
  const t2Front = wall(t, Q(0, 11.6), Q(5.5, 11.6), 0.2);
  glassDoor(t, t2Front, 2.0, { width: 2.2, height: 2.3 }); // descanso → balcón mirador
  opening(t, 'window', t2Front, 4.2, { width: 1.9, sill: 0.4, height: 1.9 }); // ventanal
  const t2Mid = wall(t, Q(0, 14.6), Q(5.5, 14.6));
  opening(t, 'door', t2Mid, 1.4, { width: 1.0 }); // gimnasio ↔ descanso
  const t2Core = wall(t, Q(3.6, 14.6), Q(3.6, 17));
  opening(t, 'door', t2Core, 16.4 - 14.6, { width: 0.9 }); // hall → gimnasio
  const t2Wc = wall(t, Q(3.6, 15.8), Q(5.5, 15.8));
  opening(t, 'door', t2Wc, 0.4, { width: 0.7 }); // hall → medio baño
  const t2Back = wall(t, Q(0, 17), Q(3.6, 17), 0.2);
  opening(t, 'window', t2Back, 1.8, { width: 2.4, sill: 0.8, height: 1.4 }); // gimnasio → fondo
  wall(t, Q(3.6, 17), Q(3.6, 20), 0.2);
  const t2Tower = wall(t, Q(3.6, 20), Q(5.5, 20), 0.2);
  opening(t, 'window', t2Tower, 0.95, { width: 1.0, sill: 0.9, height: 1.2 });
  room(t, rect(0, 11.6, 5.5, 14.6), 'Cuarto de descanso y entretenimiento');
  room(t, rect(0, 14.6, 3.6, 17), 'Gimnasio');
  room(t, rect(3.6, 14.6, 5.5, 15.8), 'Medio baño');
  room(t, rect(3.6, 15.8, 5.5, 17), 'Llegada escalera módulo 2');
  room(t, rect(0, 10.7, 5.5, 11.6), 'Balcón mirador', 'balcony', { railing: 'vidrio' });

  // ======================= Cubierta =======================
  // Module 2's roof lives on its own level (like module 1's floors are covered by the slab above), so picking
  // "Tercer piso" in the 3D view shows the rest room and the gym from above. Not walkable: no stair reaches it.
  const c = ops.addFloor(p);
  ops.renameFloor(p, c, 'Cubierta (techo módulo 2)');
  roof(c, poly([0, 11.6], [5.5, 11.6], [5.5, 20], [3.6, 20], [3.6, 17], [0, 17]), 'Cubierta módulo 2', 0.001);

  return serializeProject(p);
});
await browser.close();
if (errors.length) throw new Error(errors.join('\n'));

const project = JSON.parse(json);
project.id = randomUUID();
aplicarAcabados(project);
const lines = amueblar(project);
writeFileSync(OUT, JSON.stringify(project, null, 2) + '\n');
execFileSync(process.execPath, [join(root, 'scripts/ejemplo-entorno.mjs'), OUT], { stdio: 'inherit' });
// Keep the trailing newline the entorno script drops.
const text = readFileSync(OUT, 'utf8');
if (!text.endsWith('\n')) writeFileSync(OUT, text + '\n');
console.log(lines.join('\n'));
console.log(`Listo: ${OUT}`);
