#!/usr/bin/env node
// Amuebla un proyecto .casa.json según el NOMBRE de cada habitación (Node, sin dependencias).
//   node scripts/ejemplo-muebles.mjs public/ejemplos/casa-etapa-1.casa.json
// Es idempotente: borra los muebles que hubiera y los vuelve a poner.
// Las habitaciones son rectángulos alineados a los ejes; su interior se calcula con la caja de su polígono menos
// medio grosor de los muros que hay en cada borde (en balcones y terrazas, 20 cm del pretil).
// Convención de los muebles (src/furniture/catalog.ts): ancho en x, fondo en y, el FRENTE mira a +y con rotación 0;
// la rotación va en grados, en sentido horario en el plano (y hacia abajo). Plano: norte arriba, calle abajo.
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Reads sizes and default elevations straight from the app's catalog, so there is a single source of truth. */
export function readCatalog(file = join(here, '../src/furniture/catalog.ts')) {
  const src = readFileSync(file, 'utf8');
  const re = /item\('([^']+)',\s*'([^']+)',\s*'[^']+',\s*'[^']+',\s*\[([\d.]+),\s*([\d.]+),\s*([\d.]+)\]([^)]*)\)/g;
  const out = new Map();
  for (const m of src.matchAll(re)) {
    const elevation = /elevation:\s*([\d.]+)/.exec(m[6]);
    out.set(m[1], { name: m[2], width: +m[3], depth: +m[4], height: +m[5], elevation: elevation ? +elevation[1] : 0 });
  }
  return out;
}

// Back of the piece against a wall: n = top of the plan (−y), s = bottom, w = left (−x), e = right.
const ROT = { n: 0, s: 180, w: 270, e: 90 };
const EPS = 1e-6;

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

/** Builds the pieces of one room. `r` is its interior. */
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
    const d = (o.depth ?? c.depth) / 2 + (o.gap ?? 0);
    const pos = {
      n: [at, r.y0 + d], s: [at, r.y1 - d], w: [r.x0 + d, at], e: [r.x1 - d, at],
    }[side];
    return piece(type, pos[0], pos[1], ROT[side] + (o.turn ?? 0), o);
  };
  return { pieces, piece, onWall };
}

const round = (v) => Math.round(v * 1000) / 1000;

/** Recipes by room name. Coordinates come from the interior `r`, so they follow the plan if it changes a little. */
const RECIPES = {
  Parqueadero(k, r) {
    // Carro de frente hacia la casa (la reja está abajo); deja paso hacia la puerta de la entrada (muro derecho).
    k.piece('carro', r.x0 + 0.5 + 0.9, r.y1 - 0.2 - 2.25, 270);
  },
  Entrada(k, r) {
    k.onWall('e', 'banca', r.y0 + 0.85);
    k.onWall('e', 'matera', r.y1 - 0.25, { gap: 0.02 });
    k.onWall('e', 'cuadro-byn', r.y0 + 0.85);
  },
  Sala(k, r) {
    // Mueble de TV en el muro de la derecha; sofá mirándolo, de espaldas a la cocina abierta.
    const cy = (r.y0 + r.y1) / 2;
    k.onWall('e', 'mueble-tv', cy);
    k.onWall('e', 'televisor', cy, { gap: 0.2, elevation: 0.5 });
    k.onWall('w', 'sofa-3', cy, { width: Math.min(2.1, r.y1 - r.y0 - 0.06), gap: 0.05 });
    k.piece('mesa-centro', r.x0 + 0.05 + 0.9 + 0.4 + 0.3, cy, 90);
    // Cuadro en el tramo de muro de abajo, junto al sofá (la ventana de la cocina queda a la izquierda).
    k.onWall('s', 'cuadro-abstracto', r.x0 + 0.65);
  },
  Comedor(k, r) {
    // Mesa hacia la cocina; la puerta doble al patio (arriba a la derecha) queda libre.
    const cx = r.x0 + 0.75;
    const cy = (r.y0 + r.y1) / 2 + 0.05;
    k.piece('mesa-comedor-4', cx, cy);
    for (const dx of [-0.3, 0.3]) {
      k.piece('silla-comedor', cx + dx, cy - 0.4 - 0.2, 0);
      k.piece('silla-comedor', cx + dx, cy + 0.4 + 0.2, 180);
    }
    // Paisaje sobre la mesa, en el muro de arriba, a la izquierda de la puerta al patio.
    k.onWall('n', 'cuadro-paisaje', cx);
  },
  Cocina(k, r) {
    // Cocina lineal contra el muro medianero (izquierda, el largo): nevera, mesón, lavaplatos, mesón, estufa.
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
    const n = 2;
    const len = (upperTo - upperFrom) / n;
    for (let i = 0; i < n; i++) k.onWall('w', 'alacena', upperFrom + len * (i + 0.5), { width: len });
  },
  'Habitación 1 (existente)'(k, r) {
    const cy = (r.y0 + r.y1) / 2;
    k.onWall('w', 'cama-doble', cy);
    k.onWall('w', 'mesa-noche', cy - 0.7 - 0.25);
    k.onWall('s', 'closet', r.x1 - 0.15 - 0.6);
    k.onWall('w', 'cuadro-paisaje', cy);
  },
  'Habitación 2 (existente)'(k, r) {
    // Cabecera arriba, entre las dos puertas; clóset en el muro izquierdo.
    const cx = (r.x0 + r.x1) / 2 + 0.45;
    k.onWall('n', 'cama-doble', cx);
    k.onWall('n', 'mesa-noche', cx - 0.7 - 0.25);
    k.onWall('w', 'closet', r.y1 - 0.75);
    k.onWall('n', 'cuadro-byn', cx);
  },
  Lavadero(k, r) {
    k.onWall('n', 'lavadero', r.x0 + 0.35);
    k.onWall('n', 'lavadora', r.x0 + 0.7 + 0.1 + 0.3);
  },
  'Baño (existente)'(k, r) {
    k.piece('ducha', r.x0 + 0.45, r.y0 + 0.45);
    k.onWall('w', 'sanitario', r.y1 - 0.45);
    k.onWall('s', 'lavamanos', r.x1 - 0.6);
  },
  Patio(k, r) {
    k.onWall('e', 'banca', r.y0 + (r.y1 - r.y0) * 0.6);
    k.onWall('e', 'matera', r.y0 + 2.6, { gap: 0.03 });
    // The top wall has the door to the corridor: the second plant goes on the right wall, clear of it.
    k.onWall('e', 'matera', r.y0 + 1.3, { gap: 0.03 });
  },
  'Habitación principal'(k, r) {
    // Cabecera en el muro izquierdo (sin la puerta del balcón), mesas de noche a los lados y un paisaje encima.
    // Enfrente, en el muro derecho, el centro de entretenimiento con el televisor en su nicho (la puerta al
    // pasillo queda libre, más arriba). Espejo de cuerpo entero en el muro de arriba, junto a la puerta del vestier.
    const cy = (r.y0 + r.y1) / 2 + 0.2;
    k.onWall('w', 'cama-queen', cy);
    k.onWall('w', 'mesa-noche', cy - 0.8 - 0.25);
    k.onWall('w', 'mesa-noche', cy + 0.8 + 0.25);
    k.onWall('w', 'cuadro-paisaje', cy, { width: 1.2, height: 0.75, elevation: 1.13 });
    k.onWall('e', 'centro-entretenimiento', cy);
    k.onWall('e', 'televisor', cy, { gap: 0.045, elevation: 0.68 });
    k.onWall('n', 'espejo-cuerpo', r.x1 - 0.65);
  },
  Vestier(k, r) {
    // Los dos muros largos tienen las puertas (dormitorio y baño): los clósets van en los muros de los lados.
    const len = r.y1 - r.y0;
    for (const side of ['w', 'e']) {
      for (let i = 0; i < 2; i++) k.onWall(side, 'closet', r.y0 + (len * (i + 0.5)) / 2, { width: len / 2 - 0.01 });
    }
  },
  'Baño (ducha)'(k, r) {
    // Ducha tipo lluvia en la esquina del fondo a la izquierda; el jacuzzi a lo largo del muro del fondo, bajo la
    // ventana alta. Lavamanos doble con su espejo en el muro derecho y sanitario en el izquierdo; el centro queda
    // libre para circular y la puerta (abajo) abre sin estorbo.
    const shower = 0.9;
    k.piece('ducha', r.x0 + shower / 2, r.y0 + shower / 2);
    const tubLen = r.x1 - r.x0 - shower;
    k.onWall('n', 'jacuzzi', r.x0 + shower + tubLen / 2, { width: tubLen });
    const cy = r.y0 + 0.8 + 0.15 + 0.6;
    k.onWall('e', 'lavamanos-doble', cy);
    k.onWall('e', 'espejo', cy, { width: 1.1, elevation: 1.1 });
    k.onWall('w', 'sanitario', r.y0 + shower + 0.45);
    k.onWall('s', 'toallero', r.x0 + 0.42);
    k.piece('matera', r.x1 - 0.2, r.y1 - 0.2, 0, { width: 0.35, depth: 0.35, height: 0.8 });
  },
  Salita(k, r) {
    // Sofá frente al televisor; debajo del televisor, un mueble bajo con la consola de videojuegos. Todo un poco
    // hacia abajo para dejar libre la puerta de la oficina (arriba a la derecha).
    const cy = r.y1 - 0.75 - 0.005;
    k.onWall('w', 'sofa-3', cy, { width: 1.5 });
    k.onWall('w', 'cuadro-abstracto', cy);
    k.piece('mesa-centro', r.x0 + 0.9 + 0.35 + 0.3, cy, 90);
    k.onWall('e', 'mueble-tv', cy, { width: 0.95 });
    k.onWall('e', 'consola', cy - 0.15, { gap: 0.06, elevation: 0.5 });
    k.onWall('e', 'televisor', cy, { elevation: 0.9 });
  },
  Pasillo(k, r) {
    k.onWall('e', 'cuadro-byn', (r.y0 + r.y1) / 2);
  },
  Oficina(k, r) {
    // Setup gamer. Escritorio en el muro izquierdo con 3 monitores y una tira LED detrás; encima, una repisa con
    // coleccionables (con su tira LED debajo) y un póster. Quien se sienta da la espalda al muro derecho, que
    // queda liso y blanco para las videollamadas. Tablero blanco y otro póster junto a la puerta; cortinas oscuras
    // a los lados de la ventana del fondo.
    const len = 1.85;
    const cy = r.y0 + 0.1 + len / 2;
    k.onWall('w', 'escritorio', cy, { width: len });
    for (const i of [-1, 0, 1]) k.onWall('w', 'monitor', cy + i * 0.61, { gap: 0.05, elevation: 0.75 });
    k.onWall('w', 'torre-pc', cy + len / 2 - 0.2, { gap: 0.08, turn: 0 });
    k.onWall('w', 'tira-led', cy, { width: len - 0.05, elevation: 0.95 });
    k.onWall('w', 'repisa-coleccionables', cy + 0.35);
    k.onWall('w', 'tira-led', cy + 0.35, { width: 1.0, elevation: 1.42, color: '#22d3ee' });
    k.onWall('w', 'poster-gamer', cy - 0.6, { elevation: 1.3 });
    k.piece('silla-gamer', r.x0 + 0.7 + 0.35, cy, 90);
    k.onWall('s', 'tablero-blanco', r.x0 + 1.2);
    k.onWall('s', 'poster-gamer', r.x0 + 0.3, { width: 0.45, height: 0.64, elevation: 1.2 });
    const win = 4.0; // centre of the back window (1,4 m wide)
    for (const sx of [-1, 1]) k.onWall('n', 'cortina', win + sx * (0.7 + 0.15), { width: 0.6, height: 2.55, color: '#3a3f4b' });
  },
  'Cuarto (existente)'(k, r) {
    k.onWall('n', 'cama-doble', r.x0 + 1.45);
    k.onWall('w', 'closet', r.y1 - 0.8);
    k.onWall('n', 'cuadro-abstracto', r.x0 + 1.45);
  },
  'Terraza (pretil)'(k, r) {
    // Rooftop (sin piscina: el usuario la deja para el módulo 2). Adelante (abajo en el plano), a la izquierda del
    // casetón de la escalera: rincón de estar con brasero, dos sillones y un puf, jardinera en el pretil, materas
    // altas en las esquinas y un jardín vertical en el muro del casetón; detrás, mesa de exterior; en el centro la
    // pérgola con sofá y mesa; al fondo bar y parrilla; jardineras y materas en el pretil.
    const front = k.onWall('s', 'jardinera', r.x0 + 1.45, { turn: 180 });
    const loungerY = front.y - 0.2 - 0.1 - 0.975; // (the rest of the terrace is placed from here)
    const pit = { x: r.x0 + 1.35, y: front.y - 0.2 - 0.45 - 0.4 };
    const stairHead = 3.3 - 0.075; // west face of the stair head
    k.piece('brasero', pit.x, pit.y, 0);
    k.piece('sillon-exterior', r.x0 + 0.375, pit.y, 270);
    k.piece('sillon-exterior', pit.x, pit.y - 0.4 - 0.2 - 0.375, 0);
    k.piece('puf', pit.x + 0.4 + 0.3 + 0.25, pit.y, 0);
    k.piece('jardin-vertical', stairHead - 0.06, pit.y - 0.05, 90);
    k.piece('matera-alta', r.x0 + 0.225, r.y1 - 0.225, 0);
    k.piece('matera-alta', stairHead - 0.25, r.y1 - 0.225, 0);
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
};

/** Door clearance zones: the opening plus its width on both sides of the wall. */
function doorZones(floor) {
  const zones = [];
  for (const o of floor.openings) {
    if (o.kind !== 'door' || o.width > 2) continue; // vehicle gates slide
    const w = floor.walls.find((x) => x.id === o.wallId);
    if (!w) continue;
    const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
    const d = { x: (w.b.x - w.a.x) / len, y: (w.b.y - w.a.y) / len };
    const c = { x: w.a.x + d.x * o.offset, y: w.a.y + d.y * o.offset };
    const reach = w.thickness / 2 + Math.min(o.width, 0.9);
    const hw = o.width / 2;
    const ex = Math.abs(d.x) * hw + Math.abs(d.y) * reach;
    const ey = Math.abs(d.y) * hw + Math.abs(d.x) * reach;
    zones.push({ x0: c.x - ex, x1: c.x + ex, y0: c.y - ey, y1: c.y + ey });
  }
  return zones;
}

/** Pieces hung on a wall: they must never cover a window, nor sit over a door. */
const WALL_HUNG = /^(cuadro|poster|espejo|tira-led|repisa|toallero|jardin-vertical|tablero|televisor|alacena|centro-entretenimiento)/;

/** Every opening as a plan box a little thicker than its wall, with its vertical range (a door up to the ceiling). */
function openingBoxes(floor) {
  const out = [];
  for (const o of floor.openings) {
    const w = floor.walls.find((x) => x.id === o.wallId);
    if (!w) continue;
    const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
    const d = { x: (w.b.x - w.a.x) / len, y: (w.b.y - w.a.y) / len };
    const c = { x: w.a.x + d.x * o.offset, y: w.a.y + d.y * o.offset };
    const across = w.thickness / 2 + 0.1;
    const ex = Math.abs(d.x) * (o.width / 2) + Math.abs(d.y) * across;
    const ey = Math.abs(d.y) * (o.width / 2) + Math.abs(d.x) * across;
    const bottom = o.kind === 'door' ? 0 : o.sill ?? 0;
    const top = o.kind === 'door' ? Infinity : bottom + o.height;
    out.push({ kind: o.kind, x0: c.x - ex, x1: c.x + ex, y0: c.y - ey, y1: c.y + ey, bottom, top });
  }
  return out;
}

function footprint(f) {
  const t = (f.rotation * Math.PI) / 180;
  const hx = (Math.abs(Math.cos(t)) * f.width + Math.abs(Math.sin(t)) * f.depth) / 2;
  const hy = (Math.abs(Math.sin(t)) * f.width + Math.abs(Math.cos(t)) * f.depth) / 2;
  return { x0: f.x - hx, x1: f.x + hx, y0: f.y - hy, y1: f.y + hy };
}

const overlaps = (a, b, m = 0.01) => a.x0 < b.x1 - m && b.x0 < a.x1 - m && a.y0 < b.y1 - m && b.y0 < a.y1 - m;

/** Furnishes every room it knows. Returns one line per room (and warnings). Mutates `project`. */
export function furnish(project, catalog = readCatalog()) {
  const lines = [];
  for (const floor of project.floors) {
    floor.furniture = (floor.furniture ?? []).filter((f) => f.id.startsWith('entorno-')); // the street (ejemplo-entorno.mjs)
    const zones = doorZones(floor);
    const openings = openingBoxes(floor);
    for (const room of floor.rooms) {
      const recipe = RECIPES[room.name];
      if (!recipe) continue;
      const r = interior(floor, room);
      const kit = makeRoomKit(catalog, r);
      recipe(kit, r);
      floor.furniture.push(...kit.pieces);
      const names = kit.pieces.map((p) => {
        const c = catalog.get(p.type);
        const resized = Math.abs(c.width - p.width) > 0.05 ? ` de ${p.width.toFixed(2).replace('.', ',')} m` : '';
        return c.name.toLowerCase() + resized;
      });
      const counts = [...new Set(names)].map((n) => (names.filter((x) => x === n).length > 1 ? `${names.filter((x) => x === n).length} × ${n}` : n));
      lines.push(`${floor.name} · ${room.name}: ${counts.join(', ')}`);
      for (const p of kit.pieces) {
        const fp = footprint(p);
        if (fp.x0 < r.x0 - 0.01 || fp.x1 > r.x1 + 0.01 || fp.y0 < r.y0 - 0.01 || fp.y1 > r.y1 + 0.01) {
          if (!['pergola'].includes(p.type)) lines.push(`  AVISO: ${p.type} se sale de ${room.name}`);
        }
        if (p.elevation < 0.9 && zones.some((z) => overlaps(fp, z))) lines.push(`  AVISO: ${p.type} estorba una puerta en ${room.name}`);
        if (WALL_HUNG.test(p.type)) {
          for (const o of openings) {
            const vertical = p.elevation < o.top && p.elevation + p.height > o.bottom;
            if (vertical && overlaps(fp, o)) lines.push(`  AVISO: ${p.type} tapa una ${o.kind === 'door' ? 'puerta' : 'ventana'} en ${room.name}`);
          }
        }
      }
    }
  }
  return lines;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = process.argv[2];
  if (!file) {
    console.error('Uso: node scripts/ejemplo-muebles.mjs ruta/al/proyecto.casa.json');
    process.exit(1);
  }
  const project = JSON.parse(readFileSync(file, 'utf8'));
  const lines = furnish(project);
  writeFileSync(file, JSON.stringify(project, null, 2) + '\n');
  console.log(lines.join('\n'));
  const total = project.floors.reduce((n, f) => n + f.furniture.length, 0);
  console.log(`Listo: ${total} muebles en ${file}`);
}
