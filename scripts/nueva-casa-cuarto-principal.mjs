// Nueva casa — furnishes the master bedroom (Habitación 15, 6 × 6 at the back) on top of the current file, keeping
// its id so open pages and the user's copy follow it. Run it after scripts/base/generar-nueva-casa-croquis.mjs.
//   node scripts/nueva-casa-cuarto-principal.mjs [puerto]     (needs the dev server, default :5173)
//
// Inside the room (x 0,075–6,075, y 0,075–6,075; the back wall at the top, the side strip and the door bottom-left):
//   - walk-in dressing room on the right behind a 10 cm drywall partition at x 4,5 (open 1,6 m at the bottom),
//     dressing modules along the right wall fitted into it, full-length mirror on the partition;
//   - king bed against the back wall with nightstands, a rug and a picture above;
//   - TV on a console on the front wall; reading armchair and floor lamp by the left wall;
//   - door 0,8 m from the side strip.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(root, 'public/ejemplos/nueva-casa.casa.json');
const PORT = process.argv[2] ?? '5173';

const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://localhost:${PORT}/?biblioteca`);
await page.waitForTimeout(800);

const json = await page.evaluate(async (text) => {
  const ops = await import('/src/model/ops.ts');
  const fo = await import('/src/model/furnitureOps.ts');
  const { parseProject, serializeProject } = await import('/src/persistence/projectFile.ts');
  const r = parseProject(text);
  if (!r.ok) throw new Error(r.error);
  const p = r.project;
  const f = p.floors[0];
  const room = f.rooms.find((x) => x.name === 'Habitación 15');
  if (!room) throw new Error('No está la Habitación 15');
  // Start again inside the room every run (pieces, the partition and the door added here).
  const inRoom = (x, y) => x > 0 && x < 6.15 && y > 0 && y < 6.15;
  f.furniture = f.furniture.filter((m) => !inRoom(m.x, m.y));
  f.walls.filter((w) => w.kind === 'drywall' && inRoom((w.a.x + w.b.x) / 2, (w.a.y + w.b.y) / 2)).forEach((w) => ops.deleteWall(p, f.id, w.id));

  // Door from the side strip (the wall under the room, at x 0–1).
  const front = f.walls.find((w) => Math.abs(w.a.y - 6.15) < 0.02 && Math.abs(w.b.y - 6.15) < 0.02 && Math.min(w.a.x, w.b.x) < 0.5 && Math.max(w.a.x, w.b.x) > 0.5);
  if (!front) throw new Error('No encontré el muro de abajo de la habitación');
  if (!f.openings.some((o) => o.wallId === front.id && o.kind === 'door')) ops.addOpening(p, f.id, front.id, 'door', Math.abs(0.5 - front.a.x));

  // Drywall partition for the walk-in dressing room.
  ops.addWall(p, f.id, { x: 4.5, y: 0 }, { x: 4.5, y: 4.4 }, undefined, 'drywall');

  const put = (type, x, y, rotation = 0, extra = {}) => {
    const id = fo.addFurniture(p, f.id, { ...fo.furnitureFromCatalog(type, { x, y }, rotation), ...extra });
    return id;
  };
  // Dressing modules along the right wall, front to the dressing room (rotation 90 = front towards −x).
  let y = 0.075;
  for (const [type, w] of [['vestier-colgar', 1], ['vestier-colgar', 1], ['vestier-cajones', 1], ['vestier-repisas', 0.7], ['vestier-zapatos', 0.7]]) {
    put(type, 6.075 - 0.275, y + w / 2, 90);
    y += w;
  }
  put('espejo-cuerpo', 4.55 + 0.025, 2.2, 270);

  // Sleeping area.
  put('cama-king', 2.25, 0.075 + 1, 0);
  put('mesa-noche', 2.25 - 1 - 0.3, 0.075 + 0.2, 0);
  put('mesa-noche', 2.25 + 1 + 0.3, 0.075 + 0.2, 0);
  put('alfombra', 2.25, 1.55, 0, { width: 2.8, depth: 2 });
  put('cuadro-abstracto', 2.25, 0.075 + 0.02, 0, { elevation: 1.35, width: 1.2, depth: 0.04, height: 0.7 });
  // TV wall and reading corner.
  put('mueble-tv', 2.25, 6.075 - 0.2, 180);
  put('televisor-70', 2.25, 6.075 - 0.03, 180);
  put('sillon', 0.075 + 0.5, 3.6, 270);
  put('lampara-pie', 0.075 + 0.25, 2.95, 0);
  return serializeProject(p);
}, readFileSync(FILE, 'utf8'));
await browser.close();
if (errors.length) throw new Error(errors.join('\n'));
writeFileSync(FILE, JSON.stringify(JSON.parse(json), null, 2));
console.log(`Listo: ${FILE}`);
