// Nueva casa — Habitaciones 1 y 2 (asked 2026-10-31): each with a private bathroom, a double bed and air
// conditioning, on top of the user's own saved version (biblioteca/). Both rooms are 3.05 × 5 m beside the side
// corridor (Pasillo lateral, x 0–2.15):
//   - private bathroom across the end on the wall between the two rooms, back to back with the other one so they
//     share the plumbing: shower in the outer corner under a high window, WC in the middle, basin with mirror by the
//     corridor wall; door from the bedroom;
//   - bedroom: double bed with its head on the outer wall, nightstands either side, the way to the bathroom clear,
//     air conditioner high on the corridor wall;
//   - door from the corridor; window: Habitación 1 on the outer side, Habitación 2 to the patio;
//   - the corridor opens to the patio at its end, so the rooms can be reached.
// Writes public/ejemplos/nueva-casa.casa.json; the open page shows it by itself.
//   node scripts/nueva-casa-habitaciones.mjs [puerto]     (needs the dev server, default :5173)
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(root, 'public/ejemplos/nueva-casa.casa.json');
const PORT = process.argv[2] ?? '5173';
const ID = '0918370a-5550-4c7b-a218-1280fbf03c2d';

const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:${PORT}/__estudio`);

const json = await page.evaluate(async (ID) => {
  const { hashProject } = await import('/src/persistence/openFromUrl.ts');
  const { parseProject, serializeProject } = await import('/src/persistence/projectFile.ts');
  const ops = await import('/src/model/ops.ts');
  const fo = await import('/src/model/furnitureOps.ts');
  const { newId } = await import('/src/model/ids.ts');
  const r = parseProject(await (await fetch(`/api/kv/proyecto:${ID}`)).text());
  if (!r.ok) throw new Error(r.error);
  const p = r.project;
  const before = hashProject(p);
  const f = p.floors[0];
  const put = (type, x, y, rotation = 0, extra = {}) => fo.addFurniture(p, f.id, { ...fo.furnitureFromCatalog(type, { x, y }, rotation), ...extra });
  const near = (a, b, tol = 0.03) => Math.abs(a - b) < tol;
  const vertical = (x, y) => f.walls.find((w) => near(w.a.x, x) && near(w.b.x, x) && Math.min(w.a.y, w.b.y) <= y && Math.max(w.a.y, w.b.y) >= y);
  const horizontal = (y, x) => f.walls.find((w) => near(w.a.y, y) && near(w.b.y, y) && Math.min(w.a.x, w.b.x) <= x && Math.max(w.a.x, w.b.x) >= x);
  /** Adds a door or window centred at a point of a wall (offset measured from the wall's start). */
  const opening = (w, kind, at, size) => {
    const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
    const t = ((at.x - w.a.x) * (w.b.x - w.a.x) + (at.y - w.a.y) * (w.b.y - w.a.y)) / len;
    const id = ops.addOpening(p, f.id, w.id, kind, t);
    if (!id) throw new Error(`No cupo: ${kind} en (${at.x}, ${at.y})`);
    ops.updateOpening(p, f.id, id, size);
    return id;
  };

  const C = 2.15; // corridor wall
  const XR = 5.35; // outer wall
  const x0 = C + 0.075;
  const x1 = XR - 0.075;
  const corridorWall = vertical(C, 10);
  if (!corridorWall) throw new Error('No encontré el muro del pasillo');

  for (const name of ['Habitación 1', 'Habitación 2']) {
    const room = f.rooms.find((x) => x.name === name);
    if (!room) throw new Error(`No está la ${name}`);
    const bathName = `Baño ${name.toLowerCase()}`;
    // The whole room between its masonry walls (whatever an earlier run split it into).
    const cy = room.points.reduce((t, q) => t + q.y, 0) / room.points.length;
    const across = f.walls.filter((w) => !w.kind && near(w.a.y, w.b.y, 0.02) && Math.min(w.a.x, w.b.x) <= 3.75 && Math.max(w.a.x, w.b.x) >= 3.75).map((w) => w.a.y);
    const y0 = Math.max(...across.filter((y) => y < cy)) + 0.075;
    const y1 = Math.min(...across.filter((y) => y > cy)) - 0.075;
    const inside = (q) => q.x > C && q.x < XR && q.y > y0 - 0.05 && q.y < y1 + 0.05;
    // Start again inside the room every run: pieces, the bathroom wall, and the doors and windows added here.
    f.furniture = f.furniture.filter((m) => !inside(m));
    for (const w of f.walls.filter((w) => w.kind === 'drywall' && inside({ x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 }))) ops.deleteWall(p, f.id, w.id);
    const outer = vertical(XR, (y0 + y1) / 2) ?? vertical(XR + 0.01, (y0 + y1) / 2);
    const onWall = (o, w) => {
      if (o.wallId !== w?.id) return false;
      const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
      const y = w.a.y + ((w.b.y - w.a.y) * o.offset) / len;
      return y > y0 && y < y1;
    };
    f.openings = f.openings.filter((o) => !onWall(o, corridorWall) && !onWall(o, outer));
    f.rooms = f.rooms.filter((x) => x.name !== bathName);

    // Private bathroom (1.55 m deep) across the end on the wall between the two rooms, so both bathrooms are back to
    // back and share the plumbing (the user's call): WCs and showers on that shared wall.
    const atEnd = name === 'Habitación 1'; // Habitación 1's bathroom at its far end, Habitación 2's at its near end
    const L = y1 - y0;
    const yy = (d) => (atEnd ? y1 - d : y0 + d); // distance from the bathroom's end wall → plan y
    const away = atEnd ? 180 : 0; // pieces with their back to that end wall
    const wallY = yy(1.6);
    const bathWall = ops.addWall(p, f.id, { x: C, y: wallY }, { x: XR, y: wallY }, 0.1, 'drywall');
    const bathDoor = opening(f.walls.find((w) => w.id === bathWall), 'door', { x: 3.3, y: wallY }, { width: 0.7 });
    if (!atEnd) ops.toggleDoorFlip(p, f.id, bathDoor); // it opens into the bathroom
    const span = (a, b) => [Math.min(yy(a), yy(b)), Math.max(yy(a), yy(b))];
    const [b0, b1] = span(0, 1.55);
    f.rooms.push({
      id: newId(), name: bathName, kind: 'room', floorMaterial: 'ceramica',
      points: [{ x: x0, y: b0 }, { x: x1, y: b0 }, { x: x1, y: b1 }, { x: x0, y: b1 }],
    });
    const [r0, r1] = span(1.65, L);
    room.points = [{ x: x0, y: r0 }, { x: x1, y: r0 }, { x: x1, y: r1 }, { x: x0, y: r1 }];
    put('ducha', x1 - 0.55, yy(0.5), away, { width: 1.1, depth: 1.0 });
    put('sanitario', 3.55, yy(0.35), away);
    put('lavamanos', x0 + 0.225, yy(0.75), 270);
    put('espejo', x0 + 0.015, yy(0.75), 270, { width: 0.6, height: 0.8, elevation: 1.15 });
    put('toallero', x1 - 0.06, yy(1.25), 90);
    put('luz-empotrada', 3.3, yy(0.8));
    if (outer) opening(outer, 'window', { x: XR, y: yy(0.5) }, { width: 0.6, height: 0.45, sill: 1.85 });

    // Bedroom: the double bed with its head on the outer wall, in the middle of the bedroom, nightstands either side;
    // the way from the room door to the bathroom door stays clear. Air conditioner high on the corridor wall, facing
    // the bed.
    const midD = (1.65 + L) / 2;
    const bedY = yy(midD);
    put('cama-doble', x1 - 0.95, bedY, 90);
    for (const sy of [-1, 1]) {
      put('mesa-noche', x1 - 0.2, bedY + sy * (0.7 + 0.25), 90);
      put('lampara-colgante', x1 - 0.25, bedY + sy * (0.7 + 0.25), 0);
    }
    put('aire-acondicionado', x0 + 0.115, bedY, 270, { elevation: 2.15 });
    for (const d of [midD - 0.8, midD + 0.8]) put('luz-empotrada', 3.4, yy(d));
    // Door from the corridor near the bedroom's open end, opening into the room.
    const door = opening(corridorWall, 'door', { x: C, y: yy(L - 0.6) }, { width: 0.8 });
    if (!atEnd) ops.toggleDoorFlip(p, f.id, door);
    // Window: Habitación 2 looks onto the patio, Habitación 1 to the outer side.
    const patioWall = horizontal(y1 + 0.075, 3.75);
    if (name === 'Habitación 2' && patioWall) {
      f.openings = f.openings.filter((o) => o.wallId !== patioWall.id || o.kind !== 'window');
      opening(patioWall, 'window', { x: 3.9, y: y1 + 0.075 }, { width: 1.5, height: 1.2, sill: 1.0 });
    } else if (outer) {
      opening(outer, 'window', { x: XR, y: yy(midD) }, { width: 1.2, height: 0.9, sill: 1.3 }); // over the headboard
    }
  }

  // The corridor opens onto the patio at its end (no door), so it leads somewhere.
  const corridorEnd = horizontal(16.45, 1.0);
  if (corridorEnd && !f.openings.some((o) => o.wallId === corridorEnd.id)) {
    const id = opening(corridorEnd, 'door', { x: 1.075, y: 16.45 }, { width: 1.0 });
    ops.setDoorVano(p, f.id, id, true);
  }

  // The open page follows the file: count the saved copy as the file's version, so the new one loads by itself.
  const origin = JSON.parse(await (await fetch(`/api/kv/origen:${ID}`)).text());
  await fetch(`/api/kv/origen:${ID}`, { method: 'PUT', body: JSON.stringify({ ...origin, projectHash: before }) });
  return serializeProject(p);
}, ID);
await browser.close();
writeFileSync(FILE, JSON.stringify(JSON.parse(json), null, 2));
console.log(`Listo: ${FILE}`);
