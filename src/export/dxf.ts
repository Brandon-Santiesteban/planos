// Floor plans to an ASCII DXF (R12 / AC1009, opens in AutoCAD, LibreCAD, BricsCAD…), in metres, one layer per kind of thing.
// CAD y grows upwards while plan y grows downwards, so y is flipped: the plan reads north-up like in the editor.
import type { Floor, Project, Vec2 } from '../model/types';
import { buildDrawing, drawingBounds, LAYERS, northArrow, translate, type DrawingOptions, type Layer, type Prim } from './drawing';

/** AutoCAD colour index per layer. */
export const LAYER_COLORS: Record<Layer, number> = {
  MUROS: 7, // white / black
  HUECOS: 4, // cyan
  HABITACIONES: 3, // green
  MUEBLES: 8, // grey
  COTAS: 1, // red
  TEXTOS: 2, // yellow
};

const FLOOR_GAP = 5; // metres between floors drawn side by side

const num = (v: number) => {
  const s = String(Number(v.toFixed(4)));
  return s === '-0' ? '0' : s;
};

/** DXF R12 text is 8-bit: anything outside ASCII goes as AutoCAD's \U+XXXX escape. */
const escape = (s: string) =>
  [...s].map((ch) => {
    const c = ch.codePointAt(0)!;
    return c < 128 ? ch : `\\U+${c.toString(16).toUpperCase().padStart(4, '0')}`;
  }).join('');

const angle360 = (a: number) => ((a % 360) + 360) % 360;

class Writer {
  private out: string[] = [];
  pair(code: number, value: string | number) {
    this.out.push(String(code).padStart(3, ' '), typeof value === 'number' ? num(value) : value);
  }
  point(p: Vec2, base = 10) {
    this.pair(base, p.x);
    this.pair(base + 10, -p.y);
    this.pair(base + 20, 0);
  }
  toString() {
    return `${this.out.join('\r\n')}\r\n`;
  }
}

function header(w: Writer, prims: Prim[]) {
  const b = drawingBounds(prims) ?? { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  w.pair(0, 'SECTION'); w.pair(2, 'HEADER');
  w.pair(9, '$ACADVER'); w.pair(1, 'AC1009');
  w.pair(9, '$DWGCODEPAGE'); w.pair(3, 'ANSI_1252');
  w.pair(9, '$INSBASE'); w.point({ x: 0, y: 0 });
  w.pair(9, '$EXTMIN'); w.point({ x: b.minX, y: b.maxY });
  w.pair(9, '$EXTMAX'); w.point({ x: b.maxX, y: b.minY });
  w.pair(9, '$LIMMIN'); w.pair(10, b.minX); w.pair(20, -b.maxY);
  w.pair(9, '$LIMMAX'); w.pair(10, b.maxX); w.pair(20, -b.minY);
  w.pair(9, '$LTSCALE'); w.pair(40, 1);
  // Drawing units = metres. Not part of R12 itself, but read by every current CAD program and ignored by the rest.
  w.pair(9, '$INSUNITS'); w.pair(70, 6);
  w.pair(9, '$MEASUREMENT'); w.pair(70, 1);
  w.pair(0, 'ENDSEC');
}

function tables(w: Writer) {
  w.pair(0, 'SECTION'); w.pair(2, 'TABLES');
  w.pair(0, 'TABLE'); w.pair(2, 'LTYPE'); w.pair(70, 2);
  w.pair(0, 'LTYPE'); w.pair(2, 'CONTINUOUS'); w.pair(70, 0); w.pair(3, 'Solid line'); w.pair(72, 65); w.pair(73, 0); w.pair(40, 0);
  w.pair(0, 'LTYPE'); w.pair(2, 'DASHED'); w.pair(70, 0); w.pair(3, 'Dashed __ __ __'); w.pair(72, 65); w.pair(73, 2); w.pair(40, 0.3);
  w.pair(49, 0.2); w.pair(49, -0.1);
  w.pair(0, 'ENDTAB');
  w.pair(0, 'TABLE'); w.pair(2, 'LAYER'); w.pair(70, LAYERS.length + 1);
  for (const [name, color] of [['0', 7] as const, ...LAYERS.map((l) => [l, LAYER_COLORS[l]] as const)]) {
    w.pair(0, 'LAYER'); w.pair(2, name); w.pair(70, 0); w.pair(62, color); w.pair(6, 'CONTINUOUS');
  }
  w.pair(0, 'ENDTAB');
  w.pair(0, 'TABLE'); w.pair(2, 'STYLE'); w.pair(70, 1);
  w.pair(0, 'STYLE'); w.pair(2, 'STANDARD'); w.pair(70, 0); w.pair(40, 0); w.pair(41, 1); w.pair(50, 0); w.pair(71, 0);
  w.pair(42, 0.2); w.pair(3, 'txt'); w.pair(4, '');
  w.pair(0, 'ENDTAB');
  w.pair(0, 'ENDSEC');
}

function entity(w: Writer, p: Prim) {
  if (p.type === 'line') {
    w.pair(0, 'LINE'); w.pair(8, p.layer); w.point(p.a); w.point(p.b, 11);
  } else if (p.type === 'arc') {
    // flipping y mirrors angles: the plan sweep start→end becomes −end→−start (counter-clockwise in CAD)
    const start = angle360(-p.end);
    let end = angle360(-p.start);
    if (end <= start) end += 360;
    w.pair(0, 'ARC'); w.pair(8, p.layer); w.point(p.center); w.pair(40, p.radius); w.pair(50, start); w.pair(51, end);
  } else if (p.type === 'poly') {
    w.pair(0, 'POLYLINE'); w.pair(8, p.layer);
    if (p.dashed) w.pair(6, 'DASHED');
    w.pair(66, 1); w.point({ x: 0, y: 0 }); w.pair(70, p.closed ? 1 : 0);
    for (const v of p.points) { w.pair(0, 'VERTEX'); w.pair(8, p.layer); w.point(v); }
    w.pair(0, 'SEQEND'); w.pair(8, p.layer);
  } else {
    w.pair(0, 'TEXT'); w.pair(8, p.layer); w.point(p.at); w.pair(40, p.height); w.pair(1, escape(p.text));
    w.pair(50, angle360(-p.angle)); w.pair(72, 1); w.pair(73, 2); w.point(p.at, 11);
  }
}

/**
 * One DXF with the given floors. Several floors go side by side (left to right, same y as in the editor),
 * each with its name above it, so the architect gets the whole house in a single file.
 */
export function exportDxf(project: Project, floors: Floor[], opts: DrawingOptions = {}): string {
  const all: Prim[] = [];
  let cursor: number | null = null;
  for (const floor of floors) {
    const d = buildDrawing(floor, opts);
    if (!d.bounds) continue;
    const dx: number = cursor === null ? 0 : cursor - d.bounds.minX;
    all.push(...translate(d.prims, dx, 0));
    if (floors.length > 1) {
      all.push({
        type: 'text', layer: 'TEXTOS', text: floor.name, height: 0.4, angle: 0,
        at: { x: (d.bounds.minX + d.bounds.maxX) / 2 + dx, y: d.bounds.minY - 0.8 },
      });
    }
    cursor = d.bounds.maxX + dx + FLOOR_GAP;
  }
  const b = drawingBounds(all);
  if (b) all.push(...northArrow({ x: b.maxX + 1.5, y: b.minY + 1 }, 1.2, project.north));

  const w = new Writer();
  w.pair(999, escape(`${project.name} - Diseñador de casa`));
  header(w, all);
  tables(w);
  w.pair(0, 'SECTION'); w.pair(2, 'ENTITIES');
  for (const p of all) entity(w, p);
  w.pair(0, 'ENDSEC');
  w.pair(0, 'EOF');
  return w.toString();
}
