// Wall finishes, floor materials and railings of the complete house (casa-completa.casa.json).
// Same palette as the stage-1 example (scripts/ejemplo-fachada.mjs), extended to the whole 5,5 × 20 m lot.
// Plan coordinates: lot x 0…5,5, y −11 (back) … 9 (front, street side). Idempotent.
//   node scripts/casa-completa-acabados.mjs [ruta.casa.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const COLORES = {
  huesoArenilla: '#E4D9C6', // outside faces
  hueso: '#EDE4D3', // inside faces
  grisClaro: '#C8CBCE', // party walls towards the neighbours
  negro: '#1E1E1E', // metalwork: fence, glass railing frames
};

const LOT = { x0: 0, x1: 5.5, y0: -11, y1: 9 };
const TOL = 0.01;
const near = (a, b) => Math.abs(a - b) <= TOL;

function pointInPolygon(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Points just beyond one face of a wall (`left` = +perp of a→b). */
function probes(w, side) {
  const dx = w.b.x - w.a.x;
  const dy = w.b.y - w.a.y;
  const l = Math.hypot(dx, dy);
  const s = side === 'left' ? 1 : -1;
  const n = { x: (-dy / l) * s, y: (dx / l) * s };
  const off = w.thickness / 2 + 0.05;
  return [0.5, 0.25, 0.75].map((t) => ({ x: w.a.x + dx * t + n.x * off, y: w.a.y + dy * t + n.y * off }));
}

/**
 * Rooms that make a face an inside face: rooms, stairs, roofs at wall height (a stair head) and the stairwell of the
 * stairs coming up from the floor below.
 */
function enclosedRooms(floor, below) {
  const own = floor.rooms.filter((r) => r.kind === 'room' || r.kind === 'stairs' || (r.kind === 'roof' && (r.height ?? floor.height) <= floor.height + TOL));
  return below ? [...own, ...below.rooms.filter((r) => r.kind === 'stairs')] : own;
}

const between = (v, lo, hi) => v >= lo - TOL && v <= hi + TOL;
const isVertical = (w, x) => near(w.a.x, x) && near(w.b.x, x);
const isHorizontal = (w, y) => near(w.a.y, y) && near(w.b.y, y);
const spanY = (w) => [Math.min(w.a.y, w.b.y), Math.max(w.a.y, w.b.y)];
const spanX = (w) => [Math.min(w.a.x, w.b.x), Math.max(w.a.x, w.b.x)];

/** Special outside finishes (plan coordinates; design y = 9 − plan y). */
function accent(floorIndex, w) {
  // Module 1: the front of the stair volume, in wood (as in the stage-1 example).
  if (isHorizontal(w, 9) && spanX(w)[0] >= 3.3 - TOL) return { finish: 'madera' };
  // Module 2: the back stair tower towards the pool deck, in wood: both stair volumes read the same.
  if (isVertical(w, 3.6) && between(spanY(w)[0], -11, -8) && between(spanY(w)[1], -11, -8)) return { finish: 'madera' };
  // Module 2, 3rd floor: the front of the rest & entertainment room, over the light court, in wood.
  if (floorIndex === 2 && isHorizontal(w, -2.6)) return { finish: 'madera' };
  // Retaining wall behind the pool: stone.
  if (floorIndex === 0 && isHorizontal(w, -11) && spanX(w)[1] <= 3.6 + TOL) return { finish: 'piedra', color: '#b9ab95' };
  return null;
}

function faceFinish(floor, floorIndex, w, side, below) {
  const ps = probes(w, side);
  const p = ps[0];
  const outOfLot = p.x < LOT.x0 || p.x > LOT.x1 || p.y < LOT.y0;
  if (outOfLot) return { finish: 'pintura', color: COLORES.grisClaro }; // neighbours / back terrain
  if (ps.some((q) => enclosedRooms(floor, below).some((r) => pointInPolygon(q, r.points)))) return { finish: 'pintura', color: COLORES.hueso };
  return accent(floorIndex, w) ?? { finish: 'pintura', color: COLORES.huesoArenilla };
}

const MATERIAL = [
  [/parqueadero|acceso/i, 'concreto'],
  [/antejard/i, 'cesped'],
  [/patio de luz|deck/i, 'piedra'],
  [/terraza cubierta|mirador/i, 'madera'],
  [/baño|zona de ropas/i, 'ceramica'],
];

function floorMaterialFor(room) {
  for (const [re, m] of MATERIAL) if (re.test(room.name)) return m;
  if (room.kind === 'balcony') return null; // module 1 balcony and rooftop keep the slab colour
  return 'porcelanato';
}

/** Mutates the project in place. */
export function aplicarAcabados(project) {
  project.floors.forEach((floor, i) => {
    const below = project.floors[i - 1];
    for (const w of floor.walls) w.sides = { left: faceFinish(floor, i, w, 'left', below), right: faceFinish(floor, i, w, 'right', below) };
    for (const room of floor.rooms) {
      if (room.kind === 'roof' || room.kind === 'stairs' || room.kind === 'exterior') continue;
      const m = floorMaterialFor(room);
      if (m) room.floorMaterial = m;
      if (room.kind !== 'balcony') continue;
      if (/antejard/i.test(room.name)) Object.assign(room, { railing: 'celosia', railingColor: COLORES.negro });
      else if (/^balcón$|terraza \(pretil\)/i.test(room.name)) Object.assign(room, { railing: 'muro', railingColor: COLORES.huesoArenilla });
      else if (/mirador/i.test(room.name)) Object.assign(room, { railing: 'vidrio', railingColor: COLORES.negro });
    }
  });
  return project;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = process.argv[2] ?? fileURLToPath(new URL('../public/ejemplos/casa-completa.casa.json', import.meta.url));
  const project = JSON.parse(readFileSync(file, 'utf8'));
  aplicarAcabados(project);
  writeFileSync(file, JSON.stringify(project, null, 2) + '\n');
  console.log(`Acabados aplicados a ${file}`);
}
