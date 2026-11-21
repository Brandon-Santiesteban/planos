// Floor plans to a PDF at a real scale for an architect: A1, A2 or A3 sheets, plan at 1:50–1:200, texts and
// dimensions sized in paper millimetres, chained exterior dimensions, area schedule, north arrow, scale bar and
// title block. A plan that does not fit on one sheet at the chosen scale is split across several sheets with
// overlap and a key plan, never shrunk.
import { jsPDF } from 'jspdf';
import { isEndConnected, wallFootprint } from '../geometry/walls';
import type { Floor, Project, Vec2 } from '../model/types';
import { formatMetres } from '../model/units';
import { areaSchedule, buildDrawing, northArrow, type Bounds, type DrawingOptions, type Layer, type Prim } from './drawing';

export type Orientation = 'landscape' | 'portrait';
export type PaperSize = 'A1' | 'A2' | 'A3';
/** Scale denominators offered in the export window. */
export const SCALES = [50, 75, 100, 200] as const;
export type PlotScale = (typeof SCALES)[number];
/** 'auto' = 1:50 when the floor fits on one sheet, else 1:100 (split across sheets if needed). */
export type ScaleChoice = PlotScale | 'auto';

export const PAPERS: Record<PaperSize, { long: number; short: number }> = {
  A1: { long: 841, short: 594 },
  A2: { long: 594, short: 420 },
  A3: { long: 420, short: 297 },
};

/** Per paper size: frame margin, right column width, title block height, base type size (pt). */
const SHEET: Record<PaperSize, { margin: number; column: number; title: number; pt: number }> = {
  A1: { margin: 12, column: 175, title: 52, pt: 9 },
  A2: { margin: 10, column: 140, title: 46, pt: 8 },
  A3: { margin: 8, column: 112, title: 40, pt: 7 },
};
const PAD = 6; // clear space around the plan inside its area (mm)
const OVERLAP = 30; // mm of plan repeated on both neighbouring sheets when a floor is split

export interface Rect { x: number; y: number; w: number; h: number }

export interface Tile {
  /** 0-based column and row in the grid of sheets for this floor */
  col: number;
  row: number;
  /** plan window shown on this sheet, metres */
  window: Bounds;
  /** plan metres to sheet mm */
  toPaper(p: Vec2): Vec2;
}

export interface PageLayout {
  paperSize: PaperSize;
  scale: number;
  orientation: Orientation;
  /** sheet size in mm */
  paper: { w: number; h: number };
  /** where the plan goes, in mm */
  area: Rect;
  /** right-hand column: area schedule, key plan, north arrow, scale bar, title block */
  column: Rect;
  titleBlock: Rect;
  cols: number;
  rows: number;
  tiles: Tile[];
}

function sheet(paperSize: PaperSize, orientation: Orientation) {
  const P = PAPERS[paperSize];
  const S = SHEET[paperSize];
  const paper = orientation === 'landscape' ? { w: P.long, h: P.short } : { w: P.short, h: P.long };
  const column = { x: paper.w - S.margin - S.column, y: S.margin, w: S.column, h: paper.h - 2 * S.margin };
  const area = { x: S.margin, y: S.margin, w: column.x - S.margin, h: paper.h - 2 * S.margin };
  const titleBlock = { x: column.x, y: column.y + column.h - S.title, w: column.w, h: S.title };
  return { paper, area, column, titleBlock };
}

/** How many sheets along one axis: a plan `len` mm long in a window `win` mm long, with OVERLAP between sheets. */
const count = (len: number, win: number) => (len <= win ? 1 : Math.ceil((len - OVERLAP) / (win - OVERLAP)));

function grid(b: Bounds, paperSize: PaperSize, orientation: Orientation, scale: number) {
  const { area } = sheet(paperSize, orientation);
  const k = 1000 / scale;
  const cols = count((b.maxX - b.minX) * k, area.w - 2 * PAD);
  const rows = count((b.maxY - b.minY) * k, area.h - 2 * PAD);
  return { cols, rows, n: cols * rows };
}

/** The sheet orientation that needs fewest sheets; landscape on a tie (the usual way plans are filed). */
function bestOrientation(b: Bounds, paperSize: PaperSize, scale: number): Orientation {
  return grid(b, paperSize, 'portrait', scale).n < grid(b, paperSize, 'landscape', scale).n ? 'portrait' : 'landscape';
}

/** Resolves 'auto': 1:50 if the plan fits one sheet, else 1:100. */
export function resolveScale(b: Bounds, paperSize: PaperSize, choice: ScaleChoice): PlotScale {
  if (choice !== 'auto') return choice;
  return grid(b, paperSize, bestOrientation(b, paperSize, 50), 50).n === 1 ? 50 : 100;
}

/** Sheet layout for a plan with bounds `b` (metres): paper, plan area, column and the grid of tiles. */
export function pageLayout(b: Bounds, paperSize: PaperSize = 'A1', choice: ScaleChoice = 'auto'): PageLayout {
  const scale = resolveScale(b, paperSize, choice);
  const orientation = bestOrientation(b, paperSize, scale);
  const { paper, area, column, titleBlock } = sheet(paperSize, orientation);
  const { cols, rows } = grid(b, paperSize, orientation, scale);
  const k = 1000 / scale;
  const winW = (area.w - 2 * PAD) / k;
  const winH = (area.h - 2 * PAD) / k;
  // per axis: the window's start for sheet i; a plan that fits is centred
  const axis = (lo: number, hi: number, win: number, n: number) => (i: number): [number, number] => {
    if (n === 1) { const c = (lo + hi) / 2; return [c - win / 2, c + win / 2]; }
    const step = (hi - lo - win) / (n - 1);
    return [lo + i * step, lo + i * step + win];
  };
  const ax = axis(b.minX, b.maxX, winW, cols);
  const ay = axis(b.minY, b.maxY, winH, rows);
  const tiles: Tile[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const [minX, maxX] = ax(col);
      const [minY, maxY] = ay(row);
      const ox = area.x + PAD;
      const oy = area.y + PAD;
      tiles.push({ col, row, window: { minX, minY, maxX, maxY }, toPaper: (p) => ({ x: ox + (p.x - minX) * k, y: oy + (p.y - minY) * k }) });
    }
  }
  return { paperSize, scale, orientation, paper, area, column, titleBlock, cols, rows, tiles };
}

// ---- drawing on the sheet --------------------------------------------------------------------

const PT_PER_MM = 72 / 25.4;
const INK = '#1b1f24';
const MUTED = '#566684';
/** Pen per layer for plotting (mm): cut walls heaviest, then openings, dimensions, furniture. */
export const STYLE: Record<Layer, { width: number; color: string }> = {
  MUROS: { width: 0.5, color: '#16191d' },
  HUECOS: { width: 0.25, color: INK },
  HABITACIONES: { width: 0.13, color: '#5a6170' },
  MUEBLES: { width: 0.13, color: '#7a808c' },
  COTAS: { width: 0.18, color: '#2b3038' },
  TEXTOS: { width: 0.18, color: '#111418' },
};

function path(doc: jsPDF, pts: Vec2[], style: 'S' | 'F' | 'FD', closed: boolean) {
  if (pts.length < 2) return;
  const deltas = pts.slice(1).map((p, i) => [p.x - pts[i].x, p.y - pts[i].y]);
  doc.lines(deltas, pts[0].x, pts[0].y, [1, 1], style, closed);
}

/** Text centred on `at` (mm), rotated `angle` degrees as in plan coordinates (clockwise on the sheet). */
function centredText(doc: jsPDF, text: string, at: Vec2, heightMm: number, angle = 0, bold = false) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(heightMm * PT_PER_MM / 0.72); // cap height ≈ 0.72 em
  const w = doc.getTextWidth(text);
  const t = (angle * Math.PI) / 180;
  const dir = { x: Math.cos(t), y: Math.sin(t) };
  const down = { x: -dir.y, y: dir.x };
  const x = at.x - dir.x * (w / 2) + down.x * (heightMm / 2);
  const y = at.y - dir.y * (w / 2) + down.y * (heightMm / 2);
  doc.text(text, x, y, { angle: -angle });
}

function leftText(doc: jsPDF, text: string, x: number, y: number, pt: number, bold = false, color = '#111418', align: 'left' | 'right' | 'center' = 'left') {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(pt);
  doc.setTextColor(color);
  doc.text(text, x, y, { align });
}

const MIN_TEXT_MM = 1.5;

function drawPrims(doc: jsPDF, prims: Prim[], toPaper: (p: Vec2) => Vec2, k: number) {
  for (const p of prims) {
    const s = STYLE[p.layer];
    doc.setDrawColor(s.color);
    doc.setFillColor(s.color);
    doc.setTextColor(s.color);
    doc.setLineWidth(s.width);
    if (p.type === 'poly') {
      if (p.dashed) doc.setLineDashPattern([1.6, 1], 0);
      path(doc, p.points.map(toPaper), p.fill ? 'FD' : 'S', p.closed);
      if (p.dashed) doc.setLineDashPattern([], 0);
    } else if (p.type === 'line') {
      const a = toPaper(p.a);
      const b = toPaper(p.b);
      doc.line(a.x, a.y, b.x, b.y);
    } else if (p.type === 'arc') {
      const n = Math.max(8, Math.ceil((p.end - p.start) / 5));
      const pts: Vec2[] = [];
      for (let i = 0; i <= n; i++) {
        const t = ((p.start + ((p.end - p.start) * i) / n) * Math.PI) / 180;
        pts.push(toPaper({ x: p.center.x + p.radius * Math.cos(t), y: p.center.y + p.radius * Math.sin(t) }));
      }
      path(doc, pts, 'S', false);
    } else {
      centredText(doc, p.text, toPaper(p.at), Math.max(MIN_TEXT_MM, p.height * k), p.angle);
    }
  }
}

/** Order on the sheet: thin things first, walls on top of rooms and furniture, texts last. */
const ORDER: Layer[] = ['HABITACIONES', 'MUEBLES', 'MUROS', 'HUECOS', 'COTAS', 'TEXTOS'];

/** Graphic scale: 5 segments of a round length; returns its height used. */
function scaleBar(doc: jsPDF, x: number, y: number, scale: number, maxW: number, pt: number) {
  const segments = 5;
  const nice = [0.5, 1, 2, 5, 10, 20];
  const segM = [...nice].reverse().find((m) => (segments * m * 1000) / scale <= maxW) ?? nice[0];
  const segMm = (segM * 1000) / scale;
  leftText(doc, 'ESCALA GRÁFICA', x, y, pt * 0.8, true, MUTED);
  const top = y + 2.5;
  doc.setLineWidth(0.15);
  doc.setDrawColor(INK);
  doc.setFillColor(INK);
  for (let i = 0; i < segments; i++) doc.rect(x + i * segMm, top, segMm, 2.5, i % 2 === 0 ? 'FD' : 'S');
  for (let i = 0; i <= segments; i++) {
    const v = String(i * segM).replace('.', ',');
    leftText(doc, i === segments ? `${v} m` : v, x + i * segMm, top + 6.5, pt * 0.8, false, INK, i === segments ? 'left' : 'center');
  }
}

const two = (n: number) => String(n).padStart(2, '0');
export const formatDate = (d: Date) => `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;

/** Fits `text` into `w` mm at the current font, cutting it with an ellipsis. */
function clipText(doc: jsPDF, text: string, w: number): string {
  if (doc.getTextWidth(text) <= w) return text;
  let s = text;
  while (s.length > 1 && doc.getTextWidth(`${s}…`) > w) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

interface SheetInfo { page: number; pages: number; part: number; parts: number }

function titleBlock(doc: jsPDF, l: PageLayout, project: Project, floor: Floor, info: SheetInfo, date: Date) {
  const { x, y, w, h } = l.titleBlock;
  const pt = SHEET[l.paperSize].pt;
  doc.setLineWidth(0.35);
  doc.setDrawColor(INK);
  doc.rect(x, y, w, h, 'S');
  const r1 = y + h * 0.5;
  const split = x + w * 0.5;
  doc.setLineWidth(0.18);
  doc.line(x, r1, x + w, r1);
  doc.line(split, r1, split, y + h);
  const row2 = (y + h - r1) / 2;
  doc.line(split, r1 + row2, x + w, r1 + row2);
  doc.line(x, r1 + row2, split, r1 + row2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(pt * 1.55);
  leftText(doc, clipText(doc, project.name, w - 8), x + 4, y + h * 0.22, pt * 1.55, true);
  doc.setFontSize(pt * 1.2);
  const plano = info.parts > 1 ? `${floor.name} · parte ${info.part} de ${info.parts}` : floor.name;
  leftText(doc, clipText(doc, `Planta arquitectónica · ${plano}`, w - 8), x + 4, y + h * 0.4, pt * 1.2);
  const cell = (label: string, value: string, cx: number, cy: number, bold = true) => {
    leftText(doc, label, cx + 3, cy + pt * 0.42, pt * 0.72, true, MUTED);
    leftText(doc, value, cx + 3, cy + row2 - 2.2, pt * 1.15, bold);
  };
  cell('ESCALA', `1:${l.scale}`, x, r1);
  cell('FORMATO', `${l.paperSize} · ${l.orientation === 'landscape' ? 'horizontal' : 'vertical'}`, split, r1, false);
  cell('FECHA', formatDate(date), x, r1 + row2, false);
  cell('HOJA', `${info.page} de ${info.pages}`, split, r1 + row2);
  leftText(doc, 'Diseñador de casa · cotas en metros', x + w - 3, y + h * 0.4, pt * 0.7, false, MUTED, 'right');
}

/** Cuadro de áreas at the top of the column; returns its bottom (mm). Long lists collapse the exterior group. */
function areaTable(doc: jsPDF, floor: Floor, box: Rect, pt: number): number {
  const sched = areaSchedule(floor);
  const { x, w } = box;
  let y = box.y;
  // rows: the title, each group's heading, rows and subtotal, then ≈ 5 rows for the total and its note
  const rowsFor = (collapse: boolean) =>
    sched.groups.reduce((n, g) => n + (collapse && g.title === 'Zonas exteriores' ? 1 : g.rows.length + 2), 0) + 6;
  const collapse = rowsFor(false) * pt * 0.55 > box.h;
  const rowsNeeded = rowsFor(collapse);
  const size = Math.min(pt, Math.max(5.5, box.h / rowsNeeded / 0.55));
  const rowH = size * 0.55;
  const maxRows = Math.floor(box.h / rowH) - 5;
  let used = 0;
  const num = (v: number) => formatMetres(v).replace(' m', '');
  doc.setLineWidth(0.25);
  doc.setDrawColor(INK);
  leftText(doc, 'CUADRO DE ÁREAS', x, y + rowH * 0.7, size * 1.15, true);
  leftText(doc, 'm²', x + w, y + rowH * 0.7, size, true, MUTED, 'right');
  y += rowH * 1.1; used++;
  doc.line(x, y, x + w, y);
  const line = (name: string, value: string, opts: { bold?: boolean; color?: string; indent?: number } = {}) => {
    if (used >= maxRows) return false;
    y += rowH;
    used++;
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const ind = opts.indent ?? 0;
    leftText(doc, clipText(doc, name, w - 18 - ind), x + ind, y - rowH * 0.28, size, opts.bold, opts.color);
    leftText(doc, value, x + w, y - rowH * 0.28, size, opts.bold, opts.color, 'right');
    return true;
  };
  for (const g of sched.groups) {
    if (collapse && g.title === 'Zonas exteriores') {
      line(`${g.title} (${g.rows.length})`, num(g.subtotal), { bold: true, color: MUTED });
      continue;
    }
    line(g.title.toUpperCase(), '', { bold: true, color: MUTED });
    for (const r of g.rows) if (!line(r.name, num(r.area), { indent: 2 })) break;
    doc.setLineWidth(0.1);
    doc.line(x + w - 22, y + 0.6, x + w, y + 0.6);
    line(`Subtotal ${g.title.toLowerCase()}`, num(g.subtotal), { bold: true, indent: 2 });
  }
  y += rowH * 0.4;
  doc.setLineWidth(0.35);
  doc.line(x, y, x + w, y);
  y += rowH;
  leftText(doc, 'TOTAL PLANTA', x, y - rowH * 0.25, size * 1.05, true);
  leftText(doc, num(sched.total), x + w, y - rowH * 0.25, size * 1.05, true, '#111418', 'right');
  leftText(doc, 'Interior + terrazas y balcones, medidos por dentro de los muros.', x, y + rowH * 0.6, size * 0.75, false, MUTED);
  return y + rowH * 1.2;
}

/** Wall footprints for the key plan. */
function footprints(floor: Floor): Vec2[][] {
  return floor.walls.map((w) => wallFootprint(w, isEndConnected(floor.walls, w.id, 'a'), isEndConnected(floor.walls, w.id, 'b')));
}

/** Small plan of the whole floor with the grid of sheets, this one shaded. */
function keyPlan(doc: jsPDF, l: PageLayout, floor: Floor, b: Bounds, current: Tile, box: Rect, pt: number) {
  leftText(doc, 'PLANO GUÍA', box.x, box.y + 3, pt * 0.8, true, MUTED);
  const top = box.y + 6;
  const all = l.tiles.map((t) => t.window);
  const ext = {
    minX: Math.min(b.minX, ...all.map((t) => t.minX)), maxX: Math.max(b.maxX, ...all.map((t) => t.maxX)),
    minY: Math.min(b.minY, ...all.map((t) => t.minY)), maxY: Math.max(b.maxY, ...all.map((t) => t.maxY)),
  };
  const s = Math.min(box.w / (ext.maxX - ext.minX), (box.h - 8) / (ext.maxY - ext.minY));
  const ox = box.x + (box.w - (ext.maxX - ext.minX) * s) / 2;
  const map = (p: Vec2) => ({ x: ox + (p.x - ext.minX) * s, y: top + (p.y - ext.minY) * s });
  l.tiles.forEach((t, i) => {
    const a = map({ x: t.window.minX, y: t.window.minY });
    const c = map({ x: t.window.maxX, y: t.window.maxY });
    doc.setLineWidth(0.2);
    doc.setDrawColor(MUTED);
    doc.setFillColor('#dfe5ef');
    doc.rect(a.x, a.y, c.x - a.x, c.y - a.y, t === current ? 'FD' : 'S');
    leftText(doc, String(i + 1), a.x + 1.5, a.y + pt * 0.45, pt * 0.9, t === current, t === current ? '#111418' : MUTED);
  });
  doc.setFillColor(INK);
  doc.setDrawColor(INK);
  doc.setLineWidth(0.05);
  for (const fp of footprints(floor)) path(doc, fp.map(map), 'FD', true);
}

export interface PdfOptions extends DrawingOptions {
  date?: Date;
  /** Paper size (default A1). */
  paper?: PaperSize;
  /** Scale (default 'auto': 1:50 when it fits one sheet, else 1:100). */
  scaleChoice?: ScaleChoice;
  /** Chained exterior dimensions (default true). */
  dimensions?: boolean;
}

/** Sheets per floor; each floor at the chosen scale, split across sheets when it does not fit. Returns the PDF bytes. */
export function exportPdf(project: Project, floors: Floor[], opts: PdfOptions = {}): ArrayBuffer {
  const date = opts.date ?? new Date();
  const paperSize = opts.paper ?? 'A1';
  const S = SHEET[paperSize];
  // Every floor at the same scale and in the same place on its sheet(s), so the plans can be laid one over the
  // other: the scale and the sheet grid come from all the floors together. Texts are sized by the scale, and
  // the bounds depend on them, so the scale is settled first on drawings at 1:100.
  const draw = (floor: Floor, scale: number) => buildDrawing(floor, {
    ...opts, scale, fitLabels: true,
    furniture: opts.furniture ?? false, wallDimensions: opts.wallDimensions ?? false, exteriorDimensions: opts.dimensions ?? true,
  });
  const EMPTY = { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  const union = (bs: (Bounds | null)[]): Bounds => {
    const real = bs.filter((x): x is Bounds => !!x);
    if (real.length === 0) return EMPTY;
    return {
      minX: Math.min(...real.map((x) => x.minX)), minY: Math.min(...real.map((x) => x.minY)),
      maxX: Math.max(...real.map((x) => x.maxX)), maxY: Math.max(...real.map((x) => x.maxY)),
    };
  };
  const scale = resolveScale(union(floors.map((f) => draw(f, 100).bounds)), paperSize, opts.scaleChoice ?? 'auto');
  const drawings = floors.map((f) => draw(f, scale));
  const all = union(drawings.map((d) => d.bounds));
  const layout = pageLayout(all, paperSize, scale);
  const plans = floors.map((floor, i) => ({ floor, d: drawings[i], b: drawings[i].bounds ?? all, l: layout }));
  const pages = plans.reduce((n, p) => n + p.l.tiles.length, 0);
  let doc: jsPDF | null = null;
  let page = 0;
  for (const { floor, d, b, l } of plans) {
    const k = 1000 / l.scale;
    l.tiles.forEach((tile, ti) => {
      page++;
      const format = [l.paper.w, l.paper.h];
      if (!doc) doc = new jsPDF({ orientation: l.orientation, unit: 'mm', format, compress: true });
      else doc.addPage(format, l.orientation);
      doc.setProperties({ title: `${project.name} - ${floor.name}`, creator: 'Diseñador de casa' });
      doc.setLineCap('round');
      doc.setLineJoin('round');
      // frame and column rule
      doc.setLineWidth(0.6);
      doc.setDrawColor(INK);
      doc.rect(S.margin / 2, S.margin / 2, l.paper.w - S.margin, l.paper.h - S.margin, 'S');
      doc.setLineWidth(0.25);
      doc.line(l.column.x - 4, l.column.y, l.column.x - 4, l.column.y + l.column.h);
      // plan, clipped to its area
      const clip = { x: l.area.x, y: l.area.y, w: l.area.w - 6, h: l.area.h };
      doc.saveGraphicsState();
      doc.rect(clip.x, clip.y, clip.w, clip.h, null);
      doc.clip();
      doc.discardPath();
      for (const layer of ORDER) drawPrims(doc, d.prims.filter((p) => p.layer === layer), tile.toPaper, k);
      doc.restoreGraphicsState();
      if (!d.bounds) centredText(doc, 'Esta planta todavía no tiene nada dibujado', { x: l.area.x + l.area.w / 2, y: l.paper.h / 2 }, 4);
      if (l.tiles.length > 1) continuations(doc, l, tile, clip, S.pt);
      // column, bottom up: title block, scale bar + north arrow, key plan, then the area schedule on top
      const info = { page, pages, part: ti + 1, parts: l.tiles.length };
      titleBlock(doc, l, project, floor, info, date);
      const c = l.column;
      const legendH = 26;
      const legendY = l.titleBlock.y - legendH - 4;
      scaleBar(doc, c.x, legendY + 8, l.scale, c.w - 34, S.pt);
      const arrow = northArrow({ x: c.x + c.w - 12, y: legendY + legendH / 2 + 1 }, 18, project.north);
      drawPrims(doc, arrow, (p) => p, 1);
      let bottom = legendY - 4;
      if (l.tiles.length > 1) {
        const kpH = Math.min(70, c.w * 0.55);
        keyPlan(doc, l, floor, b, tile, { x: c.x, y: bottom - kpH, w: c.w, h: kpH }, S.pt);
        bottom -= kpH + 6;
      }
      areaTable(doc, floor, { x: c.x, y: c.y + 2, w: c.w, h: bottom - c.y - 6 }, S.pt);
    });
  }
  if (!doc) throw new Error('No hay plantas para exportar');
  return (doc as jsPDF).output('arraybuffer');
}

/** «Continúa en la hoja N» on each edge that has a neighbouring part, and the edge drawn as a match line. */
function continuations(doc: jsPDF, l: PageLayout, tile: Tile, r: Rect, pt: number) {
  const at = (col: number, row: number) => l.tiles.findIndex((t) => t.col === col && t.row === row);
  const edges: { n: number; x1: number; y1: number; x2: number; y2: number; tx: number; ty: number; angle: number }[] = [];
  const left = at(tile.col - 1, tile.row);
  const right = at(tile.col + 1, tile.row);
  const up = at(tile.col, tile.row - 1);
  const down = at(tile.col, tile.row + 1);
  if (left >= 0) edges.push({ n: left, x1: r.x, y1: r.y, x2: r.x, y2: r.y + r.h, tx: r.x + 4, ty: r.y + r.h / 2, angle: -90 });
  if (right >= 0) edges.push({ n: right, x1: r.x + r.w, y1: r.y, x2: r.x + r.w, y2: r.y + r.h, tx: r.x + r.w - 4, ty: r.y + r.h / 2, angle: -90 });
  if (up >= 0) edges.push({ n: up, x1: r.x, y1: r.y, x2: r.x + r.w, y2: r.y, tx: r.x + r.w / 2, ty: r.y + 4, angle: 0 });
  if (down >= 0) edges.push({ n: down, x1: r.x, y1: r.y + r.h, x2: r.x + r.w, y2: r.y + r.h, tx: r.x + r.w / 2, ty: r.y + r.h - 4, angle: 0 });
  for (const e of edges) {
    doc.setLineWidth(0.35);
    doc.setDrawColor(MUTED);
    doc.setLineDashPattern([6, 1.5, 1, 1.5], 0);
    doc.line(e.x1, e.y1, e.x2, e.y2);
    doc.setLineDashPattern([], 0);
    const label = `Continúa en la parte ${e.n + 1}`;
    const hMm = (pt / PT_PER_MM) * 0.72;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(hMm * PT_PER_MM / 0.72);
    const tw = doc.getTextWidth(label) + 3;
    const [bw, bh] = e.angle === 0 ? [tw, hMm + 2.4] : [hMm + 2.4, tw];
    doc.setFillColor('#ffffff');
    doc.rect(e.tx - bw / 2, e.ty - bh / 2, bw, bh, 'F');
    doc.setTextColor(MUTED);
    centredText(doc, label, { x: e.tx, y: e.ty }, hMm, e.angle, true);
  }
}
