// Brandon Cuarto (asked 2026-10-31): one room, 4 m wide by 3 m deep inside, masonry walls 15 cm thick.
//   - door at the left corner of the front wall (front = bottom of the plan), opening into the room;
//   - window diagonally across, at the right end of the back wall.
// Writes public/ejemplos/brandon-cuarto.casa.json; the open page shows it by itself.
//   node scripts/brandon-cuarto.mjs [puerto]     (needs the dev server, default :5173)
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(root, 'public/ejemplos/brandon-cuarto.casa.json');
const PORT = process.argv[2] ?? '5173';
const ID = '604f0f53-ddc1-4be6-9aa5-278f8910c779';

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
  // Start again every run.
  f.walls = [];
  f.openings = [];
  f.rooms = [];
  f.furniture = [];

  const W = 4; // inside width
  const D = 3; // inside depth
  const T = 0.15; // wall thickness
  const h = T / 2;
  // Wall centre lines, so the inside is exactly W × D (x 0–4, y 0–3).
  const c = [{ x: -h, y: -h }, { x: W + h, y: -h }, { x: W + h, y: D + h }, { x: -h, y: D + h }];
  const back = ops.addWall(p, f.id, c[0], c[1], T);
  ops.addWall(p, f.id, c[1], c[2], T);
  ops.addWall(p, f.id, c[3], c[0], T);
  // The front wall runs right → left: a door hinges at its wall's start, so this one hinges on its right side.
  const front = ops.addWall(p, f.id, c[2], c[3], T);

  // Door at the front-left corner, 10 cm of wall beside it, opening into the room towards the right (the user's).
  const doorW = 0.8;
  const door = ops.addOpening(p, f.id, front, 'door', W + h - (0.1 + doorW / 2));
  ops.updateOpening(p, f.id, door, { width: doorW });
  // Window diagonally across: right end of the back wall (back wall runs left → right).
  const winW = 1.2;
  const win = ops.addOpening(p, f.id, back, 'window', W + h - (0.3 + winW / 2));
  ops.updateOpening(p, f.id, win, { width: winW, height: 1.2, sill: 1.0 });
  if (!door || !win) throw new Error('No cupo la puerta o la ventana');

  f.rooms.push({
    id: newId(), name: 'Cuarto', kind: 'room', floorMaterial: 'madera',
    points: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: D }, { x: 0, y: D }],
  });
  const put = (type, x, y, rotation = 0, extra = {}) => fo.addFurniture(p, f.id, { ...fo.furnitureFromCatalog(type, { x, y }, rotation), ...extra });
  put('luz-empotrada', W / 2, D / 2);

  // Furniture (asked 2026-10-31): double bed, wardrobe, entertainment centre and gaming desk in one piece, a laundry
  // basket and a full-length mirror; the way from the door kept clear.
  // Double bed with its head on the right wall, towards the back (the window beside it), a nightstand behind it.
  const bedY = 1.15;
  put('cama-doble', W - 0.95, bedY, 90);
  put('mesa-noche', W - 0.2, 0.225, 90);
  // Entertainment centre and gaming desk in one unit on the left wall, facing the bed (the user's call, to save
  // space): the 55" TV hangs over the desk, monitor and PC tower on it, the gaming chair in front. It stops short of
  // the door's swing.
  const unitY = 1.075;
  put('centro-escritorio', 0.4, unitY, 270, { width: 2.15, depth: 0.8, height: 2.3 }); // desk 80 cm deep (the user's)
  put('televisor', 0.08, unitY, 270, { elevation: 1.22 });
  put('monitor', 0.3, unitY, 270);
  put('torre-pc', 0.4, unitY + 0.55, 270);
  put('silla-gamer', 1.2, unitY, 90);
  // Wardrobe (1.80 × 0.60, the user's) in the front-right corner, its doors opening clear of the bed.
  put('closet', W - 0.9, D - 0.3, 180, { width: 1.8, depth: 0.6 });
  // The front wall between the door and the wardrobe stays free; a gaming poster on it.
  put('poster-gamer', 1.6, D - 0.01, 180);
  // Laundry basket on the back wall by the foot of the bed.
  put('canasta-ropa', 1.85, 0.25);
  // Full-length mirror on the back wall between the entertainment centre and the basket, clear floor in front of it.
  put('espejo-cuerpo', 1.15, 0.025);

  // The open page follows the file: count the saved copy as the file's version, so the new one loads by itself.
  const origin = JSON.parse(await (await fetch(`/api/kv/origen:${ID}`)).text());
  await fetch(`/api/kv/origen:${ID}`, { method: 'PUT', body: JSON.stringify({ ...origin, projectHash: before }) });
  return serializeProject(p);
}, ID);
await browser.close();
writeFileSync(FILE, JSON.stringify(JSON.parse(json), null, 2));
console.log(`Listo: ${FILE}`);
