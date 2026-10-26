#!/usr/bin/env node
// Applies the facade and materials proposal to the example house (public/ejemplos/casa-etapa-1.casa.json).
//
//   node scripts/ejemplo-fachada.mjs [ruta.casa.json]
//
// Plan: north up, street at the bottom. Module 1 is x 0…5,5, y 0…9 (front wall at y = 9, party walls at
// x = 0 and x = 5,5). The stair volume is the strip x 3,3…5,5 at the front.
// Outside faces are found geometrically (no hard-coded ids). Running it twice changes nothing more.
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MODULE = { x0: 0, x1: 5.5, y0: 0, y1: 9 };
const STAIR_X = 3.3;
const TOL = 0.01;

export const COLORS = {
  huesoArenilla: '#E4D9C6', // main volume outside
  hueso: '#EDE4D3', // every inside face
  grisClaro: '#C8CBCE', // party walls outside
  negro: '#1E1E1E', // fence and railings
};

const near = (a, b) => Math.abs(a - b) <= TOL;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const len = (v) => Math.hypot(v.x, v.y);

function pointInPolygon(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

const inModule = (p) => p.x >= MODULE.x0 - TOL && p.x <= MODULE.x1 + TOL && p.y >= MODULE.y0 - TOL && p.y <= MODULE.y1 + TOL;
const strictlyInModule = (p) => p.x > MODULE.x0 && p.x < MODULE.x1 && p.y > MODULE.y0 && p.y < MODULE.y1;

/** Unit normal of a face: `left` is +perp(d) = (−d.y, d.x) walking from a to b. */
function normal(w, side) {
  const d = sub(w.b, w.a);
  const l = len(d);
  const n = { x: -d.y / l, y: d.x / l };
  return side === 'left' ? n : { x: -n.x, y: -n.y };
}

/** Points just beyond a face, at a few places along the wall. */
function probes(w, side) {
  const n = normal(w, side);
  const off = w.thickness / 2 + 0.05;
  return [0.5, 0.25, 0.75].map((t) => ({
    x: w.a.x + (w.b.x - w.a.x) * t + n.x * off,
    y: w.a.y + (w.b.y - w.a.y) * t + n.y * off,
  }));
}

/**
 * A face is outside when it looks at no room of its floor (roof coverings, balconies and the patio don't count),
 * or when the wall lies on the module and the face looks out of the module's box.
 */
export function isOutside(floor, w, side) {
  const ps = probes(w, side);
  const onModule = inModule(w.a) && inModule(w.b);
  if (onModule && !strictlyInModule(ps[0])) return true;
  const enclosed = floor.rooms.filter((r) => r.kind !== 'roof' && r.kind !== 'balcony' && !/patio/i.test(r.name));
  return !ps.some((p) => enclosed.some((r) => pointInPolygon(p, r.points)));
}

const isPartyWall = (w) => (near(w.a.x, MODULE.x0) && near(w.b.x, MODULE.x0)) || (near(w.a.x, MODULE.x1) && near(w.b.x, MODULE.x1));
const onFront = (w) => near(w.a.y, MODULE.y1) && near(w.b.y, MODULE.y1);
const isStairFront = (w) => onFront(w) && Math.min(w.a.x, w.b.x) >= STAIR_X - TOL && Math.max(w.a.x, w.b.x) <= MODULE.x1 + TOL;

/** Splits a front wall that runs across x = 3,3 so the stair volume's front can have its own finish. */
function splitFrontWalls(floor) {
  for (const w of [...floor.walls]) {
    if (!onFront(w)) continue;
    const lo = Math.min(w.a.x, w.b.x);
    const hi = Math.max(w.a.x, w.b.x);
    if (!(lo < STAIR_X - 0.05 && hi > STAIR_X + 0.05)) continue;
    const s = { x: STAIR_X, y: w.a.y };
    const t = len(sub(s, w.a));
    const own = floor.openings.filter((o) => o.wallId === w.id);
    if (own.some((o) => o.offset - o.width / 2 < t && o.offset + o.width / 2 > t)) continue; // an opening straddles the cut
    const second = { ...structuredClone(w), id: randomUUID(), a: s };
    w.b = { ...s };
    floor.walls.splice(floor.walls.indexOf(w) + 1, 0, second);
    for (const o of own) {
      if (o.offset > t) {
        o.wallId = second.id;
        o.offset -= t;
      }
    }
  }
}

function floorMaterialFor(room) {
  const n = room.name.toLowerCase();
  if (/patio/.test(n)) return 'piedra';
  if (/antejard/.test(n)) return 'cesped';
  if (/parqueadero|zona de aseo|acceso/.test(n)) return 'concreto';
  if (room.kind === 'balcony') return null;
  if (/baño|lavadero/.test(n)) return 'ceramica';
  return 'porcelanato';
}

function railingFor(room, groundFloor) {
  const n = room.name.toLowerCase();
  if (groundFloor && /antejard|acceso vehicular/.test(n)) return { railing: 'celosia', railingColor: COLORS.negro };
  if (/balc|terraza/.test(n)) return { railing: 'muro', railingColor: COLORS.huesoArenilla };
  return null;
}

/** Mutates the project in place with the proposal; returns it. */
export function applyFacadeProposal(project) {
  project.floors.forEach((floor, index) => {
    splitFrontWalls(floor);
    for (const w of floor.walls) {
      const sides = {};
      for (const side of ['left', 'right']) {
        if (!isOutside(floor, w, side)) sides[side] = { finish: 'pintura', color: COLORS.hueso };
        else if (isPartyWall(w)) sides[side] = { finish: 'pintura', color: COLORS.grisClaro };
        else if (isStairFront(w)) sides[side] = { finish: 'madera' };
        else sides[side] = { finish: 'pintura', color: COLORS.huesoArenilla };
      }
      w.sides = sides;
    }
    for (const room of floor.rooms) {
      if (room.kind === 'roof' || room.kind === 'stairs') continue;
      const m = floorMaterialFor(room);
      if (m) room.floorMaterial = m;
      if (room.kind === 'balcony') {
        const r = railingFor(room, index === 0);
        if (r) Object.assign(room, r);
      }
    }
  });
  return project;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const here = fileURLToPath(new URL('.', import.meta.url));
  const file = process.argv[2] ?? `${here}../public/ejemplos/casa-etapa-1.casa.json`;
  const project = JSON.parse(readFileSync(file, 'utf8'));
  applyFacadeProposal(project);
  writeFileSync(file, JSON.stringify(project, null, 2) + '\n');
  console.log(`Fachada y materiales aplicados a ${file}`);
}
