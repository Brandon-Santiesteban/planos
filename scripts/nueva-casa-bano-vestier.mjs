// Nueva casa — master bedroom, bathroom and walk-in (asked 2026-10-31), on top of the user's own saved version
// (biblioteca/). Fourth layout, the user's sketch: to the right of the TV partition (x 3.51),
//   - a compact en-suite bathroom at the back (2.54 × 2.54 m), door from the bedroom in the TV partition: WC by the
//     door, double basin with mirror facing it, shower in the corner;
//   - the walk-in in front of it, modules in a C (against the bathroom wall, the right wall and the front wall with the
//     chest of drawers and its mirror), open to the bedroom past the end of the TV partition;
//   - lighting: recessed ceiling lights, pendants over the nightstands, a warm LED cove over the headboard, lights in
//     the bathroom and the dressing room, sconces beside the bathroom mirror.
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
  const A = 3.51; // TV partition (kept, from the back wall to y 4.5)
  const Y = 2.64; // wall between the bathroom (behind) and the walk-in (in front)
  const R = 6.075; // inner face of the right outer wall

  // Walls: only the TV partition and the bathroom wall across; earlier layouts' partitions go.
  const drywall = f.walls.filter((w) => w.kind === 'drywall' && Math.min(w.a.x, w.b.x) > A + 0.1 && Math.max(w.a.x, w.b.x) < 6.15 && Math.max(w.a.y, w.b.y) < 6.15);
  const across = f.walls.filter((w) => w.kind === 'drywall' && Math.abs(w.a.y - w.b.y) < 0.01 && w.a.y > 0.1 && w.a.y < 6 && Math.min(w.a.x, w.b.x) >= A - 0.01);
  for (const w of [...drywall, ...across]) ops.deleteWall(p, f.id, w.id);
  ops.addWall(p, f.id, { x: A, y: Y }, { x: R, y: Y }, T, 'drywall');
  // The bathroom door: in the TV partition, from the bedroom, clear of the TV furniture; it opens into the bathroom.
  const tvWall = f.walls.find((w) => w.kind === 'drywall' && Math.abs(w.a.x - A) < 0.02 && Math.abs(w.b.x - A) < 0.02);
  if (!tvWall) throw new Error('No encontré el tabique del TV');
  f.openings = f.openings.filter((o) => o.wallId !== tvWall.id);
  const bathDoor = ops.addOpening(p, f.id, tvWall.id, 'door', 0.85 - Math.min(tvWall.a.y, tvWall.b.y));
  if (!bathDoor) throw new Error('La puerta del baño no cupo');
  ops.updateOpening(p, f.id, bathDoor, { width: 0.7 });
  ops.toggleDoorFlip(p, f.id, bathDoor);

  // Rooms: the bedroom, the bathroom behind (ceramic floor) and the walk-in in front (wood), open to the bedroom.
  const bath = { x0: A + T / 2, x1: R, y0: 0.075, y1: Y - T / 2 };
  const walk = { x0: A + T / 2, x1: R, y0: Y + T / 2, y1: 6.075 };
  room.points = [{ x: 0.075, y: 0.075 }, { x: A - T / 2, y: 0.075 }, { x: A - T / 2, y: 6.075 }, { x: 0.075, y: 6.075 }];
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

  // Compact bathroom (2.54 × 2.54 m): WC by the door against the back wall, double basin with mirror on the right
  // wall facing the door, shower in the front right corner.
  put('sanitario', 4.55, bath.y0 + 0.35, 0);
  put('lavamanos-doble', R - 0.25, 0.8, 90);
  put('espejo', R - 0.015, 0.8, 90, { width: 1.2, height: 0.9, elevation: 1.1 });
  put('tira-led-calida', R - 0.03, 0.8, 90, { width: 1.1, elevation: 2.05 });
  put('ducha', R - 0.7, bath.y1 - 0.55, 0, { width: 1.4, depth: 1.1 });
  put('toallero', 4.1, bath.y1 - 0.06, 180);
  for (const [lx, ly] of [[4.5, 1.2], [R - 0.7, bath.y1 - 0.55]]) put('luz-empotrada', lx, ly);

  // Walk-in in a C open to the bedroom: hanging modules against the bathroom wall, a row along the right wall, and
  // the chest of drawers with its mirror plus shelves against the front wall.
  const D = 0.55;
  const inner = R - D; // where the right-hand row starts
  put('vestier-colgar', walk.x0 + 0.5, walk.y0 + D / 2, 0, { width: 0.995 });
  put('vestier-colgar', walk.x0 + 1.495, walk.y0 + D / 2, 0, { width: 0.995 });
  let y = walk.y0;
  for (const [type, w] of [['vestier-colgar', 1], ['vestier-cajones', 1], ['vestier-repisas', 0.7], ['vestier-zapatos', 0.7]]) {
    put(type, R - D / 2, y + w / 2, 90);
    y += w;
  }
  for (const m of f.furniture.filter((m) => inRoom(m) && m.type === 'comoda-espejo')) {
    Object.assign(m, { rotation: 180, x: walk.x0 + m.width / 2, y: walk.y1 - m.depth / 2 });
  }
  put('vestier-repisas', (walk.x0 + 1.2 + inner) / 2, walk.y1 - D / 2, 180, { width: inner - walk.x0 - 1.2 });
  for (const ly of [3.9, 4.9]) put('luz-empotrada', (walk.x0 + inner) / 2, ly);

  // Bedroom lighting: recessed lights, pendants over the nightstands, warm LED cove over the headboard.
  for (const [lx, ly] of [[1.0, 1.2], [2.6, 1.2], [1.0, 4.0], [2.6, 4.0], [2.6, 5.3]]) put('luz-empotrada', lx, ly);
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
