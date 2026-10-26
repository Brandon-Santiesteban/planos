#!/usr/bin/env node
// Furnishes the complete house (casa-completa.casa.json) room by room, by room NAME. Plain Node, idempotent:
// it keeps only the street pieces (ids "entorno-…") and puts everything else back.
//   node scripts/casa-completa-muebles.mjs [ruta.casa.json]
// Module 1 recipes are copied from scripts/ejemplo-muebles.mjs (same furniture as the stage-1 example), except the
// ground floor, which in the complete house is kitchen + 6-seat dining room (the big living room is in module 2).
// Conventions (src/furniture/catalog.ts): width along x, depth along y, the FRONT faces +y at rotation 0; rotation in
// degrees, clockwise in the plan (y down). Plan: north up, street at the bottom; module 2 lies at negative y.
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Sizes and default elevations straight from the app's catalog. */
export function readCatalog(file = join(here, '../src/furniture/catalog.ts')) {
  const src = readFileSync(file, 'utf8');
  // One item per line; the elevation (e.g. wall cabinets at 1,5 m) is looked up in the rest of that line.
  const re = /item\('([^']+)',\s*'([^']+)',\s*'[^']+',\s*'[^']+',\s*\[([\d.]+),\s*([\d.]+),\s*([\d.]+)\](.*)$/gm;
  const out = new Map();
  for (const m of src.matchAll(re)) {
    const elevation = /elevation:\s*([\d.]+)/.exec(m[6]);
    out.set(m[1], { name: m[2], width: +m[3], depth: +m[4], height: +m[5], elevation: elevation ? +elevation[1] : 0 });
  }
  return out;
}

// Back of the piece against a wall: n = top of the plan (−y, the back of the lot), s = bottom (street), w, e.
const ROT = { n: 0, s: 180, w: 270, e: 90 };
const EPS = 1e-6;
const round = (v) => Math.round(v * 1000) / 1000;

/** Interior rectangle of a room: its bounding box minus half the thickness of the walls on each edge. */
export function interior(floor, room) {
  const xs = room.points.map((p) => p.x);
  const ys = room.points.map((p) => p.y);
  const box = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  const open = room.kind === 'balcony' ? 0.2 : 0;
  const inset = (axis, at, lo, hi) => {
    let t = null;
    for (const w of floor.walls) {
      const [a, b] = axis === 'x' ? [w.a.x, w.b.x] : [w.a.y, w.b.y];
      if (Math.abs(a - at) > EPS || Math.abs(b - at) > EPS) continue;
      const [p, q] = axis === 'x' ? [w.a.y, w.b.y] : [w.a.x, w.b.x];
      const overlap = Math.min(hi, Math.max(p, q)) - Math.max(lo, Math.min(p, q));
      if (overlap > 0.3) t = Math.max(t ?? 0, w.thickness / 2);
    }
    return Math.max(t ?? 0, open);
  };
  return {
    x0: box.x0 + inset('x', box.x0, box.y0, box.y1),
    x1: box.x1 - inset('x', box.x1, box.y0, box.y1),
    y0: box.y0 + inset('y', box.y0, box.x0, box.x1),
    y1: box.y1 - inset('y', box.y1, box.x0, box.x1),
  };
}

function makeRoomKit(catalog, r) {
  const pieces = [];
  const piece = (type, x, y, rotation = 0, o = {}) => {
    const c = catalog.get(type);
    if (!c) throw new Error(`No existe en el catálogo: ${type}`);
    const f = {
      id: randomUUID(), type, x: round(x), y: round(y), rotation: ((rotation % 360) + 360) % 360,
      width: o.width ?? c.width, depth: o.depth ?? c.depth, height: o.height ?? c.height, elevation: o.elevation ?? c.elevation,
    };
    if (o.color) f.color = o.color;
    pieces.push(f);
    return f;
  };
  /** Back against the wall `side`, centred at `at` along it (x for n/s, y for e/w). `gap` leaves room behind. */
  const onWall = (side, type, at, o = {}) => {
    const c = catalog.get(type);
    if (!c) throw new Error(`No existe en el catálogo: ${type}`);
    const d = (o.depth ?? c.depth) / 2 + (o.gap ?? 0);
    const pos = { n: [at, r.y0 + d], s: [at, r.y1 - d], w: [r.x0 + d, at], e: [r.x1 - d, at] }[side];
    return piece(type, pos[0], pos[1], ROT[side] + (o.turn ?? 0), o);
  };
  return { pieces, piece, onWall };
}

const cy = (r) => (r.y0 + r.y1) / 2;
const cx = (r) => (r.x0 + r.x1) / 2;

// ---------------- Module 1 (copied from scripts/ejemplo-muebles.mjs) ----------------
const MODULO_1 = {
  Parqueadero(k, r) {
    k.piece('carro', r.x0 + 0.5 + 0.9, r.y1 - 0.2 - 2.25, 270);
  },
  Entrada(k, r) {
    k.onWall('e', 'banca', r.y0 + 0.85);
    k.onWall('e', 'matera', r.y1 - 0.25, { gap: 0.02 });
  },
  Cocina(k, r) {
    let y = r.y0;
    const run = (type, len, o = {}) => {
      k.onWall('w', type, y + len / 2, { width: len, ...o });
      y += len;
    };
    run('nevera', 0.7);
    const upperFrom = y;
    run('meson', 0.6);
    run('lavaplatos', 0.8);
    run('meson', 1.0);
    const upperTo = y;
    run('estufa', 0.6);
    const len = (upperTo - upperFrom) / 2;
    for (let i = 0; i < 2; i++) k.onWall('w', 'alacena', upperFrom + len * (i + 0.5), { width: len });
  },
  'Habitación principal'(k, r) {
    const y = cy(r) + 0.2;
    k.onWall('w', 'cama-queen', y);
    k.onWall('w', 'mesa-noche', y - 0.8 - 0.25);
    k.onWall('w', 'mesa-noche', y + 0.8 + 0.25);
    k.onWall('e', 'comoda', y + 0.3);
  },
  Vestier(k, r) {
    const len = r.y1 - r.y0;
    for (const side of ['w', 'e']) {
      for (let i = 0; i < 2; i++) k.onWall(side, 'closet', r.y0 + (len * (i + 0.5)) / 2, { width: len / 2 - 0.01 });
    }
  },
  'Baño (ducha)'(k, r) {
    k.piece('ducha', r.x1 - 0.45, r.y0 + 0.45);
    k.onWall('w', 'sanitario', r.y0 + 0.55);
    const y = r.y0 + 0.9 + 0.1 + 0.6;
    k.onWall('e', 'lavamanos-doble', y);
    k.onWall('e', 'espejo', y, { width: 1.2, elevation: 1.1 });
  },
  Salita(k, r) {
    const y = cy(r) + 0.05;
    k.onWall('w', 'sofa-3', y, { width: 1.6 });
    k.piece('mesa-centro', r.x0 + 0.9 + 0.35 + 0.3, y, 90);
    k.onWall('e', 'televisor', y, { elevation: 1.0 });
  },
  Oficina(k, r) {
    const len = 1.85;
    const y = r.y0 + 0.1 + len / 2;
    k.onWall('w', 'escritorio', y, { width: len });
    for (const i of [-1, 0, 1]) k.onWall('w', 'monitor', y + i * 0.61, { gap: 0.05, elevation: 0.75 });
    k.onWall('w', 'torre-pc', y + len / 2 - 0.2, { gap: 0.08, turn: 0 });
    k.piece('silla-oficina', r.x0 + 0.7 + 0.35, y, 90);
    k.onWall('s', 'tablero-blanco', r.x0 + 1.2);
  },
  'Terraza (pretil)'(k, r) {
    const front = k.onWall('s', 'jardinera', r.x0 + 1.45, { turn: 180 });
    const loungerY = front.y - 0.2 - 0.1 - 0.975;
    for (const x of [r.x0 + 0.55, r.x0 + 1.45]) k.piece('asoleadora', x, loungerY, 0);
    k.piece('sombrilla', r.x0 + 2.15, loungerY, 0, { width: 1.8, depth: 1.8 });
    k.piece('mesa-exterior', r.x0 + 1.2, loungerY - 0.975 - 0.15 - 0.9, 0);
    const pg = { x: r.x0 + 2.4, y: r.y0 + 1.3 + 1.4 };
    k.piece('pergola', pg.x, pg.y, 0, { depth: 2.8 });
    k.piece('sofa-exterior', pg.x, pg.y - 1.4 + 0.15 + 0.425, 0);
    k.piece('mesa-centro', pg.x, pg.y + 0.15, 0, { color: '#9a7650' });
    k.onWall('n', 'bar', r.x0 + 1.1);
    k.onWall('n', 'parrilla', r.x0 + 3.0);
    k.onWall('n', 'matera-alta', r.x1 - 0.25, { gap: 0.02 });
    k.onWall('e', 'jardinera', r.y0 + 0.55 + 0.9);
    k.onWall('e', 'jardinera', r.y0 + 0.55 + 1.8 + 0.1 + 0.9);
    k.onWall('w', 'jardinera', pg.y);
    k.onWall('w', 'matera-alta', loungerY - 2.6, { gap: 0.02 });
  },
  // Complete house: the old sala + comedor become one dining room for 6, open to the kitchen.
  Comedor(k, r) {
    // Table lengthwise (towards the court), chairs 3 + 3; the glass door to the court (top right) stays free.
    const x = r.x0 + 1.55;
    const y = cy(r) + 0.35;
    k.piece('mesa-comedor-6', x, y, 90);
    for (const dy of [-0.6, 0, 0.6]) {
      k.piece('silla-comedor', x - 0.45 - 0.25, y + dy, 270);
      k.piece('silla-comedor', x + 0.45 + 0.25, y + dy, 90);
    }
    k.onWall('e', 'comoda', y, { width: 1.4 }); // aparador
    k.onWall('e', 'matera', r.y1 - 0.3, { gap: 0.03 });
  },
};

// ---------------- Module 2 ----------------
const MODULO_2 = {
  'Zona de ropas'(k, r) {
    // Against the party wall, out of the way of the kitchen door.
    k.onWall('w', 'lavadero', r.y0 + 0.35);
    k.onWall('w', 'lavadora', r.y0 + 0.7 + 0.05 + 0.3);
  },
  'Patio de luz'(k, r) {
    // Plants in the corners, a bench under the laundry window; the way dining room → living room stays clear.
    k.piece('banca', 1.8 + 0.075 + 0.25, -0.9, 270);
    k.onWall('n', 'matera-alta', r.x0 + 0.3, { gap: 0.02 });
    k.onWall('n', 'matera-alta', r.x1 - 0.3, { gap: 0.02 });
    k.onWall('e', 'matera', r.y0 + 0.9, { gap: 0.03 });
  },
  'Sala principal'(k, r) {
    // TV on the left party wall; sofa + armchair facing it; the right strip (x > 3,6) is the way court → stair.
    const y = cy(r) - 0.05;
    k.onWall('w', 'mueble-tv', y, { width: 1.8 });
    k.onWall('w', 'televisor', y, { gap: 0.2, elevation: 0.5 });
    k.piece('alfombra', r.x0 + 1.75, y, 90, { width: 2.4, depth: 1.8 });
    k.piece('sofa-3', r.x0 + 2.85, y, 90, { width: 2.0 });
    k.piece('mesa-centro', r.x0 + 1.75, y, 90);
    k.piece('sillon', r.x0 + 1.35, r.y0 + 0.55, 0);
    k.onWall('n', 'lampara-pie', r.x0 + 0.3, { gap: 0.05 });
    k.onWall('s', 'matera-alta', r.x0 + 0.35, { gap: 0.05 });
    k.onWall('e', 'estanteria', r.y0 + 1.0);
    k.onWall('e', 'matera', r.y0 + 0.3, { gap: 0.03 });
  },
  'Baño social'(k, r) {
    // Serves the pool too: shower in the corner under the high window.
    k.piece('ducha', r.x1 - 0.45, r.y1 - 0.45);
    k.onWall('w', 'sanitario', r.y1 - 0.3);
    k.onWall('w', 'lavamanos', r.y0 + 0.5, { gap: 0.0 });
    k.onWall('w', 'espejo', r.y0 + 0.5, { elevation: 1.1, width: 0.6 });
  },
  'Terraza cubierta'(k, r) {
    // Outdoor shower at the right end, next to the stair and the living room's side door.
    k.piece('ducha', 4.95, -7.35, 0, { color: '#b9c3c7' });
  },
  'Deck de la piscina'(k, r) {
    // Pool against the retaining wall (raised 45 cm: its coping is a seat); two loungers looking at the water,
    // half in the shade of the floor above; a tall plant at the corner.
    k.piece('piscina', 1.8, -11 + 0.15 + 0.95, 0, { width: 3.2, depth: 1.9, height: 0.45, color: '#d9cfbf' });
    for (const x of [0.5, 1.3]) k.piece('asoleadora', x, -7.85, 180);
    k.piece('matera-alta', 3.25, -8.3, 0);
  },
  'Habitación módulo 2'(k, r) {
    // Bed against the party wall, between the court window (front) and the pool window (back).
    const y = cy(r) + 0.2;
    k.onWall('w', 'cama-queen', y);
    k.onWall('w', 'mesa-noche', y - 0.8 - 0.25);
    k.onWall('w', 'mesa-noche', y + 0.8 + 0.25);
    k.piece('alfombra', r.x0 + 2.0 + 0.4, y, 90, { width: 2.2, depth: 1.4 });
    k.onWall('s', 'escritorio', r.x0 + 2.45, { width: 1.3 });
    k.piece('silla-oficina', r.x0 + 2.45, r.y1 - 0.7 - 0.35, 0);
    k.onWall('e', 'comoda', r.y1 - 1.25);
    k.onWall('e', 'televisor', r.y1 - 1.25, { elevation: 1.0, gap: 0.02 });
    k.piece('sillon', r.x0 + 0.6, r.y0 + 0.65, 30);
    k.onWall('n', 'lampara-pie', r.x0 + 1.5, { gap: 0.05 });
  },
  'Baño módulo 2'(k, r) {
    k.piece('ducha', r.x1 - 0.45, r.y1 - 0.45);
    k.onWall('w', 'lavamanos-doble', r.y1 - 0.7);
    k.onWall('w', 'espejo', r.y1 - 0.7, { width: 1.2, elevation: 1.1 });
    k.onWall('e', 'sanitario', r.y0 + 0.35);
  },
  'Vestier módulo 2'(k, r) {
    const len = r.y1 - r.y0;
    for (let i = 0; i < 2; i++) k.onWall('e', 'closet', r.y0 + (len * (i + 0.5)) / 2, { width: len / 2 - 0.01 });
    k.onWall('n', 'espejo', r.x0 + 0.5, { width: 0.6, height: 1.6, elevation: 0.3 });
  },
  'Hall módulo 2'(k, r) {
    k.onWall('e', 'matera', r.y1 - 0.25, { gap: 0.03 });
  },
  'Cuarto de descanso y entretenimiento'(k, r) {
    // Sofa looking at the TV, its back to the big window (the view is to the front, over the court);
    // bar corner on the party wall; armchair turned towards the view.
    const tvX = r.x1 - 1.15;
    k.onWall('n', 'mueble-tv', tvX, { width: 1.8 });
    k.onWall('n', 'televisor', tvX, { gap: 0.15, elevation: 0.5 });
    k.onWall('s', 'sofa-3', tvX, { width: 2.2, gap: 0.05 });
    k.piece('alfombra', tvX, cy(r), 0, { width: 2.2, depth: 1.2 });
    k.piece('mesa-centro', tvX, cy(r) + 0.05, 0);
    k.piece('sillon', r.x0 + 2.55, cy(r) - 0.1, 240);
    k.onWall('w', 'bar', r.y0 + 1.25, { gap: 0.02 });
    k.onWall('n', 'matera-alta', r.x0 + 2.65, { gap: 0.02 });
    k.onWall('s', 'lampara-pie', r.x0 + 0.35, { gap: 0.05 });
  },
  'Balcón mirador'(k, r) {
    for (const x of [r.x0 + 3.4, r.x0 + 4.1]) k.piece('silla-exterior', x, cy(r), 0);
    k.piece('matera', r.x0 + 0.3, cy(r), 0);
    k.piece('matera', r.x1 - 0.3, cy(r), 0);
  },
  Gimnasio(k, r) {
    // No gym machines in the catalog: mat, bench, rack, a big mirror and a TV.
    k.piece('alfombra', cx(r) - 0.1, cy(r), 0, { width: 2.0, depth: 1.2, color: '#3b3f45' });
    k.piece('banca', cx(r) - 0.1, cy(r) - 0.15, 0, { color: '#2b2d31' });
    k.onWall('w', 'espejo', cy(r), { width: 1.8, height: 1.7, elevation: 0.3 });
    k.onWall('w', 'estanteria', r.y0 + 0.45, { width: 0.8 });
    k.onWall('s', 'televisor', r.x0 + 2.1, { elevation: 1.3 });
    k.onWall('n', 'matera-alta', r.x0 + 0.75, { gap: 0.02 });
  },
  'Medio baño'(k, r) {
    k.onWall('e', 'sanitario', r.y0 + 0.3);
    k.onWall('s', 'lavamanos', r.x1 - 0.65);
    k.onWall('s', 'espejo', r.x1 - 0.65, { width: 0.6, elevation: 1.1 });
  },
  'Llegada escalera módulo 2'(k, r) {
    k.onWall('e', 'matera', r.y1 - 0.25, { gap: 0.03 });
  },
};

const RECIPES = { ...MODULO_1, ...MODULO_2 };

/** Door clearance zones: the opening plus its width on both sides of the wall. */
function doorZones(floor) {
  const zones = [];
  for (const o of floor.openings) {
    if (o.kind !== 'door' || o.width > 2) continue;
    const w = floor.walls.find((x) => x.id === o.wallId);
    if (!w) continue;
    const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
    const d = { x: (w.b.x - w.a.x) / len, y: (w.b.y - w.a.y) / len };
    const c = { x: w.a.x + d.x * o.offset, y: w.a.y + d.y * o.offset };
    const reach = w.thickness / 2 + Math.min(o.width, 0.9);
    const hw = o.width / 2;
    zones.push({
      x0: c.x - (Math.abs(d.x) * hw + Math.abs(d.y) * reach), x1: c.x + (Math.abs(d.x) * hw + Math.abs(d.y) * reach),
      y0: c.y - (Math.abs(d.y) * hw + Math.abs(d.x) * reach), y1: c.y + (Math.abs(d.y) * hw + Math.abs(d.x) * reach),
    });
  }
  return zones;
}

function footprint(f) {
  const t = (f.rotation * Math.PI) / 180;
  const hx = (Math.abs(Math.cos(t)) * f.width + Math.abs(Math.sin(t)) * f.depth) / 2;
  const hy = (Math.abs(Math.sin(t)) * f.width + Math.abs(Math.cos(t)) * f.depth) / 2;
  return { x0: f.x - hx, x1: f.x + hx, y0: f.y - hy, y1: f.y + hy };
}

const overlaps = (a, b, m = 0.01) => a.x0 < b.x1 - m && b.x0 < a.x1 - m && a.y0 < b.y1 - m && b.y0 < a.y1 - m;
const FLAT = new Set(['alfombra', 'pergola', 'sombrilla', 'televisor', 'monitor', 'torre-pc', 'espejo']);

/** Furnishes every room it knows; returns one line per room plus warnings. Mutates `project`. */
export function amueblar(project, catalog = readCatalog()) {
  const lines = [];
  for (const floor of project.floors) {
    floor.furniture = (floor.furniture ?? []).filter((f) => f.id.startsWith('entorno-'));
    const zones = doorZones(floor);
    const placed = [];
    for (const room of floor.rooms) {
      const recipe = RECIPES[room.name];
      if (!recipe) continue;
      const r = interior(floor, room);
      const kit = makeRoomKit(catalog, r);
      recipe(kit, r);
      floor.furniture.push(...kit.pieces);
      const names = kit.pieces.map((p) => catalog.get(p.type).name.toLowerCase());
      const counts = [...new Set(names)].map((n) => {
        const c = names.filter((x) => x === n).length;
        return c > 1 ? `${c} × ${n}` : n;
      });
      lines.push(`${floor.name} · ${room.name}: ${counts.join(', ')}`);
      for (const p of kit.pieces) {
        const fp = footprint(p);
        if (fp.x0 < r.x0 - 0.01 || fp.x1 > r.x1 + 0.01 || fp.y0 < r.y0 - 0.01 || fp.y1 > r.y1 + 0.01) {
          if (!FLAT.has(p.type) && room.kind !== 'balcony') lines.push(`  AVISO: ${p.type} se sale de ${room.name}`);
        }
        if (p.elevation < 0.9 && !FLAT.has(p.type) && zones.some((z) => overlaps(fp, z))) lines.push(`  AVISO: ${p.type} estorba una puerta en ${room.name}`);
        if (p.elevation < 0.9 && !FLAT.has(p.type)) {
          for (const q of placed) if (overlaps(fp, footprint(q), 0.02) && !FLAT.has(q.type) && q.elevation < 0.9) lines.push(`  AVISO: ${p.type} choca con ${q.type} en ${room.name}`);
          placed.push(p);
        }
      }
    }
  }
  return lines;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = process.argv[2] ?? join(here, '../public/ejemplos/casa-completa.casa.json');
  const project = JSON.parse(readFileSync(file, 'utf8'));
  const lines = amueblar(project);
  writeFileSync(file, JSON.stringify(project, null, 2) + '\n');
  console.log(lines.join('\n'));
}
