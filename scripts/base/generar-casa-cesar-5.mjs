// Casa Cesar 5: the two houses of the brochure «Preentrega arquitectónica · César Ferrero E10 + E11» (2026-11-17),
// built as drawn in its zoning plans (sheets 01 and 02), only straightened (the sheet shows them turned ~15,5°).
//
//   node scripts/base/generar-casa-cesar-5.mjs [puerto]     (needs a dev server, default :5173)
//
// Plan coordinates: x 0 → 31 from the left boundary (E10 = x 0–15,5, César Ferrero hijo; E11 = x 15,5–31, César
// Ferrero padre), y 0 (back boundary) → 32,26 (street). Setbacks (separaciones reglamentarias): 1,50 on each side of
// each lot and 3,00 at the back.
//
// E10, ground floor: hab. servicio + ropas (y 3–6,5), acceso aux, hab. 2, W/C, hab. 1, cocina, salón de juegos on the
// left (x 1,5–6,75); circulaciones down the middle; garden with the pool (y 3–10,75), terrace (y 10,75–13,75), comedor,
// escalera and the office with its own entrance on the right (x 10–14); parking (y 25,25–29,25) and antejardín.
// E10, upper floor: gym, H2, master bedroom, H1 on the left; estudio at the front right; voids over the comedor and the
// stair; private terrace (50 m²) over the parking.
// E11 (one floor): BBQ + W/C, terrace and the children's playroom on the left (x 17–21); bedrooms at the back right
// around the central garden; kitchen, stair, dining, sala, ropas and the main entrance towards the front.
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { interior, readCatalog } from '../casa-completa-muebles.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const OUT = join(root, 'public/ejemplos/casa-cesar-5.casa.json');
const PORT = process.argv[2] ?? '5173';
const H = 3.0;
const D = 32.26; // lot depth

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
  const p = createEmptyProject('Casa Cesar 5');
  const len = {};
  const floorOf = (f) => p.floors.find((x) => x.id === f);
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
  const high = { sill: 1.5, height: 0.6 };
  const tall = { sill: 0.45, height: 2.0 };
  const room = (f, pts, name, kind, extra = {}) => {
    const id = ops.addRoom(p, f, pts.map((q) => Q(...q)), name);
    if (!id) throw new Error(name);
    if (kind) ops.setRoomKind(p, f, id, kind);
    Object.assign(floorOf(f).rooms.find((x) => x.id === id), extra);
    return id;
  };
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const post = (f, x, y, h = H) => wall(f, [x - 0.1, y], [x + 0.1, y], 0.2, h);
  const E = 0.2;

  // ======================= Primer piso =======================
  const g = p.floors[0].id;
  ops.renameFloor(p, g, 'Primer piso');
  ops.setFloorHeight(p, g, H);

  // ---------- E10 ----------
  const l10 = wall(g, [1.5, 3], [1.5, 25.25], E);
  // Sheet 05: bedrooms and service open with sliding glass doors onto the side strip.
  glassDoor(g, l10, 1.75, { width: 1.6, height: 2.4 }); // hab. servicio
  glassDoor(g, l10, 7.0, { width: 2.2, height: 2.4 }); // hab. 2
  win(g, l10, 9.5, 0.6, high); // W/C
  glassDoor(g, l10, 12.0, { width: 2.2, height: 2.4 }); // hab. 1
  win(g, l10, 16.25, 1.6); // cocina
  win(g, l10, 20.5, 2.4, tall); // salón de juegos
  const b10 = wall(g, [1.5, 3], [4.73, 3], E);
  win(g, b10, 1.6, 1.2); // hab. servicio (ropas stays open to the drying yard, sheet 05 V3)
  const m10 = wall(g, [6.75, 3], [6.75, 13.75], E);
  door(g, m10, 4.4, 0.9); // acceso aux → jardín y piscina
  win(g, m10, 6.5, 1.2); // circulación
  glassDoor(g, m10, 9.25, { width: 1.2, height: 2.4 }); // circulación → terraza
  const t10 = wall(g, [6.75, 13.75], [14, 13.75], E);
  glassDoor(g, t10, 1.65, { width: 1.8, height: 2.4 }); // circulación → terraza
  glassDoor(g, t10, 5.25, { width: 3.2, height: 2.4 }); // comedor → terraza
  const r10 = wall(g, [14, 13.75], [14, 25.25], E);
  win(g, r10, 2.5, 2.0, tall); // comedor
  win(g, r10, 6.5, 1.0, high); // escalera
  win(g, r10, 9.75, 1.6); // oficina
  const f10 = wall(g, [1.5, 25.25], [14, 25.25], E);
  win(g, f10, 2.6, 2.0); // salón de juegos
  door(g, f10, 6.25, 1.1, { height: 2.4 }); // acceso principal
  door(g, f10, 8.0, 0.9); // oficina: own entrance from the front
  win(g, f10, 10.8, 2.2, tall); // oficina
  // interior
  const i1 = wall(g, [1.5, 6.5], [6.75, 6.5]);
  door(g, i1, 1.6, 0.8); // hab. servicio
  door(g, i1, 4.25, 0.8); // ropas
  wall(g, [4.73, 3], [4.73, 6.5]);
  wall(g, [1.5, 8.25], [5.25, 8.25]);
  door(g, wall(g, [5.25, 8.25], [5.25, 11.75]), 2.65, 0.8); // hab. 2
  wall(g, [1.5, 11.75], [5.25, 11.75]);
  door(g, wall(g, [4.0, 11.75], [4.0, 13.25]), 0.75, 0.7); // W/C
  wall(g, [1.5, 13.25], [5.25, 13.25]);
  door(g, wall(g, [5.25, 13.25], [5.25, 16.75]), 0.85, 0.8); // hab. 1
  wall(g, [1.5, 16.75], [6.75, 16.75]);
  vano(g, wall(g, [6.75, 16.75], [6.75, 21.75]), 2.5, 2.0); // cocina abierta a la circulación
  wall(g, [1.5, 21.75], [6.75, 21.75]);
  door(g, wall(g, [6.75, 21.75], [6.75, 25.25]), 1.75, 0.9); // salón de juegos
  wall(g, [8.75, 21.75], [14, 21.75]);
  wall(g, [8.75, 21.75], [8.75, 25.25]);
  wall(g, [8.15, 3.15], [12.6, 3.15], 0.3, 1.8); // stone wall with the waterfall behind the pool
  // posts carrying the private terrace over the parking
  for (const x of [1.6, 7.75, 13.9]) post(g, x, 29.15);

  room(g, rect(1.5, 3, 4.73, 6.5), 'Hab. servicio');
  room(g, rect(4.73, 3, 6.75, 6.5), 'Ropas', 'balcony', { openEdges: [0, 1, 2, 3], floorMaterial: 'piedra' });
  room(g, rect(1.5, 6.5, 6.75, 8.25), 'Acceso auxiliar');
  room(g, rect(1.5, 8.25, 5.25, 11.75), 'Hab. 2');
  room(g, rect(1.5, 11.75, 4.0, 13.25), 'W/C');
  room(g, rect(1.5, 13.25, 5.25, 16.75), 'Hab. 1');
  room(g, [[5.25, 8.25], [6.75, 8.25], [6.75, 13.75], [10, 13.75], [10, 21.75], [6.75, 21.75], [6.75, 16.75], [5.25, 16.75],
    [5.25, 13.25], [4, 13.25], [4, 11.75], [5.25, 11.75]], 'Circulaciones');
  room(g, rect(1.5, 16.75, 6.75, 21.75), 'Cocina');
  room(g, rect(1.5, 21.75, 6.75, 25.25), 'Salón de juegos');
  room(g, rect(6.75, 21.75, 8.75, 25.25), 'Acceso principal');
  room(g, rect(10, 13.75, 14, 18.75), 'Comedor');
  room(g, rect(10, 18.75, 14, 21.75), 'Escalera', 'stairs', { up: 'e', stairShape: 'u' });
  room(g, rect(8.75, 21.75, 14, 25.25), 'Oficina');
  room(g, rect(6.75, 10.75, 14, 13.75), 'Terraza E10', 'balcony', { openEdges: [0, 1, 2, 3], floorMaterial: 'madera' });

  // ---------- E11 ----------
  // BBQ pavilion with its W/C; back wall in stone, open towards the garden.
  wall(g, [17, 3], [21, 3], E);
  wall(g, [17, 3], [17, 6], E);
  post(g, 20.9, 9.15);
  wall(g, [18.5, 9.25], [21, 9.25]);
  wall(g, [21, 9.25], [21, 10.75]);
  wall(g, [18.5, 10.75], [21, 10.75]);
  door(g, wall(g, [18.5, 9.25], [18.5, 10.75]), 0.75, 0.7);
  // Bedrooms at the back right
  const bb = wall(g, [22.5, 3], [29.5, 3], E);
  win(g, bb, 3.5, 2.0);
  const br = wall(g, [29.5, 3], [29.5, 10.75], E);
  win(g, br, 2.0, 1.4);
  win(g, br, 5.9, 1.2);
  const bl = wall(g, [22.5, 3], [22.5, 10.75], E);
  glassDoor(g, bl, 2.0, { width: 1.6, height: 2.4 }); // hab. principal, from the side garden
  win(g, bl, 5.9, 1.2);
  const bf = wall(g, [22.5, 10.75], [29.5, 10.75], E);
  glassDoor(g, bf, 1.75, { width: 2.2, height: 2.4 }); // hab. 1 → jardín central
  glassDoor(g, bf, 5.25, { width: 2.2, height: 2.4 }); // hab. 2 → jardín central
  wall(g, [22.5, 7.03], [29.5, 7.03]);
  wall(g, [26, 7.03], [26, 10.75]);
  // Main block
  const n11 = wall(g, [17, 13.75], [29.5, 13.75], E);
  glassDoor(g, n11, 2.0, { width: 3.2, height: 2.5 }); // salón infantil → terraza
  glassDoor(g, n11, 6.75, { width: 4.6, height: 2.5 }); // cocina → jardín central
  const w11 = wall(g, [17, 13.75], [17, 25.25], E);
  win(g, w11, 4.0, 5.0, { sill: 0.1, height: 2.4 }); // salón infantil, glass wall (sheet 05 V2)
  win(g, w11, 9.75, 1.0, high); // ropas
  const e11 = wall(g, [29.5, 13.75], [29.5, 25.25], E);
  win(g, e11, 1.5, 1.0, high); // escalera
  win(g, e11, 6.0, 2.8, { sill: 0.1, height: 2.4 }); // comedor
  win(g, e11, 9.75, 2.4, { sill: 0.1, height: 2.4 }); // sala
  const fr11 = wall(g, [17, 25.25], [29.5, 25.25], E);
  win(g, fr11, 2.0, 1.2); // ropas
  door(g, fr11, 5.0, 1.1, { height: 2.4 }); // acceso principal
  win(g, fr11, 9.25, 4.6, { sill: 0.1, height: 2.4 }); // sala
  wall(g, [21, 13.75], [21, 21.75]);
  wall(g, [17, 21.75], [21, 21.75]);
  door(g, wall(g, [21, 21.75], [21, 25.25]), 1.75, 0.8); // ropas

  room(g, rect(17, 3, 21, 9.25), 'BBQ', 'balcony', { openEdges: [0, 1, 2, 3], floorMaterial: 'piedra' });
  room(g, rect(17, 9.25, 18.5, 10.75), 'BBQ (paso)', 'balcony', { openEdges: [0, 1, 2, 3], floorMaterial: 'piedra' });
  room(g, rect(18.5, 9.25, 21, 10.75), 'W/C BBQ');
  room(g, rect(17, 10.75, 21, 13.75), 'Terraza E11', 'balcony', { openEdges: [0, 1, 2, 3], floorMaterial: 'madera' });
  room(g, rect(22.5, 3, 29.5, 7.03), 'Habitación principal');
  room(g, rect(22.5, 7.03, 26, 10.75), 'Hab. 1 E11');
  room(g, rect(26, 7.03, 29.5, 10.75), 'Hab. 2 E11');
  room(g, rect(17, 13.75, 21, 21.75), 'Salón de juegos infantiles');
  room(g, [[21, 13.75], [26.5, 13.75], [26.5, 16.75], [29.5, 16.75], [29.5, 18.25], [21, 18.25]], 'Cocina E11');
  room(g, rect(26.5, 13.75, 29.5, 16.75), 'Escalera E11', 'stairs', { up: 'n', stairShape: 'u' });
  room(g, rect(21, 18.25, 29.5, 21.75), 'Comedor E11');
  room(g, rect(17, 21.75, 21, 25.25), 'Ropas E11');
  room(g, rect(21, 21.75, 23, 25.25), 'Acceso principal E11');
  room(g, rect(23, 21.75, 29.5, 25.25), 'Sala E11');

  // ======================= Segundo piso (E10) =======================
  const t = ops.addFloor(p);
  ops.renameFloor(p, t, 'Segundo piso');
  ops.setFloorHeight(p, t, H);
  const l2 = wall(t, [1.5, 6.5], [1.5, 25.25], E);
  win(t, l2, 3.5, 1.6); // gym
  win(t, l2, 8.5, 1.4); // H2
  win(t, l2, 12.75, 3.2, { sill: 0.1, height: 2.4 }); // principal (sheet 06 V1)
  win(t, l2, 17.0, 1.6); // H1
  win(t, wall(t, [1.5, 6.5], [6.75, 6.5], E), 2.6, 3.0, { sill: 0.6, height: 1.8 }); // over the double-height access
  win(t, wall(t, [6.75, 6.5], [6.75, 13.75], E), 3.0, 1.2);
  win(t, wall(t, [6.75, 13.75], [14, 13.75], E), 3.6, 5.0, { sill: 0.4, height: 2.0 }); // double height over the terrace
  const r2 = wall(t, [14, 13.75], [14, 25.25], E);
  win(t, r2, 2.5, 2.0);
  win(t, r2, 6.5, 1.0, high);
  win(t, r2, 9.75, 2.6, { sill: 0.1, height: 2.4 }); // estudio (sheet 06 V3)
  const f2 = wall(t, [1.5, 25.25], [14, 25.25], E);
  glassDoor(t, f2, 2.6, { width: 2.0, height: 2.4 }); // H1 → terraza privada
  glassDoor(t, f2, 6.25, { width: 1.4, height: 2.4 }); // circulación → terraza privada
  glassDoor(t, f2, 9.9, { width: 2.4, height: 2.4 }); // estudio → terraza privada
  // interior
  win(t, wall(t, [1.5, 8.25], [5.25, 8.25]), 1.9, 1.6); // gym → vacío
  win(t, wall(t, [5.25, 8.25], [5.25, 11.75]), 1.75, 1.6); // gym → vacío
  door(t, wall(t, [4.0, 11.75], [5.25, 11.75]), 0.62, 0.8); // gym
  const rail = (a, b) => { const id = wall(t, a, b, 0.06, 1.0); win(t, id, len[id] / 2, len[id] - 0.12, { sill: 0.06, height: 0.9 }); };
  rail([5.25, 11.75], [6.75, 11.75]); // glass railing over the void
  wall(t, [4.0, 11.75], [4.0, 13.25]);
  wall(t, [1.5, 13.25], [5.25, 13.25]);
  door(t, wall(t, [5.25, 13.25], [5.25, 16.75]), 1.0, 0.8); // H2
  const p16 = wall(t, [1.5, 16.75], [6.75, 16.75]);
  door(t, p16, 1.9, 0.8); // principal ↔ H2
  const p21 = wall(t, [1.5, 21.75], [6.75, 21.75]);
  door(t, p21, 2.5, 0.8); // principal ↔ H1
  door(t, wall(t, [6.75, 16.75], [6.75, 21.75]), 3.5, 0.9); // principal
  door(t, wall(t, [6.75, 21.75], [6.75, 25.25]), 0.75, 0.8); // H1
  door(t, wall(t, [8.75, 21.75], [8.75, 25.25]), 0.75, 0.8); // estudio
  wall(t, [8.75, 21.75], [14, 21.75]);
  rail([6.75, 13.75], [6.75, 15.5]);
  rail([8.0, 18.75], [14, 18.75]);

  room(t, [[1.5, 8.25], [5.25, 8.25], [5.25, 11.75], [4, 11.75], [4, 13.25], [1.5, 13.25]], 'Gimnasio');
  room(t, [[4, 11.75], [6.75, 11.75], [6.75, 16.75], [5.25, 16.75], [5.25, 13.25], [4, 13.25]], 'Circulación (gym)');
  room(t, rect(1.5, 13.25, 5.25, 16.75), 'Habitación H2');
  room(t, rect(1.5, 16.75, 6.75, 21.75), 'Habitación principal E10');
  room(t, rect(1.5, 21.75, 6.75, 25.25), 'Habitación H1');
  room(t, [[6.75, 18.75], [10, 18.75], [10, 21.75], [8.75, 21.75], [8.75, 25.25], [6.75, 25.25]], 'Circulaciones');
  room(t, rect(8.75, 21.75, 14, 25.25), 'Estudio');
  // The sheet leaves the two upper corridors unconnected; a short walkway over the void joins them.
  room(t, rect(6.75, 15.5, 8.0, 18.75), 'Pasarela', 'balcony', { openEdges: [2, 3], floorMaterial: 'madera', railing: 'vidrio' });
  room(t, rect(1.5, 25.25, 14, 29.25), 'Terraza privada', 'balcony', { openEdges: [0], floorMaterial: 'madera', railing: 'vidrio' });

  // ---------- Roofs ----------
  const slab = (name, pts, h) => ops.setRoofHeight(p, t, room(t, pts, name, 'roof'), h);
  slab('Cubierta E10', [[1.4, 6.4], [6.85, 6.4], [6.85, 13.65], [14.1, 13.65], [14.1, 25.3], [1.4, 25.3]], H);
  slab('Cubierta servicio E10', rect(1.4, 2.9, 4.83, 6.4), 0.001);
  slab('Cubierta BBQ', rect(16.9, 2.9, 21.1, 10.85), 0.001);
  slab('Cubierta habitaciones E11', rect(22.4, 2.9, 29.6, 10.85), 0.001);
  slab('Cubierta E11', rect(16.9, 13.65, 29.6, 25.35), 0.001);
  return serializeProject(p);
}, H);
await browser.close();
if (errors.length) throw new Error(errors.join('\n'));

const project = JSON.parse(json);
project.id = randomUUID();
const [ground, upper] = project.floors;

// ---------- Finishes ----------
const ARENA = '#E8DBD3';
const MATERIAL = [[/w\/c|baño|ropas/i, 'ceramica'], [/hab|gimnasio|estudio/i, 'madera']];
for (const r of [...ground.rooms, ...upper.rooms]) {
  if (r.kind !== 'room' && r.kind !== 'stairs') continue;
  r.floorMaterial = MATERIAL.find(([re]) => re.test(r.name))?.[1] ?? 'porcelanato';
}
for (const r of upper.rooms) if (r.kind === 'roof') Object.assign(r, { floorMaterial: 'concreto', edgeColor: ARENA });

// ---------- Lot outside the houses ----------
const ext = (name, x0, y0, x1, y1, floorMaterial) =>
  ground.rooms.push({ id: randomUUID(), name, kind: 'exterior', points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], floorMaterial });
// E10
ext('Área libre ropas', 0, 0, 6.75, 3, 'piedra');
ext('Separación posterior E10', 6.75, 0, 15.5, 3, 'cesped');
ext('Galería de servicio E10', 0, 3, 1.5, 25.25, 'piedra'); // sheet 05 V1: paved strip outside the bedrooms
ext('Separación izquierda E10', 0, 25.25, 1.5, D, 'cesped');
ext('Separación derecha E10', 14, 3, 14.6, 11.5, 'cesped');
ext('Paso cubierto entre casas', 14.6, 3, 16.4, 11.5, 'piedra'); // sheets 03/04: pergola walkway along the central strip
ext('Separación derecha E10 (frente)', 14, 13, 15.5, D, 'cesped');
ext('Deck y jardín de la piscina', 6.75, 3, 14, 10.75, 'piedra');
ext('Parqueadero E10', 1.5, 25.25, 14, 29.25, 'concreto');
ext('Antejardín E10', 1.5, 29.25, 14, D, 'cesped');
// Link between the two terraces (the brochure: «la conexión interpredial se realiza por la terraza»)
ext('Paso entre terrazas', 14, 11.5, 17, 13, 'piedra');
// E11
ext('Separación posterior E11', 15.5, 0, 31, 3, 'cesped');
ext('Separación izquierda E11', 16.4, 3, 17, 11.5, 'cesped');
ext('Separación izquierda E11 (frente)', 15.5, 13, 17, D, 'cesped');
ext('Separación derecha E11', 29.5, 3, 31, D, 'cesped');
ext('Jardín lateral (habitaciones)', 21, 3, 22.5, 10.75, 'cesped');
ext('Jardín central', 21, 10.75, 29.5, 13.75, 'cesped');
ext('Parqueadero E11', 17, 25.25, 29.5, 29.25, 'concreto');
ext('Antejardín E11', 17, 29.25, 29.5, D, 'cesped');
// Stairs rooms draw no floor of their own: a porcelain floor under each stair.
ext('Piso bajo la escalera E10', 10, 18.75, 14, 21.75, 'porcelanato');
ext('Piso bajo la escalera E11', 26.5, 13.75, 29.5, 16.75, 'porcelanato');
ext('Andén', -3, D, 34, D + 1.5, 'concreto');
ext('Calle', -3, D + 1.5, 34, D + 8.5, 'asfalto');

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
const onWall = (r, side, type, at, o = {}) => {
  const d = (o.depth ?? catalog.get(type).depth) / 2 + (o.gap ?? 0);
  const pos = { n: [at, r.y0 + d], s: [at, r.y1 - d], w: [r.x0 + d, at], e: [r.x1 - d, at] }[side];
  piece(type, pos[0], pos[1], ROT[side], o);
};
const box = (x0, y0, x1, y1) => ({ x0: x0 + 0.1, y0: y0 + 0.1, x1: x1 - 0.1, y1: y1 - 0.1 });
const MADERA = '#B77E53', TAUPE = '#C6B1A0', GRAFITO = '#3d3a38', PIZARRA = '#495762';

// ===== E10, ground floor =====
let r = box(1.5, 3, 4.73, 6.5); // hab. servicio
onWall(r, 'w', 'cama-sencilla', 4.4, { color: ARENA });
onWall(r, 'e', 'closet', 4.2, { width: 1.0 });
r = box(4.73, 3, 6.75, 6.5); // ropas
onWall(r, 'w', 'lavadora', 3.6);
onWall(r, 'w', 'lavadero', 4.55, { width: 0.7 });
onWall(r, 'w', 'repisa-decorativa', 5.6, { elevation: 1.4 });
onWall(r, 'e', 'planta-colgante', 4.2, { elevation: 1.9 });
piece('pergola', 5.74, 4.75, 0, { width: 2.0, depth: 3.5, height: 2.7 });
piece('canasta-ropa', 4.0, 1.6);
r = box(1.5, 8.25, 5.25, 11.75); // hab. 2
onWall(r, 'w', 'cama-doble', 10.0, { color: ARENA });
onWall(r, 'w', 'mesa-noche', 8.85, { color: MADERA });
onWall(r, 'n', 'closet', 4.2);
r = box(1.5, 11.75, 4.0, 13.25); // W/C
onWall(r, 'w', 'sanitario', 12.5);
onWall(r, 's', 'lavamanos', 3.2);
r = box(1.5, 13.25, 5.25, 16.75); // hab. 1
onWall(r, 'w', 'cama-doble', 15.0, { color: ARENA });
onWall(r, 'w', 'mesa-noche', 13.85, { color: MADERA });
onWall(r, 's', 'closet', 4.2);
r = box(1.5, 16.75, 6.75, 21.75); // cocina
onWall(r, 'n', 'nevera', 2.0);
onWall(r, 'n', 'meson', 2.95, { width: 0.6, color: GRAFITO });
onWall(r, 'n', 'lavaplatos', 3.65, { color: GRAFITO });
onWall(r, 'n', 'meson', 4.4, { width: 0.6, color: GRAFITO });
onWall(r, 'n', 'estufa', 5.1);
onWall(r, 'n', 'campana', 5.1, { height: 1.2 });
piece('bar', 4.0, 19.4, 0, { width: 2.2, color: GRAFITO });
piece('mesa-comedor-4', 3.6, 21.0, 0, { color: MADERA });
r = box(1.5, 21.75, 6.75, 25.25); // salón de juegos
onWall(r, 'w', 'centro-entretenimiento', 23.5, { color: '#5b4636' });
piece('sofa-l', 4.6, 23.5, 90, { color: TAUPE });
piece('alfombra', 3.3, 23.5, 90, { width: 2.4, depth: 1.8, color: ARENA });
r = box(10, 13.75, 14, 18.75); // comedor
piece('mesa-comedor-6', 12, 16.2, 90, { color: MADERA });
for (const y of [15.6, 16.2, 16.8]) {
  piece('silla-comedor', 11.4, y, 270, { color: GRAFITO });
  piece('silla-comedor', 12.6, y, 90, { color: GRAFITO });
}
piece('lampara-colgante', 12, 15.8, 0, { elevation: 1.75 });
piece('lampara-colgante', 12, 16.6, 0, { elevation: 1.75 });
onWall(r, 'e', 'consola', 17.9, { color: MADERA });
r = box(8.75, 21.75, 14, 25.25); // oficina
piece('escritorio', 11.8, 22.9, 180, { color: MADERA });
piece('silla-oficina', 11.8, 22.3, 180);
piece('silla-comedor', 11.4, 23.75, 0, { color: GRAFITO });
piece('silla-comedor', 12.2, 23.75, 0, { color: GRAFITO });
onWall(r, 'e', 'estanteria', 22.6, { color: MADERA });
piece('monstera', 9.3, 22.3);
// terrace with pergola: lounge and outdoor dining
piece('pergola', 10.375, 12.25, 0, { width: 7.25, depth: 3.0, height: 2.6 });
piece('sofa-exterior', 8.4, 11.3, 0, { color: TAUPE });
piece('mesa-centro', 8.4, 12.3, 0, { color: MADERA, width: 1.0, depth: 0.55 });
piece('mesa-exterior', 12.2, 12.25, 0, { color: MADERA, width: 1.8, depth: 0.9 });
// garden with the pool (4,25 × 6,26, sunk to read as an in-ground pool)
piece('piscina', 10.375, 6.43, 0, { width: 4.25, depth: 6.26, height: 0.35, color: '#e8e2d6' });
piece('asoleadora', 7.5, 4.6, 0);
piece('asoleadora', 7.5, 7.2, 0);
piece('arbol-pequeno', 13.2, 4.0);
piece('arbusto', 13.3, 9.5);
piece('sombrilla', 7.5, 9.6);
// parking (cars along the lot) and antejardín
piece('carro', 4.2, 27.25, 0);
piece('carro', 9.0, 27.25, 0, { color: PIZARRA });
piece('arbol-pequeno', 3.0, 30.8);
piece('arbol-pequeno', 12.5, 30.8);
for (const x of [6.5, 9.2]) piece('baliza', x, 29.6);

// ===== E11 =====
piece('parrilla', 18.2, 3.45, 0);
piece('bar', 19.9, 3.45, 0, { width: 1.8, color: GRAFITO });
piece('mesa-comedor-6', 19.0, 6.4, 90, { color: MADERA });
for (const y of [5.8, 6.4, 7.0]) {
  piece('silla-exterior', 18.4, y, 270);
  piece('silla-exterior', 19.6, y, 90);
}
piece('lampara-colgante', 19.0, 6.0, 0, { elevation: 1.75 });
piece('lampara-colgante', 19.0, 6.8, 0, { elevation: 1.75 });
r = box(18.5, 9.25, 21, 10.75); // W/C BBQ
onWall(r, 'e', 'sanitario', 10.0);
onWall(r, 'n', 'lavamanos', 19.4);
piece('pergola', 19.0, 12.25, 0, { width: 4.0, depth: 3.0, height: 2.6 });
piece('sofa-exterior', 19.0, 11.25, 0, { color: TAUPE });
piece('mesa-centro', 19.0, 12.2, 0, { color: MADERA, width: 1.0, depth: 0.55 });
r = box(22.5, 3, 29.5, 7.03); // habitación principal
onWall(r, 'n', 'cama-king', 26.0, { color: ARENA });
onWall(r, 'n', 'mesa-noche', 24.75, { color: MADERA });
onWall(r, 'n', 'mesa-noche', 27.25, { color: MADERA });
onWall(r, 's', 'closet', 28.3, { width: 1.8 });
r = box(22.5, 7.03, 26, 10.75); // hab. 1
onWall(r, 'n', 'cama-doble', 24.6, { color: ARENA });
onWall(r, 'w', 'closet', 9.6);
r = box(26, 7.03, 29.5, 10.75); // hab. 2
onWall(r, 'n', 'cama-doble', 27.6, { color: ARENA });
onWall(r, 'e', 'closet', 9.6);
r = box(17, 13.75, 21, 21.75); // salón de juegos infantiles
piece('alfombra', 19.0, 17.5, 0, { width: 2.6, depth: 3.0, color: '#d9c7a8' });
for (const [x, y] of [[18.3, 16.6], [19.7, 16.6], [18.3, 18.4], [19.7, 18.4]]) piece('puf', x, y);
onWall(r, 'w', 'estanteria', 20.3, { color: MADERA });
onWall(r, 'e', 'mueble-tv', 17.5, { color: MADERA });
onWall(r, 'e', 'televisor', 17.5, { elevation: 1.0 });
piece('mesa-comedor-4', 19.0, 20.6, 0, { color: '#e8e2d6', width: 1.0, depth: 0.8 });
r = box(21, 13.75, 26.5, 18.25); // cocina
onWall(r, 'w', 'nevera', 14.6);
onWall(r, 'w', 'meson', 15.5, { width: 0.8, color: GRAFITO });
onWall(r, 'w', 'lavaplatos', 16.3, { color: GRAFITO });
onWall(r, 'w', 'estufa', 17.3);
onWall(r, 'w', 'campana', 17.3, { height: 1.2 });
piece('bar', 23.9, 16.2, 90, { width: 2.0, color: GRAFITO });
r = box(21, 18.25, 29.5, 21.75); // comedor
piece('mesa-comedor-6', 25.2, 20.0, 0, { color: MADERA });
for (const x of [24.6, 25.2, 25.8]) {
  piece('silla-comedor', x, 19.4, 180, { color: GRAFITO });
  piece('silla-comedor', x, 20.6, 0, { color: GRAFITO });
}
piece('lampara-colgante', 25.2, 20.0, 0, { elevation: 1.75 });
r = box(23, 21.75, 29.5, 25.25); // sala
onWall(r, 'e', 'mueble-tv', 23.5, { color: MADERA });
onWall(r, 'e', 'televisor-70', 23.5, { elevation: 1.05 });
piece('sofa-l', 25.4, 23.5, 270, { color: TAUPE });
piece('mesa-centro', 26.9, 23.5, 90, { color: MADERA });
piece('alfombra', 26.6, 23.5, 90, { width: 2.6, depth: 2.0, color: ARENA });
r = box(17, 21.75, 21, 25.25); // ropas
onWall(r, 'n', 'lavadora', 17.8);
onWall(r, 'n', 'lavadero', 18.8);
onWall(r, 'w', 'canasta-ropa', 24.0);
// central garden
piece('arbol-pequeno', 24.0, 12.2);
piece('luz-piso', 24.0, 11.4);
piece('arbusto', 28.6, 12.6);
piece('banca', 26.5, 13.2, 180, { color: MADERA });
// parking and antejardín
piece('carro', 20.4, 27.25, 0);
piece('carro', 26.2, 27.25, 0, { color: PIZARRA });
piece('arbol-pequeno', 26.5, 30.8);
for (const y of [29.8, 31.2]) piece('baliza', 21.2, y);
// trees in the side setbacks
for (const [x, y] of [[30.25, 8], [30.25, 20], [15.5, 20]]) piece('arbol-pequeno', x, y, 0, { width: 1.4, depth: 1.4, height: 3.2 });

// ===== Details from the renders (sheets 03–08) =====
// Pool: uplights on the stone wall, planters on the deck
for (const x of [8.9, 10.4, 11.9]) piece('luz-piso', x, 3.45);
piece('jardinera', 13.4, 6.5, 90, { width: 2.4, color: GRAFITO });
piece('monstera', 7.2, 10.1);
piece('arbusto', 13.4, 10.2);
// Service gallery: plants and bollards along the bedrooms' sliding doors
for (const y of [5.2, 10.4, 14.6, 18.5, 22.5]) piece('arbusto', 0.45, y, 0, { width: 0.6, depth: 0.6, height: 1.1 });
for (const y of [7.6, 16.8, 24.0]) piece('baliza', 1.1, y);
// Covered walkway between the houses (slatted pergolas) with bollards
for (const y of [4.3, 6.8, 9.3, 11.8]) piece('pergola', 15.5, y, 0, { width: 1.9, depth: 2.5, height: 2.6 });
for (const y of [5.5, 8.0, 10.5]) { piece('baliza', 14.75, y); piece('baliza', 16.25, y); }
// Green boundaries (sheet 03: hedges and planted walls all round)
const hedge = (x0, y0, x1, y1, h = 1.35) => {
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / 2.0));
  const rot = Math.abs(x1 - x0) > Math.abs(y1 - y0) ? 0 : 90;
  for (let i = 0; i < n; i++) { const k = (i + 0.5) / n; piece('seto', x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, rot, { width: L / n + 0.02, depth: 0.45, height: h }); }
};
hedge(0.25, 0.25, 30.75, 0.25);
hedge(0.25, 0.25, 0.25, 29.0);
hedge(30.75, 0.25, 30.75, 29.0);
// E11 playroom: pendant lamps, shelves (sheet 05 V2)
piece('lampara-colgante', 18.5, 15.6, 0, { elevation: 1.9 });
piece('lampara-colgante', 19.5, 15.6, 0, { elevation: 1.9 });
onWall(box(17, 13.75, 21, 21.75), 'w', 'estanteria', 19.2, { color: MADERA });
// E11 social (sheet 07): pendants over the island, plants and art
piece('lampara-colgante', 23.9, 15.7, 0, { elevation: 1.8 });
piece('lampara-colgante', 23.9, 16.7, 0, { elevation: 1.8 });
piece('monstera', 29.0, 21.3);
piece('jarron-pampas', 23.4, 24.8);
onWall(box(23, 21.75, 29.5, 25.25), 'n', 'cuadro-abstracto', 26.2, { width: 1.4, height: 0.9, elevation: 1.3 });
// BBQ: planted wall beside it, plant by the W/C
onWall(box(17, 3, 21, 9.25), 'w', 'jardin-vertical', 7.4, { width: 1.6 });
piece('monstera', 21.6, 9.8);
// Façades: lights by the doors
piece('aplique-exterior', 7.0, 25.42, 0);
piece('aplique-exterior', 8.5, 25.42, 0);
piece('aplique-exterior', 21.3, 25.42, 0);

// ===== E10, upper floor =====
target = upper;
r = box(1.5, 8.25, 5.25, 11.75); // gym
piece('alfombra', 3.2, 10.0, 0, { width: 2.4, depth: 2.0, color: '#4a4a4a' });
onWall(r, 'w', 'espejo-cuerpo', 10.0, { width: 1.6 });
onWall(r, 'n', 'televisor', 3.3, { elevation: 1.3 });
r = box(1.5, 13.25, 5.25, 16.75); // H2
onWall(r, 'w', 'cama-doble', 15.0, { color: ARENA });
onWall(r, 'w', 'mesa-noche', 13.85, { color: MADERA });
onWall(r, 'n', 'closet', 3.0);
r = box(1.5, 16.75, 6.75, 21.75); // principal
onWall(r, 'w', 'cama-king', 19.25, { color: ARENA });
onWall(r, 'w', 'mesa-noche', 17.95, { color: MADERA });
onWall(r, 'w', 'mesa-noche', 20.55, { color: MADERA });
onWall(r, 'e', 'televisor-70', 19.25, { elevation: 1.0 });
piece('alfombra', 4.1, 19.25, 90, { width: 2.4, depth: 1.6, color: '#d8ccbf' });
r = box(1.5, 21.75, 6.75, 25.25); // H1
onWall(r, 'w', 'cama-doble', 23.4, { color: ARENA });
onWall(r, 'w', 'mesa-noche', 22.25, { color: MADERA });
onWall(r, 'n', 'closet', 5.6);
r = box(8.75, 21.75, 14, 25.25); // estudio
piece('escritorio', 11.4, 22.6, 180, { color: MADERA });
piece('silla-oficina', 11.4, 23.1, 0);
onWall(r, 'e', 'estanteria', 23.0, { color: MADERA });
piece('sillon', 9.6, 24.4, 90, { color: TAUPE });
// private terrace over the parking
piece('sofa-exterior', 4.5, 27.0, 0, { color: TAUPE });
piece('mesa-centro', 4.5, 28.0, 0, { color: MADERA, width: 1.0, depth: 0.55 });
piece('sillon-exterior', 3.0, 28.0, 90, { color: TAUPE });
piece('sillon-exterior', 6.0, 28.0, 270, { color: TAUPE });
piece('mesa-exterior', 11.2, 27.4, 0, { color: MADERA });
for (const x of [2.0, 8.0, 13.5]) piece('matera-alta', x, 28.8, 0, { color: GRAFITO });
piece('pergola', 8.6, 27.3, 0, { width: 5.6, depth: 3.6, height: 2.7 }); // sheet 08 V1: slatted canopy over the terrace
onWall(box(8.75, 21.75, 14, 25.25), 'n', 'repisa-decorativa', 12.6, { elevation: 1.5 });
piece('monstera', 13.5, 24.7);
piece('lampara-pie', 9.3, 23.6);

// ---------- Wall finishes: warm concrete outside, sand inside, stone and wood accents (renders) ----------
const pip = (q, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; };
const rp = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const VOIDS = [rp(1.5, 6.5, 6.75, 8.25), rp(5.25, 8.25, 6.75, 11.75), rp(6.75, 13.75, 14, 18.75), rp(10, 18.75, 14, 21.75)];
const CONCRETO = { finish: 'pintura', color: '#D6D0C6' }, ARENA_IN = { finish: 'pintura', color: '#EFE8DE' };
const PIEDRA = { finish: 'piedra', color: '#b9ab95' }, MADERA_F = { finish: 'madera' };
const near = (a, b) => Math.abs(a - b) < 0.05;
const hz = (w, y, x0, x1) => near(w.a.y, y) && near(w.b.y, y) && Math.min(w.a.x, w.b.x) >= x0 - 0.05 && Math.max(w.a.x, w.b.x) <= x1 + 0.05;
const vt = (w, x, y0, y1) => near(w.a.x, x) && near(w.b.x, x) && Math.min(w.a.y, w.b.y) >= y0 - 0.05 && Math.max(w.a.y, w.b.y) <= y1 + 0.05;
project.floors.forEach((fl, i) => {
  const inside = [...fl.rooms.filter((x) => x.kind === 'room' || x.kind === 'stairs' || (i === 1 && x.name === 'Pasarela')).map((x) => x.points), ...(i === 1 ? VOIDS : [])];
  for (const w of fl.walls) {
    const dx = w.b.x - w.a.x, dy = w.b.y - w.a.y, l = Math.hypot(dx, dy);
    const face = (s) => {
      const n = { x: (-dy / l) * s, y: (dx / l) * s }, off = w.thickness / 2 + 0.05;
      const q = { x: w.a.x + dx / 2 + n.x * off, y: w.a.y + dy / 2 + n.y * off };
      if (i === 0 && hz(w, 3.15, 8, 13)) return PIEDRA; // pool wall
      if (i === 0 && hz(w, 3, 17, 21)) return PIEDRA; // BBQ back wall
      if (inside.some((pts) => pip(q, pts))) {
        if (i === 1 && vt(w, 14, 21.75, 25.25)) return MADERA_F; // estudio: wood slats (sheet 06 V3)
        if (i === 0 && vt(w, 29.5, 18.25, 25.25)) return { finish: 'piedra', color: '#d9cfc0' }; // E11 social stone wall (sheet 07)
        return ARENA_IN;
      }
      if (i === 0 && hz(w, 25.25, 17, 29.5)) return PIEDRA; // E11 façade (sheet 08 V2)
      if (i === 0 && hz(w, 25.25, 1.5, 14)) return MADERA_F; // E10 ground façade under the terrace
      return CONCRETO;
    };
    w.sides = { left: face(1), right: face(-1) };
  }
});

writeFileSync(OUT, JSON.stringify(project, null, 2) + '\n');
console.log(`Listo: ${OUT}`);
