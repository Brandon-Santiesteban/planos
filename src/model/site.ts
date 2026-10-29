import type { Project, Site } from './types';

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

/** Common lot sizes (width across the front × depth), plus the ones of the projects in this app. */
export const SITE_PRESETS: { label: string; width: number; depth: number }[] = [
  { label: '6 × 12 m', width: 6, depth: 12 },
  { label: '7 × 14 m', width: 7, depth: 14 },
  { label: '7 × 22 m', width: 7, depth: 22 },
  { label: '7 × 34 m', width: 7, depth: 34 },
  { label: '7,66 × 60 m', width: 7.66, depth: 60 },
  { label: '8 × 16 m', width: 8, depth: 16 },
  { label: '10 × 20 m', width: 10, depth: 20 },
  { label: '12 × 24 m', width: 12, depth: 24 },
  { label: '15 × 15 m', width: 15, depth: 15 },
  { label: '15 × 32 m', width: 15, depth: 32 },
];

/** What is built, on every floor: walls to their outer faces and every room that isn't open ground. */
export function drawingBounds(p: Project): Bounds | null {
  let b: Bounds | null = null;
  const grow = (x: number, y: number, r = 0) => {
    if (!b) b = { minX: x - r, minY: y - r, maxX: x + r, maxY: y + r };
    else b = { minX: Math.min(b.minX, x - r), minY: Math.min(b.minY, y - r), maxX: Math.max(b.maxX, x + r), maxY: Math.max(b.maxY, y + r) };
  };
  for (const f of p.floors) {
    for (const w of f.walls) for (const q of [w.a, w.b]) grow(q.x, q.y, w.thickness / 2);
    for (const r of f.rooms) if (r.kind !== 'exterior') for (const q of r.points) grow(q.x, q.y);
  }
  return b;
}

export type SiteAlign = 'izquierda' | 'centro' | 'derecha';

/** A lot of the given size around the drawing: its front on the drawing's front (the street, +y), sideways as asked. */
export function siteAround(p: Project, width: number, depth: number, align: SiteAlign = 'izquierda'): Site {
  const b = drawingBounds(p);
  if (!b) return { x: 0, y: 0, width, depth };
  const x = align === 'izquierda' ? b.minX : align === 'derecha' ? b.maxX - width : (b.minX + b.maxX - width) / 2;
  return { x: round(x), y: round(b.maxY - depth), width, depth };
}

/** The smallest lot that holds the whole drawing, rounded out to 5 cm. */
export function siteFittingDrawing(p: Project): Site | null {
  const b = drawingBounds(p);
  if (!b) return null;
  const x0 = Math.floor(b.minX * 20 - 1e-6) / 20;
  const y0 = Math.floor(b.minY * 20 - 1e-6) / 20;
  const x1 = Math.ceil(b.maxX * 20 + 1e-6) / 20;
  const y1 = Math.ceil(b.maxY * 20 + 1e-6) / 20;
  return { x: x0, y: y0, width: round(x1 - x0), depth: round(y1 - y0) };
}

/** How far the drawing sticks out of the lot on each side (0 where it fits); null without a lot or a drawing. */
export function siteOverflow(p: Project): { izquierda: number; derecha: number; fondo: number; frente: number } | null {
  const b = drawingBounds(p);
  const s = p.site;
  if (!b || !s) return null;
  const out = (v: number) => (v > 0.005 ? round(v) : 0);
  return {
    izquierda: out(s.x - b.minX),
    derecha: out(b.maxX - (s.x + s.width)),
    fondo: out(s.y - b.minY),
    frente: out(b.maxY - (s.y + s.depth)),
  };
}

export function setSite(p: Project, site: Site | null): void {
  if (site) p.site = { x: round(site.x), y: round(site.y), width: site.width, depth: site.depth };
  else delete p.site;
}

function round(v: number) {
  return Math.round(v * 1000) / 1000 + 0;
}
