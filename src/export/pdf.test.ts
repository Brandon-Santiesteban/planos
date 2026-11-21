import type { Floor, Project, Wall } from '../model/types';
import { exportPdf, pageLayout } from './pdf';

const box = (w: number, h: number) => ({ minX: 0, minY: 0, maxX: w, maxY: h });

describe('pageLayout', () => {
  test('defaults to A1 landscape, 1:50 when the floor fits one sheet', () => {
    const l = pageLayout(box(10, 8));
    expect(l.paperSize).toBe('A1');
    expect(l.scale).toBe(50);
    expect(l.orientation).toBe('landscape');
    expect(l.paper).toEqual({ w: 841, h: 594 });
    expect(l.tiles).toHaveLength(1);
  });

  test('auto falls back to 1:100 when 1:50 would need more than one sheet', () => {
    const l = pageLayout(box(31, 32));
    expect(l.scale).toBe(100);
    expect(l.tiles).toHaveLength(1);
  });

  test('a fixed scale that does not fit is split across sheets with overlap, never shrunk', () => {
    const l = pageLayout(box(31, 32), 'A3', 100);
    expect(l.scale).toBe(100);
    expect(l.paper.w * l.paper.h).toBe(420 * 297);
    expect(l.tiles.length).toBeGreaterThan(1);
    expect(l.cols * l.rows).toBe(l.tiles.length);
    // the windows cover the plan and neighbours overlap
    const xs = l.tiles.filter((t) => t.row === 0).map((t) => t.window);
    expect(xs.length).toBeGreaterThan(1);
    expect(Math.min(...l.tiles.map((t) => t.window.minX))).toBeLessThanOrEqual(1e-9);
    expect(Math.max(...l.tiles.map((t) => t.window.maxX))).toBeGreaterThanOrEqual(31 - 1e-9);
    expect(Math.min(...l.tiles.map((t) => t.window.minY))).toBeLessThanOrEqual(1e-9);
    expect(Math.max(...l.tiles.map((t) => t.window.maxY))).toBeGreaterThanOrEqual(32 - 1e-9);
    for (let i = 1; i < xs.length; i++) expect(xs[i - 1].maxX - xs[i].minX).toBeGreaterThanOrEqual(0.3 - 1e-9); // ≥ 30 mm at 1:100
    // 1 m on the plan is 10 mm on every sheet
    const t = l.tiles[0];
    expect(t.toPaper({ x: 1, y: 0 }).x - t.toPaper({ x: 0, y: 0 }).x).toBeCloseTo(10);
  });

  test('a long narrow plan turns the sheet when that saves sheets', () => {
    const l = pageLayout(box(6, 30), 'A1', 50);
    expect(l.orientation).toBe('portrait');
  });

  test('a plan that fits is centred in the plan area, which is clear of the column', () => {
    const l = pageLayout({ minX: 2, minY: 3, maxX: 12, maxY: 11 }, 'A3', 50);
    const t = l.tiles[0];
    const tl = t.toPaper({ x: 2, y: 3 });
    const br = t.toPaper({ x: 12, y: 11 });
    expect(br.x - tl.x).toBeCloseTo(200); // 10 m at 1:50 = 200 mm
    expect(br.y - tl.y).toBeCloseTo(160);
    expect((tl.y + br.y) / 2).toBeCloseTo(l.area.y + l.area.h / 2);
    expect(l.area.x + l.area.w).toBeLessThanOrEqual(l.column.x);
    expect(l.titleBlock.x).toBe(l.column.x);
  });
});

const w = (id: string, ax: number, ay: number, bx: number, by: number): Wall =>
  ({ id, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 0.15, height: null });

const floor = (name: string): Floor => ({
  id: name, name, height: 2.6, background: null, furniture: [],
  walls: [w('1', 0, 0, 4, 0), w('2', 4, 0, 4, 3), w('3', 4, 3, 0, 3), w('4', 0, 3, 0, 0)],
  openings: [{ id: 'd', wallId: '1', kind: 'door', offset: 1, width: 0.8, height: 2.1, sill: 0 }],
  rooms: [{ id: 'r', name: 'Sala', kind: 'room', points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }] }],
});

const project: Project = { version: 1, id: 'p', name: 'Casa de prueba', north: 30, floors: [floor('Planta baja'), floor('Segundo piso')] };

async function pdfText(bytes: ArrayBuffer): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    pages.push(c.items.map((it) => ('str' in it ? it.str : '')).join(' '));
  }
  return pages;
}

// Builds a real PDF and reads it back with pdf.js: slow on a busy machine.
test('exportPdf writes one sheet per floor with title block, area schedule and chained dimensions', { timeout: 60_000 }, async () => {
  const bytes = exportPdf(project, project.floors, { date: new Date(2026, 9, 25) });
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  const pages = await pdfText(bytes);
  expect(pages).toHaveLength(2);
  expect(pages[0]).toContain('Casa de prueba');
  expect(pages[0]).toContain('Planta baja');
  expect(pages[1]).toContain('Segundo piso');
  expect(pages[0]).toContain('1:50');
  expect(pages[0]).toContain('A1');
  expect(pages[0]).toContain('1 de 2');
  expect(pages[1]).toContain('2 de 2');
  expect(pages[0]).toContain('25/10/2026');
  expect(pages[0]).toContain('Diseñador de casa');
  expect(pages[0]).toContain('Sala');
  expect(pages[0]).toContain('12,00 m²');
  expect(pages[0]).toContain('CUADRO DE ÁREAS');
  expect(pages[0]).toContain('TOTAL PLANTA');
  expect(pages[0]).toContain('4,15'); // overall exterior dimension: 4 m between axes + two half walls
});

test('a floor too big for the sheet at the chosen scale is split, with a key plan and «parte x de y»', { timeout: 60_000 }, async () => {
  const big: Floor = { ...floor('Grande'), walls: [w('1', 0, 0, 60, 0), w('2', 60, 0, 60, 3), w('3', 60, 3, 0, 3), w('4', 0, 3, 0, 0)], openings: [] };
  const bytes = exportPdf({ ...project, floors: [big] }, [big], { paper: 'A3', scaleChoice: 100 });
  const pages = await pdfText(bytes);
  expect(pages.length).toBeGreaterThan(1);
  expect(pages[0]).toContain('parte 1 de');
  expect(pages[0]).toContain('PLANO GUÍA');
  expect(pages[0]).toContain('Continúa en la parte 2');
  expect(pages[0]).toContain('1:100');
});
