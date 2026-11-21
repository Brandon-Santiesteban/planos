// «Foto del plano»: a clean picture of one floor's drawing (no UI), framed to its content, as a PNG.
import type { Floor, Project, Vec2 } from '../../model/types';
import type { Bounds } from '../viewport';

/** What goes into the picture. */
export interface PhotoOptions {
  grid: boolean;
  dimensions: boolean;
  names: boolean;
  area: boolean;
  furniture: boolean;
  background: boolean;
  site: boolean;
  below: boolean;
}

export const DEFAULT_PHOTO_OPTIONS: Omit<PhotoOptions, 'area'> = {
  grid: false,
  dimensions: true,
  names: true,
  furniture: true,
  background: false,
  site: true,
  below: false,
};

/** Long side of the drawing area in SVG units (CSS px); labels are sized as on screen at this zoom. */
export const DRAW_LONG = 1200;
/** The PNG is rendered this many times larger than the SVG units: a long side of about 3600 px. */
export const PHOTO_SCALE = 3;
/** Blank space around the drawing (room for dimension and lot labels outside the walls). */
export const MARGIN = 56;
/** Height of the band at the bottom with the caption, the scale bar and the north arrow. */
export const CAPTION = 76;
/** Narrowest picture, so the caption fits beside a long, thin house. */
export const MIN_WIDTH = 560;
/** Zoom cap for tiny floors (px per metre in SVG units). */
const MAX_K = 160;

/** Everything drawn for `floor` with these options, in metres. */
export function photoBounds(project: Project, floorIndex: number, opts: PhotoOptions): Bounds | null {
  const floor = project.floors[floorIndex];
  if (!floor) return null;
  const pts: Vec2[] = [];
  const addWalls = (f: Floor) => {
    for (const w of f.walls) {
      const t = w.thickness / 2;
      for (const p of [w.a, w.b]) pts.push({ x: p.x - t, y: p.y - t }, { x: p.x + t, y: p.y + t });
    }
  };
  addWalls(floor);
  for (const r of floor.rooms) pts.push(...r.points);
  if (opts.furniture) {
    for (const f of floor.furniture ?? []) {
      const h = Math.hypot(f.width, f.depth) / 2;
      pts.push({ x: f.x - h, y: f.y - h }, { x: f.x + h, y: f.y + h });
    }
  }
  if (opts.site && project.site) {
    const s = project.site;
    pts.push({ x: s.x, y: s.y }, { x: s.x + s.width, y: s.y + s.depth });
  }
  if (opts.below && floorIndex > 0) addWalls(project.floors[floorIndex - 1]);
  if (opts.background && floor.background) {
    const b = floor.background;
    pts.push(b.origin, { x: b.origin.x + b.widthPx * b.metresPerPixel, y: b.origin.y + b.heightPx * b.metresPerPixel });
  }
  if (!pts.length) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

export interface PhotoLayout {
  /** SVG size in CSS px (the PNG is PHOTO_SCALE times larger) */
  width: number;
  height: number;
  /** px per metre */
  k: number;
  /** world → SVG transform of the drawing */
  transform: string;
}

/** Size of the picture and the zoom that fits the bounds in it. */
export function photoLayout(b: Bounds): PhotoLayout {
  const bw = Math.max(b.maxX - b.minX, 0.5);
  const bh = Math.max(b.maxY - b.minY, 0.5);
  const k = Math.min(MAX_K, (DRAW_LONG - 2 * MARGIN) / Math.max(bw, bh));
  const width = Math.max(MIN_WIDTH, Math.round(bw * k + 2 * MARGIN));
  const height = Math.round(bh * k + 2 * MARGIN + CAPTION);
  const ox = (width - bw * k) / 2;
  return { width, height, k, transform: `translate(${ox} ${MARGIN}) scale(${k}) translate(${-b.minX} ${-b.minY})` };
}

/** A round length for the scale bar, about 80–200 px long at `k`. */
export function scaleBarLength(k: number): number {
  for (const m of [0.5, 1, 2, 5, 10, 20, 50]) if (m * k >= 80) return m;
  return 100;
}

export function photoFileName(project: Project, floor: Floor): string {
  const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '').trim();
  return `${clean(project.name) || 'Plano'} - ${clean(floor.name) || 'Planta'}.png`;
}

// ---------- SVG → PNG ----------

/** Presentation properties copied from the page's stylesheet onto each element (a serialized SVG can't see it). */
const PROPS = [
  'fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width', 'stroke-dasharray', 'stroke-linejoin', 'stroke-linecap',
  'opacity', 'paint-order', 'filter', 'font-family', 'font-size', 'font-weight', 'font-variant-numeric',
] as const;

/**
 * Copies the computed styles of `src` onto the matching nodes of `dst`. Inside the drawing (the element marked
 * `data-mundo`, scaled by its `data-k` px per metre), non-scaling strokes are converted to plain strokes in metres
 * so the picture keeps its proportions at any resolution.
 */
export function inlineStyles(src: Element, dst: Element, k = 1, inWorld = false) {
  const world = inWorld || src.hasAttribute('data-mundo');
  const kk = src.hasAttribute('data-k') ? Number(src.getAttribute('data-k')) : k;
  const cs = getComputedStyle(src);
  const style: string[] = [];
  const fixed = world && cs.getPropertyValue('vector-effect') === 'non-scaling-stroke';
  for (const p of PROPS) {
    let v = cs.getPropertyValue(p);
    if (!v) continue;
    if (fixed && p === 'stroke-width') v = String(parseFloat(v) / kk);
    if (fixed && p === 'stroke-dasharray' && v !== 'none') v = v.split(/[\s,]+/).filter(Boolean).map((n) => String(parseFloat(n) / kk)).join(' ');
    style.push(`${p}:${v}`);
  }
  dst.setAttribute('style', style.join(';'));
  dst.removeAttribute('class');
  for (let i = 0; i < src.children.length; i++) inlineStyles(src.children[i], dst.children[i], kk, world);
}

/** Standalone SVG text of `svg` with its styles inlined, `scale` times larger. */
export function serializePhoto(svg: SVGSVGElement, scale: number): { xml: string; width: number; height: number } {
  const w = Number(svg.getAttribute('width'));
  const h = Number(svg.getAttribute('height'));
  const copy = svg.cloneNode(true) as SVGSVGElement;
  inlineStyles(svg, copy);
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('viewBox', `0 0 ${w} ${h}`);
  copy.setAttribute('width', String(w * scale));
  copy.setAttribute('height', String(h * scale));
  copy.removeAttribute('style');
  return { xml: new XMLSerializer().serializeToString(copy), width: Math.round(w * scale), height: Math.round(h * scale) };
}

/** Draws the picture onto a white canvas and returns it as a PNG. */
export async function svgToPng(svg: SVGSVGElement, scale = PHOTO_SCALE): Promise<Blob> {
  const { xml, width, height } = serializePhoto(svg, scale);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no permite dibujar la imagen');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png'));
}
