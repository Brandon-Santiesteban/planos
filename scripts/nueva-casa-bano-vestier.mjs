// Nueva casa — master bedroom, bathroom and walk-in (asked 2026-10-31), on top of the user's own saved version
// (biblioteca/). Fifth layout, the user's sketch:
//   - a private garden 2 m deep behind the bedroom: its back wall with the glass sliding door moves 1 m in, closed by
//     the bathroom, the lot lines and a 2 m fence;
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
  const A = 3.51; // TV partition (from the bedroom's back wall to y 4.5)
  const Y = 2.64; // wall between the bathroom (behind) and the walk-in (in front)
  const R = 6.075; // inner face of the right outer wall
  const G = 1.0; // the bedroom's back wall, moved in so the garden behind it is 2 m deep (to the lot line at −1.025)

  // Private garden behind the bedroom: the bedroom's back wall (with the glass sliding door) moves 1 m in; the
  // bathroom keeps the old back line, so the garden is closed by the bathroom, the lot lines and a 2 m fence.
  if (!f.rooms.some((r) => r.name === 'Jardín privado')) {
    const back = f.walls.find((w) => Math.abs(w.a.y) < 0.01 && Math.abs(w.b.y) < 0.01 && Math.min(w.a.x, w.b.x) < 0.01 && Math.max(w.a.x, w.b.x) > 6.1);
    const left = f.walls.find((w) => Math.abs(w.a.x) < 0.01 && Math.abs(w.b.x) < 0.01 && Math.min(w.a.y, w.b.y) < 0.01 && Math.max(w.a.y, w.b.y) > 6);
    if (!back || !left) throw new Error('No encontré los muros de atrás del dormitorio');
    const glass = f.openings.find((o) => o.wallId === back.id && o.glass);
    ops.deleteWall(p, f.id, back.id);
    if (left.a.y < left.b.y) left.a = { x: 0, y: G };
    else left.b = { x: 0, y: G };
    const bedBack = ops.addWall(p, f.id, { x: 0, y: G }, { x: A, y: G }, 0.15);
    const door = ops.addOpening(p, f.id, bedBack, 'door', glass?.offset ?? 1.72);
    if (!door) throw new Error('La puerta de vidrio no cupo');
    ops.updateOpening(p, f.id, door, { width: glass?.width ?? 2.3, height: glass?.height ?? 2.1 });
    ops.setDoorGlass(p, f.id, door, true);
    ops.addWall(p, f.id, { x: A, y: 0 }, { x: A, y: G }, 0.15);
    ops.addWall(p, f.id, { x: A, y: 0 }, { x: 6.15, y: 0 }, 0.15);
    const lot = p.site ?? { x: -0.775, y: -1.025 };
    // A point on the edge along the bedroom wall where the house ends, so only the bit past it gets a fence.
    f.rooms.push({
      id: newId(), name: 'Jardín privado', kind: 'balcony', floorMaterial: 'cesped', railing: 'celosia',
      points: [
        { x: lot.x, y: lot.y }, { x: A - 0.075, y: lot.y }, { x: A - 0.075, y: G - 0.075 }, { x: -0.075, y: G - 0.075 }, { x: lot.x, y: G - 0.075 },
      ],
    });
  }

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
  // High window in the bathroom's back wall, over the shower: light and air, no view in.
  const bathBack = f.walls.find((w) => Math.abs(w.a.y) < 0.01 && Math.abs(w.b.y) < 0.01 && Math.min(w.a.x, w.b.x) > A - 0.01);
  if (bathBack) {
    f.openings = f.openings.filter((o) => o.wallId !== bathBack.id);
    const win = ops.addOpening(p, f.id, bathBack.id, 'window', 5.475 - Math.min(bathBack.a.x, bathBack.b.x));
    if (win) ops.updateOpening(p, f.id, win, { width: 0.9, height: 0.45, sill: 1.85 });
  }

  // Rooms: the bedroom, the bathroom behind (ceramic floor) and the walk-in in front (wood), open to the bedroom.
  const bath = { x0: A + T / 2, x1: R, y0: 0.075, y1: Y - T / 2 };
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
  put('sanitario', R - 0.35, 2.0, 90);
  put('toallero', bath.x0 + 0.06, 1.6, 270);
  for (const [lx, ly] of [[4.3, 1.5], [R - 0.6, bath.y0 + 0.65]]) put('luz-empotrada', lx, ly);

  // Walk-in in a C open to the bedroom: a hanging module beside the bathroom door, a row along the right wall, and
  // the chest of drawers with its mirror plus shelves against the front wall.
  const D = 0.55;
  const inner = R - D; // where the right-hand row starts
  put('vestier-colgar', walk.x0 + 0.39, walk.y0 + D / 2, 0, { width: 0.78 });
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
