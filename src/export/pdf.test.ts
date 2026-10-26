import type { Floor, Project, Wall } from '../model/types';
import { exportPdf, pageLayout } from './pdf';

const box = (w: number, h: number) => ({ minX: 0, minY: 0, maxX: w, maxY: h });

describe('pageLayout (A3)', () => {
  test('a small house fits at 1:50 landscape', () => {
    const l = pageLayout(box(10, 8));
    expect(l.scale).toBe(50);
    expect(l.orientation).toBe('landscape');
    expect(l.paper).toEqual({ w: 420, h: 297 });
  });

  test('a long narrow house turns the sheet to portrait before changing the scale', () => {
    const l = pageLayout(box(8, 17));
    expect(l.scale).toBe(50);
    expect(l.orientation).toBe('portrait');
    expect(l.paper).toEqual({ w: 297, h: 420 });
  });

  test('falls back to 1:100 and then 1:200', () => {
    expect(pageLayout(box(25, 18)).scale).toBe(100);
    expect(pageLayout(box(60, 40)).scale).toBe(200);
  });

  test('the drawing is centred inside the drawing area, clear of the title block', () => {
    const l = pageLayout({ minX: 2, minY: 3, maxX: 12, maxY: 11 });
    const tl = l.toPaper({ x: 2, y: 3 });
    const br = l.toPaper({ x: 12, y: 11 });
    expect(br.x - tl.x).toBeCloseTo(200); // 10 m at 1:50 = 200 mm
    expect(br.y - tl.y).toBeCloseTo(160);
    expect((tl.x + br.x) / 2).toBeCloseTo(l.area.x + l.area.w / 2);
    expect((tl.y + br.y) / 2).toBeCloseTo(l.area.y + l.area.h / 2);
    expect(l.area.y + l.area.h).toBeLessThan(l.titleBlock.y);
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

test('exportPdf writes one A3 page per floor with title block, scale and dimensions', async () => {
  const bytes = exportPdf(project, project.floors, { date: new Date(2026, 9, 25) });
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  const pages = await pdfText(bytes);
  expect(pages).toHaveLength(2);
  expect(pages[0]).toContain('Casa de prueba');
  expect(pages[0]).toContain('Planta baja');
  expect(pages[1]).toContain('Segundo piso');
  expect(pages[0]).toContain('1:50');
  expect(pages[0]).toContain('25/10/2026');
  expect(pages[0]).toContain('Diseñador de casa');
  expect(pages[0]).toContain('Sala');
  expect(pages[0]).toContain('12,00 m²');
  expect(pages[0]).toContain('4,00');
});
