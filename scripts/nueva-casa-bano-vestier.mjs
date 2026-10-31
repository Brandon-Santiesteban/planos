// Nueva casa — master bedroom, bathroom and walk-in (asked 2026-10-31), on top of the user's own saved version
// (biblioteca/). Third layout, the user's choice:
//   - en-suite bathroom between the TV partition (x 3.51) and the wall at x 4.735, closed at y 4.5 by a drywall wall
//     with its door: rain shower at the back, double basin with mirror on the side wall, WC by the entrance;
//   - walk-in dressing room in the right-hand strip, modules in a C (back end, right wall, front end with the chest of
//     drawers and its mirror), opening to the bedroom by its own door;
//   - lighting: recessed ceiling lights, pendants over the nightstands, a warm LED cove over the headboard, lights in
//     the bathroom and the dressing room, sconces beside the bathroom mirror.
// Both doors open into the bedroom (inwards they would hit the WC and the chest of drawers).
// Writes public/ejemplos/nueva-casa.casa.json; the open page shows it by itself.
//   node scripts/nueva-casa-bano-vestier.mjs [puerto]     (needs the dev server, default :5173)
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
  const room = f.rooms.find((x) => x.name === 'Habitación 15');
  if (!room) throw new Error('No está la Habitación 15');
  const T = 0.05; // the user's drywall partitions are 5 cm
  const A = 3.51; // TV partition (kept)
  const X = 4.735; // wall between the bathroom and the walk-in
  const Y = 4.5; // front wall of the bathroom

  // Walls: the bathroom/walk-in wall again (with the walk-in door) and the bathroom's front wall (with its door).
  const isAt = (w, x) => w.kind === 'drywall' && Math.abs(w.a.x - x) < 0.06 && Math.abs(w.b.x - x) < 0.06;
  const isFront = (w) => w.kind === 'drywall' && Math.abs(w.a.y - Y) < 0.06 && Math.abs(w.b.y - Y) < 0.06;
  for (const w of f.walls.filter((w) => isAt(w, X) || isFront(w))) ops.deleteWall(p, f.id, w.id);
  const side = ops.addWall(p, f.id, { x: X, y: 0.075 }, { x: X, y: 6.075 }, T, 'drywall');
  const walkInDoor = ops.addOpening(p, f.id, side, 'door', 4.95 - 0.075);
  const front = ops.addWall(p, f.id, { x: A, y: Y }, { x: X, y: Y }, T, 'drywall');
  const bathDoor = ops.addOpening(p, f.id, front, 'door', 0.5);
  if (!walkInDoor || !bathDoor) throw new Error('Una puerta no cupo');
  for (const id of [walkInDoor, bathDoor]) ops.updateOpening(p, f.id, id, { width: 0.7 });

  // Rooms: the bedroom (an L round the bathroom), the bathroom (ceramic floor) and the walk-in (wood).
  const bath = { x0: A + T / 2, x1: X - T / 2, y0: 0.075, y1: Y - T / 2 };
  const walk = { x0: X + T / 2, x1: 6.075, y0: 0.075, y1: 6.075 };
  room.points = [
    { x: 0.075, y: 0.075 }, { x: A - T / 2, y: 0.075 }, { x: A - T / 2, y: Y + T / 2 }, { x: X - T / 2, y: Y + T / 2 },
    { x: X - T / 2, y: 6.075 }, { x: 0.075, y: 6.075 },
  ];
  const rect = (b) => [{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }];
  f.rooms = f.rooms.filter((x) => x.name !== 'Baño principal' && x.name !== 'Vestier');
  f.rooms.push({ id: newId(), name: 'Baño principal', kind: 'room', floorMaterial: 'ceramica', points: rect(bath) });
  f.rooms.push({ id: newId(), name: 'Vestier', kind: 'room', floorMaterial: 'madera', points: rect(walk) });

  // Start this part again every run: dressing modules, bathroom pieces and light fittings in the room.
  const inRoom = (m) => m.x > 0 && m.x < 6.15 && m.y > 0 && m.y < 6.15;
  const redo = new Set(['vestier-colgar', 'vestier-cajones', 'vestier-repisas', 'vestier-zapatos', 'ducha', 'lavamanos-doble', 'espejo', 'sanitario', 'toallero',
    'luz-empotrada', 'lampara-colgante', 'aplique-pared', 'tira-led-calida']);
  f.furniture = f.furniture.filter((m) => !(inRoom(m) && redo.has(m.type)));
  const put = (type, x, y, rotation = 0, extra = {}) => fo.addFurniture(p, f.id, { ...fo.furnitureFromCatalog(type, { x, y }, rotation), ...extra });

  // Bathroom (1.17 × 4.4 m): shower at the back, basin and mirror on the wall to the walk-in, WC by the entrance.
  const bx = (bath.x0 + bath.x1) / 2;
  put('ducha', bx, bath.y0 + 0.6, 0, { width: bath.x1 - bath.x0 - 0.02, depth: 1.2 });
  put('toallero', bath.x0 + 0.06, 1.7, 270);
  put('lavamanos-doble', bath.x1 - 0.25, 2.4, 90);
  put('espejo', bath.x1 - 0.015, 2.4, 90, { width: 1.2, height: 0.9, elevation: 1.1 });
  put('aplique-pared', bath.x1 - 0.07, 1.67, 90, { elevation: 1.45 });
  put('aplique-pared', bath.x1 - 0.07, 3.13, 90, { elevation: 1.45 });
  put('sanitario', bath.x1 - 0.35, 3.55, 90);
  for (const ly of [0.675, 2.4, 3.8]) put('luz-empotrada', bx, ly);

  // Walk-in in a C: shelves at the back end, modules along the right wall, the chest of drawers closing the front end.
  const D = 0.55;
  const passage = (walk.x0 + walk.x1 - D) / 2;
  put('vestier-repisas', passage, walk.y0 + D / 2, 0, { width: walk.x1 - walk.x0 - D });
  let y = walk.y0;
  for (const [type, w] of [['vestier-colgar', 1], ['vestier-colgar', 1], ['vestier-cajones', 1], ['vestier-colgar', 1], ['vestier-zapatos', 0.7]]) {
    put(type, walk.x1 - D / 2, y + w / 2, 90);
    y += w;
  }
  for (const m of f.furniture.filter((m) => inRoom(m) && m.type === 'comoda-espejo')) {
    Object.assign(m, { rotation: 180, x: (walk.x0 + walk.x1) / 2, y: walk.y1 - m.depth / 2 });
  }
  for (const ly of [1.3, 3.0, 4.7]) put('luz-empotrada', passage, ly);

  // Bedroom lighting: recessed lights, pendants over the nightstands, warm LED cove over the headboard.
  for (const [lx, ly] of [[1.0, 1.2], [2.6, 1.2], [1.0, 4.0], [2.6, 4.0], [2.6, 5.3], [4.1, 5.3]]) put('luz-empotrada', lx, ly);
  for (const n of f.furniture.filter((m) => inRoom(m) && m.type === 'mesa-noche')) put('lampara-colgante', n.x + 0.05, n.y);
  put('tira-led-calida', 0.09, 2.6, 270, { width: 2.4, elevation: 2.45 });

  // The open page follows the file: count the saved copy as the file's version, so the new one loads by itself.
  const origin = JSON.parse(await (await fetch(`/api/kv/origen:${ID}`)).text());
  await fetch(`/api/kv/origen:${ID}`, { method: 'PUT', body: JSON.stringify({ ...origin, projectHash: before }) });
  return serializeProject(p);
}, ID);
await browser.close();
writeFileSync(FILE, JSON.stringify(JSON.parse(json), null, 2));
console.log(`Listo: ${FILE}`);
