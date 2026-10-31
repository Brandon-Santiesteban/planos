// Nueva casa — master bedroom, second pass (asked 2026-10-31), on top of the user's own saved version (biblioteca/):
//   - walk-in dressing room between the two drywall partitions (modules along the bathroom wall);
//   - en-suite bathroom on the right-hand strip: one straight drywall wall with its door where the gap was, rain
//     shower at the back, double basin with mirror facing the door, WC by the entrance against the front wall;
//   - lighting: recessed ceiling lights, pendants over the nightstands, a warm LED cove over the headboard, lights in
//     the dressing room and the bathroom, sconces beside the bathroom mirror.
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

  // One straight bathroom wall at x 4.735 instead of the two partitions with a gap; the door goes in the gap.
  const near = (w, x) => Math.abs(w.a.x - x) < 0.06 && Math.abs(w.b.x - x) < 0.06 && w.kind === 'drywall';
  for (const w of f.walls.filter((w) => near(w, 4.735))) ops.deleteWall(p, f.id, w.id);
  const X = 4.735;
  const bathWall = ops.addWall(p, f.id, { x: X, y: 0.075 }, { x: X, y: 6.075 }, 0.05, 'drywall');
  const door = ops.addOpening(p, f.id, bathWall, 'door', 4.425 - 0.075);
  if (!door) throw new Error('La puerta del baño no cupo');
  ops.toggleDoorFlip(p, f.id, door); // it opens into the bathroom, not into the dressing room

  // Rooms: the bedroom up to the bathroom wall, and the bathroom with a ceramic floor.
  const face = X - 0.025;
  room.points = [{ x: 0.075, y: 0.075 }, { x: face, y: 0.075 }, { x: face, y: 6.075 }, { x: 0.075, y: 6.075 }];
  f.rooms = f.rooms.filter((x) => x.name !== 'Baño principal');
  const bath = { x0: Math.round((X + 0.025) * 1000) / 1000, x1: 6.075, y0: 0.075, y1: 6.075 };
  f.rooms.push({
    id: newId(), name: 'Baño principal', kind: 'room', floorMaterial: 'ceramica',
    points: [{ x: bath.x0, y: bath.y0 }, { x: bath.x1, y: bath.y0 }, { x: bath.x1, y: bath.y1 }, { x: bath.x0, y: bath.y1 }],
  });

  // Start this pass again every run: dressing modules, bathroom pieces and light fittings in the room.
  const inRoom = (m) => m.x > 0 && m.x < 6.15 && m.y > 0 && m.y < 6.15;
  const redo = new Set(['vestier-colgar', 'vestier-cajones', 'vestier-repisas', 'vestier-zapatos', 'ducha', 'lavamanos-doble', 'espejo', 'sanitario', 'toallero',
    'luz-empotrada', 'lampara-colgante', 'aplique-pared', 'tira-led-calida']);
  f.furniture = f.furniture.filter((m) => !(inRoom(m) && redo.has(m.type)));
  const put = (type, x, y, rotation = 0, extra = {}) => fo.addFurniture(p, f.id, { ...fo.furnitureFromCatalog(type, { x, y }, rotation), ...extra });

  // Dressing room: modules against the bathroom wall, fronts to the passage (0.62 m) by the TV wall.
  let y = 0.075;
  for (const [type, w] of [['vestier-colgar', 1], ['vestier-colgar', 1], ['vestier-cajones', 1], ['vestier-zapatos', 0.7]]) {
    put(type, face - 0.275, y + w / 2, 90);
    y += w;
  }
  // The chest of drawers against the bathroom wall, square.
  for (const m of f.furniture.filter((m) => inRoom(m) && m.type === 'comoda-espejo')) Object.assign(m, { rotation: 90, x: face - m.depth / 2 });

  // Bathroom.
  const cx = (bath.x0 + bath.x1) / 2;
  put('ducha', cx, bath.y0 + 0.6, 0, { width: bath.x1 - bath.x0 - 0.02, depth: 1.2 });
  put('toallero', bath.x0 + 0.06, 1.65, 270);
  put('lavamanos-doble', bath.x1 - 0.25, 4.43, 90);
  put('espejo', bath.x1 - 0.015, 4.43, 90, { width: 1.2, height: 0.9, elevation: 1.1 });
  put('aplique-pared', bath.x1 - 0.07, 3.7, 90, { elevation: 1.45 });
  put('aplique-pared', bath.x1 - 0.07, 5.16, 90, { elevation: 1.45 });
  put('sanitario', 5.35, bath.y1 - 0.35, 180);
  for (const ly of [0.675, 2.5, 4.43]) put('luz-empotrada', cx - 0.1, ly);

  // Bedroom lighting: recessed lights, pendants over the nightstands, warm LED cove over the headboard.
  for (const [lx, ly] of [[1.0, 1.2], [2.6, 1.2], [1.0, 4.0], [2.6, 4.0], [2.6, 5.3]]) put('luz-empotrada', lx, ly);
  for (const n of f.furniture.filter((m) => inRoom(m) && m.type === 'mesa-noche')) put('lampara-colgante', n.x + 0.05, n.y);
  put('tira-led-calida', 0.09, 2.6, 270, { width: 2.4, elevation: 2.45 });
  // Dressing room.
  for (const ly of [0.8, 2.0, 3.2]) put('luz-empotrada', 3.85, ly);

  // The open page follows the file: count the saved copy as the file's version, so the new one loads by itself.
  const origin = JSON.parse(await (await fetch(`/api/kv/origen:${ID}`)).text());
  await fetch(`/api/kv/origen:${ID}`, { method: 'PUT', body: JSON.stringify({ ...origin, projectHash: before }) });
  return serializeProject(p);
}, ID);
await browser.close();
writeFileSync(FILE, JSON.stringify(JSON.parse(json), null, 2));
console.log(`Listo: ${FILE}`);
