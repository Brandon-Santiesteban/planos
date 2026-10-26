// Stage-1 proposal (front 5,5 × 9 m of a 5,5 × 20 m lot), built with the app's own ops.
import { chromium } from 'file:///D:/Proyectos/setup/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5173');
await page.waitForTimeout(800);

const json = await page.evaluate(async () => {
  const ops = await import('/src/model/ops.ts');
  const { createEmptyProject } = await import('/src/model/defaults.ts');
  const { serializeProject, parseProject } = await import('/src/persistence/projectFile.ts');
  // Designed with the street at y = 0; turned 180° so the front (facing south) sits at the bottom with north up.
  // ...and mirrored left↔right (a power pole stands on the other side of the front).
  const P = (x, y) => ({ x: Math.round(x * 1e6) / 1e6 + 0, y: Math.round((9 - y) * 1e6) / 1e6 + 0 });
  const p = createEmptyProject('Casa etapa 1');
  const lengths = {};
  const wall = (f, a, b, t) => {
    const id = ops.addWall(p, f, P(b.x, b.y), P(a.x, a.y), t);
    lengths[id] = Math.hypot(b.x - a.x, b.y - a.y);
    return id;
  };
  const Q = (x, y) => ({ x, y });

  const shell = (f) => ({
    front: wall(f, Q(0, 0), Q(5.5, 0), 0.2),
    right: wall(f, Q(5.5, 0), Q(5.5, 9), 0.2),
    back: wall(f, Q(5.5, 9), Q(0, 9), 0.2), // runs right → left: offset = 5,5 − x
    left: wall(f, Q(0, 9), Q(0, 0), 0.2),
  });
  const opening = (f, kind, wallId, offset, patch = {}) => {
    const id = ops.addOpening(p, f, wallId, kind, lengths[wallId] - offset);
    if (!id) throw new Error(`no cabe ${kind} en ${offset}`);
    if (Object.keys(patch).length && !ops.updateOpening(p, f, id, { ...patch, offset: lengths[wallId] - offset })) throw new Error(`medidas de ${kind} en ${offset}`);
    return id;
  };
  const room = (f, pts, name, kind) => {
    const id = ops.addRoom(p, f, pts, name);
    if (kind) ops.setRoomKind(p, f, id, kind);
  };
  const rect = (x0, y0, x1, y1) => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];

  // ---------- Primer piso ----------
  const g = p.floors[0].id;
  ops.renameFloor(p, g, 'Primer piso');
  const G = shell(g);
  G.parkingSide = wall(g, Q(3.3, 0), Q(3.3, 5)); // parqueadero | escalera + entrada
  G.parkingBack = wall(g, Q(0, 5), Q(3.3, 5)); // parqueadero | cocina y sala
  opening(g, 'window', G.parkingBack, 1.0, { width: 1.0, sill: 1.0, height: 1.0 }); // cocina ↔ parqueadero: ventilación
  opening(g, 'door', G.front, 1.65, { width: 2.6 }); // puerta del garaje
  // Stair window: one tall strip from 0,90 m on this floor up through the next floor.
  opening(g, 'window', G.front, 4.4, { width: 1.2, sill: 0.9, height: 1.7 });
  opening(g, 'door', G.parkingSide, 4.0, { width: 0.8 }); // parqueadero → entrada
  // Back: the kitchen window is gone (existing room 1 is behind it); the dining room opens to the patio.
  opening(g, 'door', G.back, 5.5 - 4.25, { width: 1.6 }); // comedor → patio (puerta-ventana corrediza)
  room(g, rect(0, 0, 3.3, 5), 'Parqueadero');
  room(g, rect(3.3, 0, 5.5, 3), 'Escalera');
  room(g, rect(3.3, 3, 5.5, 5), 'Entrada');
  room(g, rect(0, 5, 2, 9), 'Cocina');
  room(g, rect(2, 5, 5.5, 7), 'Sala');
  room(g, rect(2, 7, 5.5, 9), 'Comedor');
  // Front garden under the balcony, fenced: drawn as a 'balcony' so the app puts a railing on its open sides.
  // The whole ground-floor front is closed by a privacy fence that lets air through (celosía).
  // Front garden fenced with a celosía towards the street and the neighbour; open towards the driveway (edge 3).
  const garden = ops.addRoom(p, g, rect(3.3, -1.2, 5.5, 0), 'Antejardín enrejado');
  ops.setRoomKind(p, g, garden, 'balcony');
  Object.assign(p.floors.find((fl) => fl.id === g).rooms.find((x) => x.id === garden), { railing: 'celosia', openEdges: [3] });
  // Driveway: open ground; the sliding gate runs behind the garden fence, so the car can get out.
  const drive = ops.addRoom(p, g, rect(0, -1.2, 3.3, 0), 'Acceso vehicular (portón corredizo)');
  ops.setRoomKind(p, g, drive, 'exterior');
  p.floors.find((fl) => fl.id === g).rooms.find((x) => x.id === drive).floorMaterial = 'concreto';

  // ---------- Construcción existente detrás (solo primer piso) ----------
  const E = {
    left: wall(g, Q(0, 9), Q(0, 15)),
    right: wall(g, Q(5.5, 9), Q(5.5, 15)), // medianera del patio
    room1Side: wall(g, Q(3, 9), Q(3, 12)), // habitación 1 | patio
    between: wall(g, Q(0, 12), Q(3, 12)), // habitación 1 | habitación 2
    room2Step: wall(g, Q(3, 12), Q(4, 12)), // patio | habitación 2 (el metro que sobresale)
    room2Side: wall(g, Q(4, 12), Q(4, 15)), // habitación 2 | patio
    room2Back: wall(g, Q(0, 15), Q(5.5, 15)), // habitaciones y patio | pasillo
  };
  opening(g, 'door', E.room1Side, 1.5, { width: 0.8 }); // patio → habitación 1
  opening(g, 'door', E.room2Step, 0.5, { width: 0.8 }); // patio → habitación 2
  opening(g, 'door', E.room2Back, 4.75, { width: 0.8 }); // patio → pasillo (x = 4,75, inside the patio)
  room(g, rect(0, 9, 3, 12), 'Habitación 1 (existente)');
  room(g, rect(0, 12, 4, 15), 'Habitación 2 (existente)');
  room(g, [Q(3, 9), Q(5.5, 9), Q(5.5, 15), Q(4, 15), Q(4, 12), Q(3, 12)].map((q) => P(q.x, q.y)), 'Patio');
  // Patio roof: raised 50 cm over the walls so air comes in all around.
  const patioRoof = ops.addRoom(p, g, [Q(3, 9), Q(5.5, 9), Q(5.5, 15), Q(4, 15), Q(4, 12), Q(3, 12)].map((q) => P(q.x, q.y)), 'Techo del patio');
  ops.setRoomKind(p, g, patioRoof, 'roof');
  ops.setRoofHeight(p, g, patioRoof, 3.1);
  // The existing rooms keep their normal roof at wall height (it drains towards the patio gutters).
  for (const [pts, name] of [[rect(0, 9, 3, 12), 'Techo habitación 1'], [rect(0, 12, 4, 15), 'Techo habitación 2'], [rect(0, 15, 5.5, 16), 'Techo pasillo']]) {
    const id = ops.addRoom(p, g, pts, name);
    ops.setRoomKind(p, g, id, 'roof');
    ops.setRoofHeight(p, g, id, 2.6);
  }

  // Fondo existente: pasillo, lavadero y baño en fila, zona de aseo con la escalera al cuarto de arriba.
  const B = {
    left: wall(g, Q(0, 15), Q(0, 20)),
    right: wall(g, Q(5.5, 15), Q(5.5, 20)),
    back: wall(g, Q(5.5, 20), Q(0, 20), 0.2),
    row: wall(g, Q(2, 16), Q(2, 20)), // lavadero y baño | zona de aseo
    bath: wall(g, Q(0, 18), Q(2, 18)), // lavadero | baño
  };
  opening(g, 'door', B.row, 3, { width: 0.7 }); // zona de aseo → baño
  room(g, rect(0, 15, 5.5, 16), 'Pasillo (existente)');
  room(g, rect(0, 16, 2, 18), 'Lavadero');
  room(g, rect(0, 18, 2, 20), 'Baño (existente)');
  room(g, rect(2, 16, 4.5, 20), 'Zona de aseo');
  room(g, rect(4.5, 16, 5.5, 20), 'Escalera al cuarto');

  // ---------- Segundo piso ----------
  const u = ops.addFloor(p);
  ops.renameFloor(p, u, 'Segundo piso');
  const U = shell(u);
  U.bedSide = wall(u, Q(3.3, 0), Q(3.3, 4.2)); // habitación | escalera + pasillo
  U.bedBack = wall(u, Q(0, 4.2), Q(3.3, 4.2)); // habitación | vestier y salita
  U.core = wall(u, Q(2.6, 4.2), Q(2.6, 9)); // vestier y baño | salita y oficina
  U.bathTop = wall(u, Q(0, 6.2), Q(2.6, 6.2)); // vestier | baño
  U.office = wall(u, Q(2.6, 6.4), Q(5.5, 6.4)); // salita | oficina
  const balconyDoor = opening(u, 'door', U.front, 1.65, { width: 1.6 }); // habitación → balcón
  ops.setDoorGlass(p, u, balconyDoor, true); // puerta corrediza de vidrio
  opening(u, 'window', U.front, 4.4, { width: 1.2, sill: 0, height: 2.6 }); // continúa la ventana de la escalera
  opening(u, 'door', U.bedSide, 3.6, { width: 0.8 }); // pasillo → habitación
  opening(u, 'door', U.bedBack, 1.3, { width: 0.8 }); // habitación → vestier
  opening(u, 'door', U.bathTop, 1.3, { width: 0.8 }); // vestier → baño
  opening(u, 'door', U.office, 2.4, { width: 0.8 }); // salita → oficina (al lado del escritorio: no sale en cámara)
  opening(u, 'window', U.back, 5.5 - 1.3, { width: 0.6, sill: 1.5, height: 0.6 }); // baño, ventana alta
  opening(u, 'window', U.back, 5.5 - 4.0, { width: 1.4 }); // oficina, luz de lado
  room(u, rect(0, 0, 3.3, 4.2), 'Habitación principal');
  room(u, rect(3.3, 0, 5.5, 3), 'Escalera');
  room(u, rect(3.3, 3, 5.5, 4.2), 'Pasillo');
  room(u, rect(0, 4.2, 2.6, 6.2), 'Vestier');
  room(u, rect(0, 6.2, 2.6, 9), 'Baño (ducha)');
  room(u, rect(2.6, 4.2, 5.5, 6.4), 'Salita');
  room(u, rect(2.6, 6.4, 5.5, 9), 'Oficina');

  // Cuarto existente sobre el fondo (sin segundo piso encima)
  const R = {
    front: wall(u, Q(0, 16), Q(5.5, 16)),
    right: wall(u, Q(5.5, 16), Q(5.5, 20)),
    back: wall(u, Q(5.5, 20), Q(0, 20)),
    left: wall(u, Q(0, 20), Q(0, 16)),
  };
  opening(u, 'window', R.front, 2.2, { width: 1.2 }); // mira hacia el patio
  room(u, rect(0, 16, 4.5, 20), 'Cuarto (existente)');
  room(u, rect(4.5, 16, 5.5, 20), 'Llegada escalera');
  room(u, rect(0.2, -1.2, 3.1, 0), 'Balcón', 'balcony');

  // ---------- Terraza: placa lista para el tercer piso ----------
  const t = ops.addFloor(p);
  ops.renameFloor(p, t, 'Terraza (futuro 3er piso)');
  const headSide = wall(t, Q(3.3, 0), Q(3.3, 3)); // casetón de la escalera
  const headBack = wall(t, Q(3.3, 3), Q(5.5, 3));
  wall(t, Q(3.3, 0), Q(5.5, 0), 0.2);
  wall(t, Q(5.5, 0), Q(5.5, 3), 0.2);
  // Wide exit covering both flights of the U stair, so you can step out from either lane.
  opening(t, 'door', headBack, 1.1, { width: 1.9, height: 2.1 });
  void headSide;
  // The terrace slab leaves the stairwell open (no slab over the stairs); the stair head has its own roof.
  room(t, [Q(0, 0), Q(3.3, 0), Q(3.3, 3), Q(5.5, 3), Q(5.5, 9), Q(0, 9)].map((q) => P(q.x, q.y)), 'Terraza (pretil)', 'balcony');
  const head = ops.addRoom(p, t, rect(3.3, 0, 5.5, 3), 'Techo casetón');
  ops.setRoomKind(p, t, head, 'roof');
  ops.setRoofHeight(p, t, head, 2.6);

  const text = serializeProject(p);
  const r = parseProject(text);
  if (!r.ok) throw new Error(r.error);
  window.__editor.getState().loadProject(r.project);
  return text;
});

writeFileSync('D:/Proyectos/setup/public/ejemplos/casa-etapa-1.casa.json', json);
await page.waitForTimeout(1500);
const shot = async (name, floor) => {
  await page.getByText(floor, { exact: true }).click();
  await page.getByRole('button', { name: 'Ampliar' }).first().click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: name });
  await page.getByRole('button', { name: 'Dividir' }).click();
};
await shot('etapa1-piso1.png', 'Primer piso');
await shot('etapa1-piso2.png', 'Segundo piso');
await page.getByText('Terraza (futuro 3er piso)', { exact: true }).click();
await page.getByRole('button', { name: 'Ampliar' }).nth(1).click();
await page.waitForTimeout(1500);
const c = await page.getByTestId('scene3d').boundingBox();
await page.mouse.move(c.x + c.width * 0.5, c.y + c.height * 0.55);
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(80); }
for (const [label, file] of [['Mañana', 'etapa1-manana.png'], ['Tarde', 'etapa1-tarde.png'], ['Noche', 'etapa1-noche.png']]) {
  await page.getByRole('radio', { name: label }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: file });
}
await page.getByRole('radio', { name: 'Mañana' }).click();
console.log(errors.length ? errors.join('\n') : 'ok');
await browser.close();
