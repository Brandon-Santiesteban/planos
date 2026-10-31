// Nueva casa — master bedroom, bathroom and walk-in (asked 2026-10-31), on top of the user's own saved version
// (biblioteca/). Fifth layout, the user's sketch:
//   - a private garden 2 m deep across the whole back of the house: the back wall (glass sliding door, the bathroom's
//     high window) moves 1 m in; closed by the house, the lot lines and a 2 m fence on the side strip;
//   - to the right of the TV partition (x 3.51), a compact en-suite bathroom at the back (2.54 × 2.54 m), entered from
//     the walk-in: double basin with mirror facing the door, shower under a high window, WC by the door;
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
  const A = 3.51; // TV partition (from the back wall to y 4.5)
  const R = 6.075; // inner face of the right outer wall
  const G = 1.0; // the house's back wall, moved in so the garden behind it is 2 m deep (to the lot line at −1.025)
  const Y = G + 2.64; // wall between the bathroom (behind) and the walk-in (in front)

  // Private garden across the whole back of the house: the back wall (glass sliding door, the bathroom's high window)
  // moves 1 m in. The garden is closed by the house, the lot lines and a 2 m fence on the side strip.
  const atBack = (w) => Math.abs(w.a.y - w.b.y) < 0.01 && w.a.y > -0.01 && w.a.y < G + 0.01 && !w.kind;
  const glass = f.openings.find((o) => o.glass && f.walls.some((w) => w.id === o.wallId && atBack(w)));
  const glassX = glass ? (() => { const w = f.walls.find((x) => x.id === glass.wallId); return Math.min(w.a.x, w.b.x) + glass.offset; })() : 1.72;
  const stub = (w) => !w.kind && Math.abs(w.a.x - A) < 0.01 && Math.abs(w.b.x - A) < 0.01 && Math.max(w.a.y, w.b.y) <= G + 0.01;
  for (const w of f.walls.filter((w) => atBack(w) || stub(w))) ops.deleteWall(p, f.id, w.id);
  for (const x of [0, 6.15]) {
    const side = f.walls.find((w) => Math.abs(w.a.x - x) < 0.01 && Math.abs(w.b.x - x) < 0.01 && Math.min(w.a.y, w.b.y) < G + 0.01 && Math.max(w.a.y, w.b.y) > 6);
    if (!side) throw new Error('No encontré un muro lateral del dormitorio');
    if (side.a.y < side.b.y) side.a = { x, y: G };
    else side.b = { x, y: G };
  }
  const backWall = ops.addWall(p, f.id, { x: 0, y: G }, { x: 6.15, y: G }, 0.15);
  const glassDoor = ops.addOpening(p, f.id, backWall, 'door', glassX);
  if (!glassDoor) throw new Error('La puerta de vidrio no cupo');
  ops.updateOpening(p, f.id, glassDoor, { width: glass?.width ?? 2.3, height: glass?.height ?? 2.1 });
  ops.setDoorGlass(p, f.id, glassDoor, true);
  // High window in the bathroom's back wall, over the shower: light and air, no view in.
  const win = ops.addOpening(p, f.id, backWall, 'window', 5.475);
  if (win) ops.updateOpening(p, f.id, win, { width: 0.9, height: 0.45, sill: 1.85 });
  const lot = p.site ?? { x: -0.775, y: -1.025, width: 7 };
  f.rooms = f.rooms.filter((r) => r.name !== 'Jardín privado');
  f.rooms.push({
    id: newId(), name: 'Jardín privado', kind: 'balcony', floorMaterial: 'cesped', railing: 'celosia',
    points: [{ x: -0.075, y: lot.y }, { x: lot.x + lot.width, y: lot.y }, { x: lot.x + lot.width, y: G - 0.075 }, { x: -0.075, y: G - 0.075 }],
  });

  // Walls: the TV partition from the bedroom's back wall, and the bathroom wall across; earlier partitions go.
  const drywall = f.walls.filter((w) => w.kind === 'drywall' && Math.min(w.a.x, w.b.x) > A + 0.1 && Math.max(w.a.x, w.b.x) < 6.15 && Math.max(w.a.y, w.b.y) < 6.15);
  const across = f.walls.filter((w) => w.kind === 'drywall' && Math.abs(w.a.y - w.b.y) < 0.01 && w.a.y > 0.1 && w.a.y < 6 && Math.min(w.a.x, w.b.x) >= A - 0.01);
  for (const w of [...drywall, ...across]) ops.deleteWall(p, f.id, w.id);
  const tvWall = f.walls.find((w) => w.kind === 'drywall' && Math.abs(w.a.x - A) < 0.02 && Math.abs(w.b.x - A) < 0.02);
  if (!tvWall) throw new Error('No encontré el tabique del TV');
  f.openings = f.openings.filter((o) => o.wallId !== tvWall.id); // the bathroom door moves to the walk-in
  if (tvWall.a.y < tvWall.b.y) tvWall.a = { x: A, y: G };
  else tvWall.b = { x: A, y: G };
  // The bathroom door: from the walk-in, opening into the bathroom.
  const bathWall = ops.addWall(p, f.id, { x: A, y: Y }, { x: R, y: Y }, T, 'drywall');
  const bathDoor = ops.addOpening(p, f.id, bathWall, 'door', 4.7 - A);
  if (!bathDoor) throw new Error('La puerta del baño no cupo');
  ops.updateOpening(p, f.id, bathDoor, { width: 0.75 });
  ops.toggleDoorFlip(p, f.id, bathDoor);
  // Rooms: the bedroom, the bathroom behind (ceramic floor) and the walk-in in front (wood), open to the bedroom.
  const bath = { x0: A + T / 2, x1: R, y0: G + 0.075, y1: Y - T / 2 };
  const walk = { x0: A + T / 2, x1: R, y0: Y + T / 2, y1: 6.075 };
  room.points = [{ x: 0.075, y: G + 0.075 }, { x: A - T / 2, y: G + 0.075 }, { x: A - T / 2, y: 6.075 }, { x: 0.075, y: 6.075 }];
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

  // Compact bathroom (2.54 × 2.54 m), entered from the walk-in: double basin with mirror on the back wall across from
  // the door, shower in the back right corner under the high window, WC on the right wall by the door.
  put('lavamanos-doble', 4.2, bath.y0 + 0.25, 0);
  put('espejo', 4.2, bath.y0 + 0.015, 0, { width: 1.2, height: 0.9, elevation: 1.1 });
  put('tira-led-calida', 4.2, bath.y0 + 0.03, 0, { width: 1.1, elevation: 2.05 });
  put('ducha', R - 0.6, bath.y0 + 0.65, 0, { width: 1.2, depth: 1.3 });
  put('sanitario', R - 0.35, bath.y1 - 0.6, 90);
  put('toallero', bath.x0 + 0.06, bath.y0 + 1.5, 270);
  for (const [lx, ly] of [[4.3, bath.y0 + 1.4], [R - 0.6, bath.y0 + 0.65]]) put('luz-empotrada', lx, ly);

  // Walk-in in a C open to the bedroom: a hanging module beside the bathroom door, a row along the right wall, and
  // the chest of drawers with its mirror plus shelves against the front wall.
  const D = 0.55;
  const inner = R - D; // where the right-hand row starts
  put('vestier-colgar', walk.x0 + 0.39, walk.y0 + D / 2, 0, { width: 0.78 });
  let y = walk.y0;
  for (const [type, w] of [['vestier-colgar', 1], ['vestier-cajones', 0.71], ['vestier-zapatos', 0.7]]) {
    put(type, R - D / 2, y + w / 2, 90);
    y += w;
  }
  for (const m of f.furniture.filter((m) => inRoom(m) && m.type === 'comoda-espejo')) {
    Object.assign(m, { rotation: 180, x: walk.x0 + m.width / 2, y: walk.y1 - m.depth / 2 });
  }
  put('vestier-repisas', (walk.x0 + 1.2 + inner) / 2, walk.y1 - D / 2, 180, { width: inner - walk.x0 - 1.2 });
  for (const ly of [walk.y0 + 0.9, walk.y0 + 1.7]) put('luz-empotrada', (walk.x0 + inner) / 2, ly);

  // Bedroom lighting: recessed lights, pendants over the nightstands, warm LED cove over the headboard.
  for (const [lx, ly] of [[1.0, 1.8], [2.6, 1.8], [1.0, 4.0], [2.6, 4.0], [2.6, 5.3]]) put('luz-empotrada', lx, ly);
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
