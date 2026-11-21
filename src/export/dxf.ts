// Floor plans to an ASCII DXF for AutoCAD 2007+ (AC1021; also BricsCAD, DraftSight, LibreCAD, QCAD…).
// AC1021 is the first version whose text is UTF-8, so «Baño» or «Habitación» need no escapes in any program.
// A complete R2000-style file: handles, owners, every symbol table, model/paper space blocks and the OBJECTS
// dictionaries with their layouts, so AutoCAD opens it without recovering or auditing anything.
// Units: millimetres ($INSUNITS 4) by default, as most Latin American offices draw; metres ($INSUNITS 6) on request.
// CAD y grows upwards while plan y grows downwards, so y is flipped: the plan reads north-up like in the editor.
import { catalogItem } from '../furniture/catalog';
import type { Floor, Project, Room, Vec2 } from '../model/types';
import { buildDrawing, drawingBounds, northArrow, translate, type DrawingOptions, type Prim } from './drawing';

export type DxfUnits = 'mm' | 'm';

export interface DxfOptions extends DrawingOptions {
  /** Drawing units: millimetres (default) or metres. */
  units?: DxfUnits;
}

interface CadLayer {
  name: string;
  /** AutoCAD colour index */
  color: number;
  /** lineweight in hundredths of a millimetre */
  lineweight: number;
  description: string;
}

/** Layers of the file, AIA-like with Spanish names, in the order they are listed. */
export const CAD_LAYERS: CadLayer[] = [
  { name: 'MUROS', color: 7, lineweight: 50, description: 'Muros cortados (contorno)' },
  { name: 'MUROS-RELLENO', color: 8, lineweight: 0, description: 'Relleno sólido de los muros' },
  { name: 'HUECOS', color: 4, lineweight: 25, description: 'Puertas y ventanas' },
  { name: 'ESPACIOS', color: 3, lineweight: 13, description: 'Contorno de cada espacio' },
  { name: 'ESCALERAS', color: 6, lineweight: 18, description: 'Escaleras: contorno, huellas y flecha de subida' },
  { name: 'TERRENO', color: 30, lineweight: 18, description: 'Exteriores: andén, calle, jardines, parqueaderos' },
  { name: 'MUEBLES', color: 8, lineweight: 13, description: 'Mobiliario' },
  { name: 'COTAS', color: 1, lineweight: 13, description: 'Cotas' },
  { name: 'TEXTOS', color: 2, lineweight: 18, description: 'Nombres, áreas, plantas y norte' },
];

const FLOOR_GAP = 5; // metres between floors drawn side by side
const TEXT_STYLE = 'ARIAL';
const SCALE: Record<DxfUnits, number> = { mm: 1000, m: 1 };
const INSUNITS: Record<DxfUnits, number> = { mm: 4, m: 6 };

const num = (v: number) => {
  const s = String(Number(v.toFixed(4)));
  return s === '-0' ? '0' : s;
};

/** A text value on one line (the file is UTF-8: accents go as they are). */
const escape = (s: string) => s.replace(/[\r\n]+/g, ' ');

const angle360 = (a: number) => ((a % 360) + 360) % 360;

const samePoints = (a: Vec2[], b: Vec2[]) =>
  a.length === b.length && a.every((p, i) => Math.abs(p.x - b[i].x) < 1e-9 && Math.abs(p.y - b[i].y) < 1e-9);

/** CAD layer for a primitive of the shared drawing. */
function cadLayer(p: Prim, rooms: Room[]): string {
  if (p.layer !== 'HABITACIONES') return p.layer;
  if (p.type === 'line') return 'ESCALERAS'; // the only loose lines among the rooms are treads and the up arrow
  if (p.type === 'poly') {
    // the drawing reuses the room's own points array; compare coordinates only as a fallback
    const room = rooms.find((r) => r.points === p.points) ?? rooms.find((r) => samePoints(r.points, p.points));
    if (room?.kind === 'stairs') return 'ESCALERAS';
    if (room?.kind === 'exterior') return 'TERRENO';
  }
  return 'ESPACIOS';
}

type Placed = { prim: Prim; layer: string };

class Writer {
  private out: string[] = [];
  private next = 0x20;
  /** Scale from metres to drawing units. */
  constructor(private k: number) {}
  handle() {
    return (this.next++).toString(16).toUpperCase();
  }
  get seed() {
    return this.next.toString(16).toUpperCase();
  }
  pair(code: number, value: string | number) {
    this.out.push(String(code).padStart(3, ' '), typeof value === 'number' ? num(value) : value);
  }
  /** A length in metres, written in drawing units. */
  len(code: number, metres: number) {
    this.pair(code, metres * this.k);
  }
  /** A plan point (metres, y down) as a CAD point (drawing units, y up). */
  point(p: Vec2, base = 10, z = true) {
    this.pair(base, p.x * this.k);
    this.pair(base + 10, -p.y * this.k);
    if (z) this.pair(base + 20, 0);
  }
  lines() {
    return this.out;
  }
}

/** Common head of a table: returns its handle. */
function table(w: Writer, name: string, count: number, extraMarker?: string): string {
  const h = w.handle();
  w.pair(0, 'TABLE'); w.pair(2, name); w.pair(5, h); w.pair(330, '0'); w.pair(100, 'AcDbSymbolTable'); w.pair(70, count);
  if (extraMarker) w.pair(100, extraMarker);
  return h;
}

function record(w: Writer, type: string, owner: string, marker: string, handleCode = 5): string {
  const h = w.handle();
  w.pair(0, type); w.pair(handleCode, h); w.pair(330, owner); w.pair(100, 'AcDbSymbolTableRecord'); w.pair(100, marker);
  return h;
}

interface Ids {
  modelRecord: string; paperRecord: string; modelLayout: string; paperLayout: string;
  rootDict: string; groupDict: string; layoutDict: string; plotStyleDict: string; plotStyleNormal: string;
}

function allocIds(w: Writer): Ids {
  return {
    modelRecord: w.handle(), paperRecord: w.handle(), modelLayout: w.handle(), paperLayout: w.handle(),
    rootDict: w.handle(), groupDict: w.handle(), layoutDict: w.handle(), plotStyleDict: w.handle(), plotStyleNormal: w.handle(),
  };
}

function tables(w: Writer, ids: Ids, view: { cx: number; cy: number; h: number }, layers: CadLayer[], units: DxfUnits) {
  w.pair(0, 'SECTION'); w.pair(2, 'TABLES');

  let t = table(w, 'VPORT', 1);
  record(w, 'VPORT', t, 'AcDbViewportTableRecord');
  w.pair(2, '*Active'); w.pair(70, 0);
  w.pair(10, 0); w.pair(20, 0); w.pair(11, 1); w.pair(21, 1);
  w.pair(12, view.cx); w.pair(22, view.cy); w.pair(13, 0); w.pair(23, 0);
  w.pair(14, units === 'mm' ? 100 : 0.1); w.pair(24, units === 'mm' ? 100 : 0.1);
  w.pair(15, units === 'mm' ? 100 : 0.1); w.pair(25, units === 'mm' ? 100 : 0.1);
  w.pair(16, 0); w.pair(26, 0); w.pair(36, 1); w.pair(17, 0); w.pair(27, 0); w.pair(37, 0);
  w.pair(40, view.h); w.pair(41, 1.6); w.pair(42, 50); w.pair(43, 0); w.pair(44, 0); w.pair(50, 0); w.pair(51, 0);
  w.pair(71, 0); w.pair(72, 1000); w.pair(73, 1); w.pair(74, 3); w.pair(75, 0); w.pair(76, 0); w.pair(77, 0); w.pair(78, 0);
  w.pair(281, 0); w.pair(65, 1); w.pair(146, 0);
  w.pair(0, 'ENDTAB');

  t = table(w, 'LTYPE', 4);
  for (const name of ['ByBlock', 'ByLayer', 'Continuous']) {
    record(w, 'LTYPE', t, 'AcDbLinetypeTableRecord');
    w.pair(2, name); w.pair(70, 0); w.pair(3, name === 'Continuous' ? 'Solid line' : ''); w.pair(72, 65); w.pair(73, 0); w.pair(40, 0);
  }
  // dashes sized for the drawing (0,2 m dash, 0,1 m gap) so they read at 1:50 with $LTSCALE 1
  record(w, 'LTYPE', t, 'AcDbLinetypeTableRecord');
  w.pair(2, 'DASHED'); w.pair(70, 0); w.pair(3, 'Dashed __ __ __'); w.pair(72, 65); w.pair(73, 2); w.len(40, 0.3);
  w.len(49, 0.2); w.pair(74, 0); w.len(49, -0.1); w.pair(74, 0);
  w.pair(0, 'ENDTAB');

  t = table(w, 'LAYER', layers.length + 1);
  for (const l of [{ name: '0', color: 7, lineweight: -3, description: '' }, ...layers]) {
    record(w, 'LAYER', t, 'AcDbLayerTableRecord');
    w.pair(2, l.name); w.pair(70, 0); w.pair(62, l.color); w.pair(6, 'Continuous');
    w.pair(370, l.lineweight); w.pair(390, ids.plotStyleNormal);
  }
  w.pair(0, 'ENDTAB');

  t = table(w, 'STYLE', 2);
  for (const [name, font] of [['Standard', 'txt'], [TEXT_STYLE, 'arial.ttf']]) {
    record(w, 'STYLE', t, 'AcDbTextStyleTableRecord');
    w.pair(2, name); w.pair(70, 0); w.pair(40, 0); w.pair(41, 1); w.pair(50, 0); w.pair(71, 0);
    w.len(42, 0.2); w.pair(3, font); w.pair(4, '');
  }
  w.pair(0, 'ENDTAB');

  table(w, 'VIEW', 0); w.pair(0, 'ENDTAB');
  table(w, 'UCS', 0); w.pair(0, 'ENDTAB');

  t = table(w, 'APPID', 1);
  record(w, 'APPID', t, 'AcDbRegAppTableRecord'); w.pair(2, 'ACAD'); w.pair(70, 0);
  w.pair(0, 'ENDTAB');

  t = table(w, 'DIMSTYLE', 1, 'AcDbDimStyleTable');
  record(w, 'DIMSTYLE', t, 'AcDbDimStyleTableRecord', 105);
  w.pair(2, 'Standard'); w.pair(70, 0);
  w.pair(0, 'ENDTAB');

  t = table(w, 'BLOCK_RECORD', 2);
  for (const [h, name, layout] of [[ids.modelRecord, '*Model_Space', ids.modelLayout], [ids.paperRecord, '*Paper_Space', ids.paperLayout]]) {
    w.pair(0, 'BLOCK_RECORD'); w.pair(5, h); w.pair(330, t); w.pair(100, 'AcDbSymbolTableRecord'); w.pair(100, 'AcDbBlockTableRecord');
    w.pair(2, name); w.pair(340, layout);
  }
  w.pair(0, 'ENDTAB');

  w.pair(0, 'ENDSEC');
}

function blocks(w: Writer, ids: Ids) {
  w.pair(0, 'SECTION'); w.pair(2, 'BLOCKS');
  for (const [owner, name] of [[ids.modelRecord, '*Model_Space'], [ids.paperRecord, '*Paper_Space']]) {
    w.pair(0, 'BLOCK'); w.pair(5, w.handle()); w.pair(330, owner); w.pair(100, 'AcDbEntity');
    if (name === '*Paper_Space') w.pair(67, 1);
    w.pair(8, '0'); w.pair(100, 'AcDbBlockBegin');
    w.pair(2, name); w.pair(70, 0); w.pair(10, 0); w.pair(20, 0); w.pair(30, 0); w.pair(3, name); w.pair(1, '');
    w.pair(0, 'ENDBLK'); w.pair(5, w.handle()); w.pair(330, owner); w.pair(100, 'AcDbEntity');
    if (name === '*Paper_Space') w.pair(67, 1);
    w.pair(8, '0'); w.pair(100, 'AcDbBlockEnd');
  }
  w.pair(0, 'ENDSEC');
}

function head(w: Writer, type: string, owner: string, layer: string, marker: string) {
  w.pair(0, type); w.pair(5, w.handle()); w.pair(330, owner); w.pair(100, 'AcDbEntity'); w.pair(8, layer);
  return marker ? w.pair(100, marker) : undefined;
}

function entity(w: Writer, owner: string, { prim: p, layer }: Placed) {
  if (p.type === 'line') {
    head(w, 'LINE', owner, layer, 'AcDbLine'); w.point(p.a); w.point(p.b, 11);
  } else if (p.type === 'arc') {
    // flipping y mirrors angles: the plan sweep start→end becomes −end→−start (counter-clockwise in CAD)
    const start = angle360(-p.end);
    let end = angle360(-p.start);
    if (end <= start) end += 360;
    head(w, 'ARC', owner, layer, 'AcDbCircle'); w.point(p.center); w.len(40, p.radius);
    w.pair(100, 'AcDbArc'); w.pair(50, start); w.pair(51, angle360(end));
  } else if (p.type === 'poly') {
    if (p.fill && p.closed && p.points.length >= 3) hatch(w, owner, layer === 'MUROS' ? 'MUROS-RELLENO' : layer, p.points);
    w.pair(0, 'LWPOLYLINE'); w.pair(5, w.handle()); w.pair(330, owner); w.pair(100, 'AcDbEntity'); w.pair(8, layer);
    if (p.dashed) w.pair(6, 'DASHED');
    w.pair(100, 'AcDbPolyline'); w.pair(90, p.points.length); w.pair(70, p.closed ? 1 : 0); w.pair(43, 0);
    for (const v of p.points) w.point(v, 10, false);
  } else {
    head(w, 'TEXT', owner, layer, 'AcDbText');
    w.point(p.at); w.len(40, p.height); w.pair(1, escape(p.text)); w.pair(50, angle360(-p.angle));
    w.pair(7, TEXT_STYLE); w.pair(72, 1); w.point(p.at, 11);
    w.pair(100, 'AcDbText'); w.pair(73, 2);
  }
}

/** Solid fill bounded by a closed polygon (non-associative, so it can be erased or frozen on its own). */
function hatch(w: Writer, owner: string, layer: string, points: Vec2[]) {
  head(w, 'HATCH', owner, layer, 'AcDbHatch');
  w.pair(10, 0); w.pair(20, 0); w.pair(30, 0); w.pair(210, 0); w.pair(220, 0); w.pair(230, 1);
  w.pair(2, 'SOLID'); w.pair(70, 1); w.pair(71, 0); w.pair(91, 1);
  w.pair(92, 3); w.pair(72, 0); w.pair(73, 1); w.pair(93, points.length); // external polyline loop, no bulges, closed
  for (const v of points) w.point(v, 10, false);
  w.pair(97, 0); w.pair(75, 1); w.pair(76, 1); w.pair(98, 0);
}

function objects(w: Writer, ids: Ids) {
  w.pair(0, 'SECTION'); w.pair(2, 'OBJECTS');
  const dict = (h: string, owner: string, entries: [string, string][]) => {
    w.pair(0, 'DICTIONARY'); w.pair(5, h); w.pair(330, owner); w.pair(100, 'AcDbDictionary'); w.pair(281, 1);
    for (const [name, ref] of entries) { w.pair(3, name); w.pair(350, ref); }
  };
  dict(ids.rootDict, '0', [['ACAD_GROUP', ids.groupDict], ['ACAD_LAYOUT', ids.layoutDict], ['ACAD_PLOTSTYLENAME', ids.plotStyleDict]]);
  dict(ids.groupDict, ids.rootDict, []);
  dict(ids.layoutDict, ids.rootDict, [['Model', ids.modelLayout], ['Layout1', ids.paperLayout]]);
  w.pair(0, 'ACDBDICTIONARYWDFLT'); w.pair(5, ids.plotStyleDict); w.pair(330, ids.rootDict); w.pair(100, 'AcDbDictionary');
  w.pair(281, 1); w.pair(3, 'Normal'); w.pair(350, ids.plotStyleNormal); w.pair(100, 'AcDbDictionaryWithDefault'); w.pair(340, ids.plotStyleNormal);
  w.pair(0, 'ACDBPLACEHOLDER'); w.pair(5, ids.plotStyleNormal); w.pair(330, ids.plotStyleDict);
  for (const [h, name, record, flags, tab] of [
    [ids.modelLayout, 'Model', ids.modelRecord, 1024, 0],
    [ids.paperLayout, 'Layout1', ids.paperRecord, 0, 1],
  ] as const) {
    w.pair(0, 'LAYOUT'); w.pair(5, h); w.pair(330, ids.layoutDict);
    w.pair(100, 'AcDbPlotSettings'); w.pair(1, ''); w.pair(4, 'ISO_A3_(420.00_x_297.00_MM)'); w.pair(6, '');
    w.pair(40, 7.5); w.pair(41, 20); w.pair(42, 7.5); w.pair(43, 20); w.pair(44, 420); w.pair(45, 297);
    w.pair(46, 0); w.pair(47, 0); w.pair(48, 0); w.pair(49, 0); w.pair(140, 0); w.pair(141, 0); w.pair(142, 1); w.pair(143, 1);
    w.pair(70, flags); w.pair(72, 1); w.pair(73, 0); w.pair(74, 5); w.pair(7, ''); w.pair(75, 16); w.pair(76, 0); w.pair(77, 2); w.pair(78, 300);
    w.pair(147, 1); w.pair(148, 0); w.pair(149, 0);
    w.pair(100, 'AcDbLayout'); w.pair(1, name); w.pair(70, 1); w.pair(71, tab);
    w.pair(10, 0); w.pair(20, 0); w.pair(11, 420); w.pair(21, 297); w.pair(12, 0); w.pair(22, 0); w.pair(32, 0);
    w.pair(14, 0); w.pair(24, 0); w.pair(34, 0); w.pair(15, 0); w.pair(25, 0); w.pair(35, 0);
    w.pair(146, 0); w.pair(13, 0); w.pair(23, 0); w.pair(33, 0);
    w.pair(16, 1); w.pair(26, 0); w.pair(36, 0); w.pair(17, 0); w.pair(27, 1); w.pair(37, 0);
    w.pair(76, 1); w.pair(330, record);
  }
  w.pair(0, 'ENDSEC');
}

function header(w: Writer, ext: { minX: number; minY: number; maxX: number; maxY: number }, units: DxfUnits, seed: string) {
  w.pair(0, 'SECTION'); w.pair(2, 'HEADER');
  w.pair(9, '$ACADVER'); w.pair(1, 'AC1021');
  w.pair(9, '$DWGCODEPAGE'); w.pair(3, 'ANSI_1252');
  w.pair(9, '$INSBASE'); w.point({ x: 0, y: 0 });
  w.pair(9, '$EXTMIN'); w.point({ x: ext.minX, y: ext.maxY });
  w.pair(9, '$EXTMAX'); w.point({ x: ext.maxX, y: ext.minY });
  w.pair(9, '$LIMMIN'); w.point({ x: ext.minX, y: ext.maxY }, 10, false);
  w.pair(9, '$LIMMAX'); w.point({ x: ext.maxX, y: ext.minY }, 10, false);
  w.pair(9, '$LTSCALE'); w.pair(40, 1);
  w.pair(9, '$TEXTSIZE'); w.len(40, 0.2);
  w.pair(9, '$TEXTSTYLE'); w.pair(7, TEXT_STYLE);
  w.pair(9, '$CLAYER'); w.pair(8, '0');
  w.pair(9, '$LUNITS'); w.pair(70, 2);
  w.pair(9, '$LUPREC'); w.pair(70, units === 'mm' ? 0 : 3);
  w.pair(9, '$AUNITS'); w.pair(70, 0);
  w.pair(9, '$AUPREC'); w.pair(70, 0);
  w.pair(9, '$INSUNITS'); w.pair(70, INSUNITS[units]);
  w.pair(9, '$MEASUREMENT'); w.pair(70, 1);
  w.pair(9, '$LWDISPLAY'); w.pair(290, 1);
  w.pair(9, '$HANDSEED'); w.pair(5, seed);
  w.pair(0, 'ENDSEC');
}

/**
 * One DXF with the given floors. Several floors go side by side (left to right, aligned as in the editor), each
 * with its name above it, so the architect gets the whole house in a single file.
 */
export function exportDxf(project: Project, floors: Floor[], opts: DxfOptions = {}): string {
  const units = opts.units ?? 'mm';
  const drawingOpts: DrawingOptions = {
    furnitureName: (f) => catalogItem(f.type)?.name ?? f.type.replace(/[-_]+/g, ' '),
    ...opts,
  };
  const placed: Placed[] = [];
  let cursor: number | null = null;
  for (const floor of floors) {
    const d = buildDrawing(floor, drawingOpts);
    if (!d.bounds) continue;
    const dx: number = cursor === null ? 0 : cursor - d.bounds.minX;
    for (const prim of d.prims) placed.push({ prim: translate([prim], dx, 0)[0], layer: cadLayer(prim, floor.rooms) });
    if (floors.length > 1) {
      placed.push({
        layer: 'TEXTOS',
        prim: {
          type: 'text', layer: 'TEXTOS', text: floor.name, height: 0.4, angle: 0,
          at: { x: (d.bounds.minX + d.bounds.maxX) / 2 + dx, y: d.bounds.minY - 0.8 },
        },
      });
    }
    cursor = d.bounds.maxX + dx + FLOOR_GAP;
  }
  const b = drawingBounds(placed.map((p) => p.prim));
  if (b) for (const prim of northArrow({ x: b.maxX + 1.5, y: b.minY + 1 }, 1.2, project.north)) placed.push({ prim, layer: 'TEXTOS' });
  const ext = drawingBounds(placed.map((p) => p.prim)) ?? { minX: 0, minY: 0, maxX: 1, maxY: 1 };

  // any layer the drawing gains later still gets declared
  const layers = [...CAD_LAYERS];
  for (const { layer } of placed) {
    if (!layers.some((l) => l.name === layer)) layers.push({ name: layer, color: 7, lineweight: 18, description: '' });
  }

  const k = SCALE[units];
  const body = new Writer(k);
  const ids = allocIds(body);
  const view = {
    cx: ((ext.minX + ext.maxX) / 2) * k,
    cy: (-(ext.minY + ext.maxY) / 2) * k,
    h: Math.max(ext.maxY - ext.minY, (ext.maxX - ext.minX) / 1.6) * 1.1 * k,
  };
  body.pair(0, 'SECTION'); body.pair(2, 'CLASSES'); body.pair(0, 'ENDSEC');
  tables(body, ids, view, layers, units);
  blocks(body, ids);
  body.pair(0, 'SECTION'); body.pair(2, 'ENTITIES');
  for (const p of placed) entity(body, ids.modelRecord, p);
  body.pair(0, 'ENDSEC');
  objects(body, ids);
  body.pair(0, 'EOF');

  const top = new Writer(k);
  top.pair(999, escape(`${project.name} - Diseñador de casa`));
  header(top, ext, units, body.seed);
  return `${[...top.lines(), ...body.lines()].join('\r\n')}\r\n`;
}
