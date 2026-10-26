// Floor plans to a PDF at a real scale: one A3 sheet per floor, with title block, north arrow and scale bar.
import { jsPDF } from 'jspdf';
import type { Floor, Project, Vec2 } from '../model/types';
import { buildDrawing, northArrow, type Bounds, type DrawingOptions, type Layer, type Prim } from './drawing';

export type Orientation = 'landscape' | 'portrait';

export interface PageLayout {
  scale: number;
  orientation: Orientation;
  /** sheet size in mm */
  paper: { w: number; h: number };
  /** where the plan goes, in mm */
  area: { x: number; y: number; w: number; h: number };
  titleBlock: { x: number; y: number; w: number; h: number };
  /** plan metres to sheet mm */
  toPaper(p: Vec2): Vec2;
}

const A3 = { long: 420, short: 297 };
const MARGIN = 10;
const BAND = 32; // bottom band: scale bar, north arrow and title block
const PAD = 6; // clear space around the plan inside its area
export const SCALES = [50, 100, 200, 500];

function sheet(orientation: Orientation) {
  const paper = orientation === 'landscape' ? { w: A3.long, h: A3.short } : { w: A3.short, h: A3.long };
  const area = { x: MARGIN, y: MARGIN, w: paper.w - 2 * MARGIN, h: paper.h - 2 * MARGIN - BAND - 4 };
  const titleBlock = { x: paper.w - MARGIN - 150, y: paper.h - MARGIN - BAND, w: 150, h: BAND };
  return { paper, area, titleBlock };
}

/** The largest standard scale (1:50, then 1:100, 1:200, 1:500) at which the plan fits on A3, turning the sheet if that helps. */
export function pageLayout(b: Bounds): PageLayout {
  const wM = b.maxX - b.minX;
  const hM = b.maxY - b.minY;
  const preferred: Orientation[] = wM >= hM ? ['landscape', 'portrait'] : ['portrait', 'landscape'];
  let pick: { scale: number; orientation: Orientation } | null = null;
  for (const scale of SCALES) {
    const k = 1000 / scale;
    const o = preferred.find((or) => {
      const { area } = sheet(or);
      return wM * k <= area.w - 2 * PAD && hM * k <= area.h - 2 * PAD;
    });
    if (o) { pick = { scale, orientation: o }; break; }
  }
  pick ??= { scale: SCALES[SCALES.length - 1], orientation: preferred[0] };
  const { paper, area, titleBlock } = sheet(pick.orientation);
  const k = 1000 / pick.scale;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const ox = area.x + area.w / 2;
  const oy = area.y + area.h / 2;
  return { ...pick, paper, area, titleBlock, toPaper: (p) => ({ x: ox + (p.x - cx) * k, y: oy + (p.y - cy) * k }) };
}

// ---- drawing on the sheet --------------------------------------------------------------------

const PT_PER_MM = 72 / 25.4;
const STYLE: Record<Layer, { width: number; color: string }> = {
  MUROS: { width: 0.35, color: '#1b1f24' },
  HUECOS: { width: 0.18, color: '#1b1f24' },
  HABITACIONES: { width: 0.13, color: '#5a6170' },
  MUEBLES: { width: 0.1, color: '#7a808c' },
  COTAS: { width: 0.1, color: '#333840' },
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

function leftText(doc: jsPDF, text: string, x: number, y: number, pt: number, bold = false, color = '#111418') {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(pt);
  doc.setTextColor(color);
  doc.text(text, x, y);
}

const MIN_TEXT_MM = 1.6;

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

function scaleBar(doc: jsPDF, x: number, y: number, scale: number) {
  const segments = 5;
  const segM = scale / 50; // 1 m at 1:50, 2 m at 1:100…
  const segMm = (segM * 1000) / scale;
  doc.setLineWidth(0.15);
  doc.setDrawColor('#1b1f24');
  doc.setFillColor('#1b1f24');
  for (let i = 0; i < segments; i++) doc.rect(x + i * segMm, y, segMm, 2.5, i % 2 === 0 ? 'FD' : 'S');
  doc.setTextColor('#1b1f24');
  for (let i = 0; i <= segments; i++) {
    const label = i === segments ? `${i * segM} m` : String(i * segM);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(label, x + i * segMm, y + 6.5, { align: i === segments ? 'left' : 'center' });
  }
  leftText(doc, 'Escala gráfica', x, y - 2.5, 7.5, false, '#566684');
}

const two = (n: number) => String(n).padStart(2, '0');
export const formatDate = (d: Date) => `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;

function titleBlock(doc: jsPDF, l: PageLayout, project: Project, floor: Floor, page: number, pages: number, date: Date) {
  const { x, y, w, h } = l.titleBlock;
  doc.setLineWidth(0.25);
  doc.setDrawColor('#1b1f24');
  doc.rect(x, y, w, h, 'S');
  const split = x + w - 46;
  doc.line(split, y, split, y + h);
  leftText(doc, project.name, x + 4, y + 9, 13, true);
  leftText(doc, floor.name, x + 4, y + 16.5, 10.5);
  leftText(doc, 'Diseñador de casa', x + 4, y + h - 4, 7.5, false, '#566684');
  leftText(doc, 'ESCALA', split + 4, y + 6, 6.5, true, '#566684');
  leftText(doc, `1:${l.scale}`, split + 4, y + 11.5, 11, true);
  leftText(doc, 'FECHA', split + 4, y + 17, 6.5, true, '#566684');
  leftText(doc, formatDate(date), split + 4, y + 21.5, 9);
  leftText(doc, `Hoja ${page} de ${pages} · A3`, split + 4, y + h - 3.5, 7, false, '#566684');
}

export interface PdfOptions extends DrawingOptions { date?: Date }

/** One A3 sheet per floor, each at the largest scale that fits. Returns the PDF bytes. */
export function exportPdf(project: Project, floors: Floor[], opts: PdfOptions = {}): ArrayBuffer {
  const date = opts.date ?? new Date();
  let doc: jsPDF | null = null;
  floors.forEach((floor, i) => {
    const d = buildDrawing(floor, opts);
    const l = pageLayout(d.bounds ?? { minX: 0, minY: 0, maxX: 1, maxY: 1 });
    if (!doc) doc = new jsPDF({ orientation: l.orientation, unit: 'mm', format: 'a3', compress: true });
    else doc.addPage('a3', l.orientation);
    doc.setProperties({ title: `${project.name} - ${floor.name}`, creator: 'Diseñador de casa' });
    doc.setLineCap('round');
    doc.setLineJoin('round');
    // frame
    doc.setLineWidth(0.5);
    doc.setDrawColor('#1b1f24');
    doc.rect(MARGIN / 2, MARGIN / 2, l.paper.w - MARGIN, l.paper.h - MARGIN, 'S');
    const k = 1000 / l.scale;
    for (const layer of ORDER) drawPrims(doc, d.prims.filter((p) => p.layer === layer), l.toPaper, k);
    if (!d.bounds) centredText(doc, 'Esta planta todavía no tiene nada dibujado', { x: l.paper.w / 2, y: l.paper.h / 2 }, 3);
    const bandY = l.paper.h - MARGIN - BAND;
    scaleBar(doc, MARGIN + 4, bandY + 16, l.scale);
    const arrow = northArrow({ x: MARGIN + 4 + 125, y: bandY + BAND / 2 + 2 }, 16, project.north);
    drawPrims(doc, arrow, (p) => p, 1);
    titleBlock(doc, l, project, floor, i + 1, floors.length, date);
  });
  if (!doc) throw new Error('No hay plantas para exportar');
  return (doc as jsPDF).output('arraybuffer');
}
