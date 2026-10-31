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
  // Palette (asked 2026-10-31): sand porcelain floor and sand walls (a shade lighter, so the corners read), warm wood,
  // cream textiles, black for the setup.
  const SAND_FLOOR = '#d4bf9c';
  const SAND_WALL = '#e6d7bc';
  const back = ops.addWall(p, f.id, c[0], c[1], T);
  ops.addWall(p, f.id, c[1], c[2], T);
  ops.addWall(p, f.id, c[3], c[0], T);
  // The front wall runs right → left: a door hinges at its wall's start, so this one hinges on its right side.
  const front = ops.addWall(p, f.id, c[2], c[3], T);

  for (const w of f.walls) w.sides = { left: { finish: 'pintura', color: SAND_WALL }, right: { finish: 'pintura', color: SAND_WALL } };

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
    id: newId(), name: 'Cuarto', kind: 'room', floorMaterial: 'porcelanato', floorColor: SAND_FLOOR,
    points: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: D }, { x: 0, y: D }],
  });
  const put = (type, x, y, rotation = 0, extra = {}) => fo.addFurniture(p, f.id, { ...fo.furnitureFromCatalog(type, { x, y }, rotation), ...extra });

  // Furniture (asked 2026-10-31): double bed, wardrobe, entertainment centre and gaming desk in one piece, a laundry
  // basket and a full-length mirror; the way from the door kept clear.
  // Double bed with its head on the right wall, towards the back (the window beside it), a nightstand behind it.
  const bedY = 1.15;
  put('cama-doble', W - 0.95, bedY, 90);
  for (const sy of [-1, 1]) put('mesa-noche', W - 0.2, bedY + sy * 0.925, 90); // one each side (the user's)
  // Entertainment centre and gaming desk in one unit on the left wall, facing the bed (the user's call, to save
  // space): the 55" TV hangs over the desk, monitor and PC tower on it, the gaming chair in front. It stops short of
  // the door's swing.
  const unitY = 1.075;
  put('centro-escritorio', 0.4, unitY, 270, { width: 2.15, depth: 0.8, height: 2.3 }); // desk 80 cm deep (the user's)
  put('televisor', 0.08, unitY, 270, { elevation: 1.22 });
  put('monitor', 0.3, unitY, 270);
  put('torre-pc', 0.4, unitY + 0.55, 270);
  put('silla-oficina', 1.12, unitY, 90, { color: '#3a3d42' }); // office chair (the user's)
  // Wardrobe (1.80 × 0.60, the user's) in the front-right corner, its doors opening clear of the bed.
  // Wardrobe beside the door (the user's call, so the bed gets a nightstand on each side): the open door rests on it.
  put('closet', 1.0 + 0.9, D - 0.3, 180, { width: 1.8, depth: 0.6 });
  // Printer (asked 2026-10-31) on a small cabinet in the front-right corner, paper kept inside, a gaming poster over it.
  const printerX = 3.15;
  put('comoda', printerX, D - 0.225, 180, { width: 0.6, depth: 0.45, height: 0.75 });
  put('impresora', printerX, D - 0.25, 180);
  put('poster-gamer', printerX, D - 0.01, 180);
  // Laundry basket on the back wall by the foot of the bed.
  put('canasta-ropa', 1.85, 0.25);
  // Full-length mirror on the back wall between the entertainment centre and the basket, clear floor in front of it.
  put('espejo-cuerpo', 1.15, 0.025);

  // Lighting (asked 2026-10-31): warm yellow everywhere for a cosy room, mostly indirect.
  //   - cove of warm LED all round the ceiling (indirect light washing the walls);
  //   - warm LED behind the headboard, a pendant over the nightstand, two warm downlights;
  //   - the setup's neons are «Tira LED neón» pieces: pick any colour in Propiedades and they light in it.
  const WARM = '#ffc56b';
  const cove = 2.45;
  put('tira-led-calida', W / 2, 0.03, 0, { width: W - 0.2, elevation: cove, color: WARM });
  put('tira-led-calida', W / 2, D - 0.03, 180, { width: W - 0.2, elevation: cove, color: WARM });
  put('tira-led-calida', 0.03, D / 2, 270, { width: D - 0.2, elevation: cove, color: WARM });
  put('tira-led-calida', W - 0.03, D / 2, 90, { width: D - 0.2, elevation: cove, color: WARM });
  put('tira-led-calida', W - 0.02, bedY, 90, { width: 1.5, elevation: 1.05, color: WARM });
  for (const sy of [-1, 1]) put('lampara-colgante', W - 0.22, bedY + sy * 0.925);
  for (const lx of [1.3, 2.9]) put('luz-empotrada', lx, D / 2);
  // Setup neons, warm yellow to start with like the rest: behind the TV, under the desk top and over the poster.
  put('tira-led', 0.015, unitY, 270, { width: 1.3, elevation: 1.55, color: WARM });
  put('tira-led', 0.75, unitY, 270, { width: 1.35, elevation: 0.7, color: WARM });
  put('tira-led', printerX, D - 0.015, 180, { width: 0.8, elevation: 2.0, color: WARM });

  // Decoration: a rug under the foot of the bed, a curtain on the window, a picture over the headboard, a plant.
  put('alfombra', 2.1, bedY, 0, { width: 2.0, depth: 1.5, color: '#cdb89a' });
  put('cortina', 3.1, 0.06, 0, { width: 1.5 });
  put('cuadro-abstracto', W - 0.02, bedY, 90, { elevation: 1.3 });
  put('monstera', 3.73, D - 0.27, 0, { width: 0.5, depth: 0.5, height: 1.2 });
  // A low chest of drawers at the foot of the bed to keep things on and in (asked 2026-10-31).
  put('comoda', 2.1 - 0.22, bedY, 90, { width: 1.3, depth: 0.4, height: 0.45 });
  // Shelves (asked 2026-10-31): two on the back wall between the mirror and the window, over the basket.
  put('repisa-decorativa', 1.95, 0.11, 0, { width: 0.8, height: 0.7, elevation: 1.2, color: '#7a5a3f' });

  // Little things that bring it to life (asked 2026-10-31): plants and decor on the surfaces, a hanging plant by the
  // window, a pampas vase in the corner by the unit.
  put('matita', 0.3, unitY - 0.5, 0, { elevation: 0.75 }); // on the desk
  put('matita', W - 0.2, bedY + 0.925, 0, { elevation: 0.55, color: '#c87a55' }); // nightstand by the wardrobe
  put('adornos-mesa', W - 0.2, bedY - 0.925, 90, { elevation: 0.55 }); // nightstand under the window
  put('adornos-mesa', 2.1 - 0.22, bedY + 0.3, 90, { elevation: 0.45, color: '#e9e4da' }); // on the chest
  put('planta-colgante', 2.62, 0.3, 0, { elevation: 2.6 - 0.9 });
  put('jarron-pampas', 0.65, 0.15, 0, { width: 0.22, depth: 0.22, height: 0.8 });

  // The open page follows the file: count the saved copy as the file's version, so the new one loads by itself.
  const origin = JSON.parse(await (await fetch(`/api/kv/origen:${ID}`)).text());
  await fetch(`/api/kv/origen:${ID}`, { method: 'PUT', body: JSON.stringify({ ...origin, projectHash: before }) });
  return serializeProject(p);
}, ID);
await browser.close();
writeFileSync(FILE, JSON.stringify(JSON.parse(json), null, 2));
console.log(`Listo: ${FILE}`);
