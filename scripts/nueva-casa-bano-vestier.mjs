// Nueva casa — master bedroom, bathroom and walk-in (asked 2026-10-31), on top of the user's own saved version
// (biblioteca/). The house is 5.50 m wide outside (the user's buildable width; narrowed once from 6.30 m).
// Layout, the user's sketches:
//   - a private garden 2 m deep across the whole back of the house: the back wall (glass sliding door, the bathroom's
//     high window) moves 1 m in; closed by the house, the lot lines and a 2 m fence on the side strip;
//   - to the right of the TV partition (x 3.51), a compact en-suite bathroom at the back (2.54 × 2.54 m), entered from
//     the walk-in: WC on the left wall hidden by the open door, double basin with mirror on the right wall, shower
//     under a high window;
//   - the walk-in in front of it, entered from the bedroom at its top left, modules in a C (left wall, right wall,
//     front wall beside the user's mirror);
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
  const G = 1.0; // the house's back wall, moved in so the garden behind it is 2 m deep (to the lot line at −1.025)
  const Y = G + 2.64; // wall between the bathroom (behind) and the walk-in (in front)
  const XR = 5.35; // right outer wall (centre line): the house is 5.50 m wide outside, the user's buildable width
  const R = XR - 0.075; // its inner face
  const A = 3.21; // TV partition: bedroom to its left, bathroom and walk-in to its right

  // The house narrows from 6.30 to 5.50 m outside (once): everything right of x 3 moves 0.8 m left; in the master
  // suite the bedroom gives 0.3 m (past the foot of the bed) and the bathroom and walk-in 0.5 m.
  const wide = f.walls.some((w) => Math.abs(w.a.x - 6.15) < 0.02 || Math.abs(w.b.x - 6.15) < 0.02);
  if (wide) {
    const mapX = (x, y) => (y <= 6.2 ? (x < 2.6 ? x : x < 4.0 ? x - 0.3 : x - 0.8) : x < 3.0 ? x : x - 0.8);
    const at = (q, y = q.y) => ({ x: Math.round(mapX(q.x, y) * 1000) / 1000, y: q.y });
    // Doors and windows keep their place in the wall: work out where they are before the walls change.
    const centres = new Map(f.openings.map((o) => {
      const w = f.walls.find((x) => x.id === o.wallId);
      const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) || 1;
      const c = { x: w.a.x + ((w.b.x - w.a.x) * o.offset) / len, y: w.a.y + ((w.b.y - w.a.y) * o.offset) / len };
      return [o.id, at(c)];
    }));
    for (const w of f.walls) {
      // A wall along y = 6.15 belongs to both bands: map it with the band of its other end.
      const band = Math.max(w.a.y, w.b.y) > 6.2 && Math.min(w.a.y, w.b.y) < 6.2 ? null : (w.a.y + w.b.y) / 2;
      w.a = at(w.a, band ?? w.a.y);
      w.b = at(w.b, band ?? w.b.y);
    }
    for (const o of f.openings) {
      const w = f.walls.find((x) => x.id === o.wallId);
      const c = centres.get(o.id);
      o.offset = Math.round(Math.hypot(c.x - w.a.x, c.y - w.a.y) * 1000) / 1000;
    }
    for (const r of f.rooms) {
      const cy = r.points.reduce((t, q) => t + q.y, 0) / r.points.length;
      r.points = r.points.map((q) => at(q, cy <= 6.2 ? Math.min(q.y, 6.2) : Math.max(q.y, 6.21)));
    }
    for (const m of f.furniture) Object.assign(m, at(m));
    // The user's full-length mirror stays on the walk-in's front wall, where it was from its left end.
    for (const m of f.furniture.filter((m) => m.type === 'espejo-cuerpo' && m.y > Y && m.y < 6.15)) m.x = A + T / 2 + 0.575;
  }

  // Private garden across the whole back of the house: the back wall (glass sliding door, the bathroom's high window)
  // moves 1 m in. The garden is closed by the house, the lot lines and a 2 m fence on the sides.
  const atBack = (w) => Math.abs(w.a.y - w.b.y) < 0.01 && w.a.y > -0.01 && w.a.y < G + 0.01 && !w.kind;
  const glass = f.openings.find((o) => o.glass && f.walls.some((w) => w.id === o.wallId && atBack(w)));
  const glassX = glass ? (() => { const w = f.walls.find((x) => x.id === glass.wallId); return Math.min(w.a.x, w.b.x) + glass.offset; })() : 1.72;
  for (const w of f.walls.filter(atBack)) ops.deleteWall(p, f.id, w.id);
  for (const x of [0, XR]) {
    const side = f.walls.find((w) => Math.abs(w.a.x - x) < 0.01 && Math.abs(w.b.x - x) < 0.01 && Math.min(w.a.y, w.b.y) < G + 0.01 && Math.max(w.a.y, w.b.y) > 6);
    if (!side) throw new Error('No encontré un muro lateral del dormitorio');
    if (side.a.y < side.b.y) side.a = { x, y: G };
    else side.b = { x, y: G };
  }
  const backWall = ops.addWall(p, f.id, { x: 0, y: G }, { x: XR, y: G }, 0.15);
  const glassDoor = ops.addOpening(p, f.id, backWall, 'door', glassX);
  if (!glassDoor) throw new Error('La puerta de vidrio no cupo');
  ops.updateOpening(p, f.id, glassDoor, { width: glass?.width ?? 2.3, height: glass?.height ?? 2.1 });
  ops.setDoorGlass(p, f.id, glassDoor, true);
  const lot = p.site ?? { x: -0.775, y: -1.025, width: 7 };
  // A wooden deck along the house (1 m) and the lawn to the back fence, as wide as the house; no fence between them.
  const gx0 = -0.075;
  const gx1 = XR + 0.075;
  const deckY = G - 1.075;
  f.rooms = f.rooms.filter((r) => r.name !== 'Jardín privado' && r.name !== 'Deck del jardín');
  f.rooms.push({
    id: newId(), name: 'Jardín privado', kind: 'balcony', floorMaterial: 'cesped', railing: 'celosia', openEdges: [2],
    points: [{ x: gx0, y: lot.y }, { x: gx1, y: lot.y }, { x: gx1, y: deckY }, { x: gx0, y: deckY }],
  });
  f.rooms.push({
    id: newId(), name: 'Deck del jardín', kind: 'balcony', floorMaterial: 'madera', railing: 'celosia', openEdges: [0],
    points: [{ x: gx0, y: deckY }, { x: gx1, y: deckY }, { x: gx1, y: G - 0.075 }, { x: gx0, y: G - 0.075 }],
  });

  // Walls right of the TV partition: only the bathroom wall across and the walk-in's side wall; earlier ones go.
  const drywall = f.walls.filter((w) => w.kind === 'drywall' && Math.max(w.a.y, w.b.y) < 6.15 && (Math.min(w.a.x, w.b.x) > A + 0.1 || (Math.abs(w.a.x - A) < 0.02 && Math.abs(w.b.x - A) < 0.02 && Math.min(w.a.y, w.b.y) > Y - 0.01)));
  const across = f.walls.filter((w) => w.kind === 'drywall' && Math.abs(w.a.y - w.b.y) < 0.01 && w.a.y > 0.1 && w.a.y < 6 && Math.min(w.a.x, w.b.x) >= A - 0.01);
  for (const w of [...drywall, ...across]) ops.deleteWall(p, f.id, w.id);
  const tvWall = f.walls.find((w) => w.kind === 'drywall' && Math.abs(w.a.x - A) < 0.02 && Math.abs(w.b.x - A) < 0.02);
  if (!tvWall) throw new Error('No encontré el tabique del TV');
  f.openings = f.openings.filter((o) => o.wallId !== tvWall.id);
  // The TV partition runs from the back wall to the bathroom wall; the walk-in's entrance is next (0.8 m, the user's
  // mark), then its side wall to the front wall closes it from the bedroom.
  tvWall.a = { x: A, y: G };
  tvWall.b = { x: A, y: Y };
  const entrance = 0.8;
  ops.addWall(p, f.id, { x: A, y: Y + T / 2 + entrance }, { x: A, y: 6.075 }, T, 'drywall');
  // The bathroom door: from the walk-in, hinged on the left and opening in, so its leaf hides the WC from the doorway.
  const bathWall = ops.addWall(p, f.id, { x: A, y: Y }, { x: R, y: Y }, T, 'drywall');
  const bath = { x0: A + T / 2, x1: R, y0: G + 0.075, y1: Y - T / 2 };
  const doorW = 0.7;
  const bathDoor = ops.addOpening(p, f.id, bathWall, 'door', bath.x0 + 0.75 + doorW / 2 - A);
  if (!bathDoor) throw new Error('La puerta del baño no cupo');
  ops.updateOpening(p, f.id, bathDoor, { width: doorW });
  ops.toggleDoorFlip(p, f.id, bathDoor);
  // Rooms: the bedroom, the bathroom behind (ceramic floor) and the walk-in in front (wood).
  const walk = { x0: A + T / 2, x1: R, y0: Y + T / 2, y1: 6.075 };
  room.points = [{ x: 0.075, y: G + 0.075 }, { x: A - T / 2, y: G + 0.075 }, { x: A - T / 2, y: 6.075 }, { x: 0.075, y: 6.075 }];
  const rect = (b) => [{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }];
  f.rooms = f.rooms.filter((x) => x.name !== 'Baño principal' && x.name !== 'Vestier');
  f.rooms.push({ id: newId(), name: 'Baño principal', kind: 'room', floorMaterial: 'ceramica', points: rect(bath) });
  f.rooms.push({ id: newId(), name: 'Vestier', kind: 'room', floorMaterial: 'madera', points: rect(walk) });

  // Start this part again every run: dressing modules, bathroom pieces and light fittings in the suite.
  const inRoom = (m) => m.x > 0 && m.x < XR && m.y > G && m.y < 6.15;
  const redo = new Set(['vestier-colgar', 'vestier-cajones', 'vestier-repisas', 'vestier-zapatos', 'ducha', 'lavamanos-doble', 'espejo', 'sanitario', 'toallero',
    'luz-empotrada', 'lampara-colgante', 'aplique-pared', 'tira-led-calida']);
  f.furniture = f.furniture.filter((m) => !(inRoom(m) && redo.has(m.type)));
  const put = (type, x, y, rotation = 0, extra = {}) => fo.addFurniture(p, f.id, { ...fo.furnitureFromCatalog(type, { x, y }, rotation), ...extra });

  // Bathroom (2.04 × 2.54 m): WC on the left wall behind the open door, double basin with mirror on the right wall,
  // shower along the back wall under the high window.
  put('sanitario', bath.x0 + 0.35, bath.y1 - 0.6, 270);
  put('lavamanos-doble', R - 0.25, bath.y1 - 0.62, 90);
  put('espejo', R - 0.015, bath.y1 - 0.62, 90, { width: 1.2, height: 0.9, elevation: 1.1 });
  put('tira-led-calida', R - 0.03, bath.y1 - 0.62, 90, { width: 1.1, elevation: 2.05 });
  const showerX0 = bath.x0 + 0.465;
  const showerX = (showerX0 + R) / 2;
  put('ducha', showerX, bath.y0 + 0.65, 0, { width: R - showerX0, depth: 1.3 });
  put('toallero', bath.x0 + 0.06, bath.y0 + 0.9, 270);
  for (const [lx, ly] of [[showerX, bath.y0 + 0.65], [bath.x0 + 0.9, bath.y1 - 0.6], [R - 0.7, bath.y1 - 0.62]]) put('luz-empotrada', lx, ly);
  const win = ops.addOpening(p, f.id, backWall, 'window', showerX);
  if (win) ops.updateOpening(p, f.id, win, { width: 0.9, height: 0.45, sill: 1.85 });

  // Walk-in in a C (the user's sketch), entered at its top left: a hanging module on the left wall below the entrance,
  // a row along the right wall, and shelves on the front wall beside the user's mirror.
  const D = 0.55;
  const inner = R - D; // where the right-hand row starts
  const leftTop = Y + T / 2 + entrance + T / 2;
  put('vestier-colgar', walk.x0 + D / 2, leftTop + 0.5, 270, { width: 1.0 });
  let y = walk.y0;
  for (const [type, w] of [['vestier-colgar', 1], ['vestier-cajones', 0.71], ['vestier-zapatos', 0.7]]) {
    put(type, R - D / 2, y + w / 2, 90);
    y += w;
  }
  const shelvesX0 = walk.x0 + 0.9;
  put('vestier-repisas', (shelvesX0 + inner) / 2, walk.y1 - D / 2, 180, { width: inner - shelvesX0 });
  for (const ly of [walk.y0 + 0.9, walk.y0 + 1.7]) put('luz-empotrada', (walk.x0 + D + inner) / 2, ly);

  // Garden decoration (the user's reference photo): planters and a small tree on the lawn, a vertical garden on the
  // side fence, two wicker armchairs and a low table on the deck behind the bathroom (the glass door stays clear),
  // pots beside the door and warm sconces on the house wall.
  const inGarden = (m) => m.y < G - 0.075 && m.y > lot.y && m.x > gx0 - 0.1 && m.x < lot.x + lot.width + 0.1;
  f.furniture = f.furniture.filter((m) => !inGarden(m));
  put('jardinera', 1.0, lot.y + 0.2, 0, { color: '#d8d2c8' });
  put('jardinera', 2.85, lot.y + 0.2, 0, { color: '#d8d2c8' });
  put('arbol-pequeno', gx1 - 0.75, lot.y + 0.5, 0, { width: 1.4, depth: 1.4, height: 3.0 });
  put('arbusto', 4.0, lot.y + 0.35, 0, { width: 0.7, depth: 0.7, height: 0.8 });
  put('jardin-vertical', gx0 + 0.06, -0.1, 270, { width: 1.6 });
  const chairs = [A + 0.45, XR - 0.45];
  for (const cx of chairs) put('sillon-exterior', cx, G - 0.5, 180, { color: '#b5895a' });
  const tableX = (chairs[0] + chairs[1]) / 2;
  put('mesa-centro', tableX, G - 0.55, 0, { width: 0.45, depth: 0.45, height: 0.45, color: '#c9c3b8' });
  put('matera-alta', 0.22, G - 0.32, 0, { color: '#e8e4dc' });
  put('matera', A - 0.12, G - 0.32, 0, { color: '#e8e4dc' });
  for (const lx of [0.3, A - 0.35, tableX]) put('aplique-pared', lx, G - 0.075 - 0.07, 180, { elevation: 1.9 });

  // Bedroom lighting: recessed lights, pendants over the nightstands, warm LED cove over the headboard.
  for (const [lx, ly] of [[1.0, 1.8], [2.4, 1.8], [1.0, 4.0], [2.4, 4.0], [2.4, 5.3]]) put('luz-empotrada', lx, ly);
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
