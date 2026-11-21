// Sample architect PDF for an example house, with each page rendered to PNG to look at.
// Only runs on demand:  EXPORT_SAMPLE=1 npx vitest run src/export/muestra.test.ts
//   EXPORT_EXAMPLE=<name> (default casa-cesar-5), EXPORT_PAPER=A1|A2|A3, EXPORT_SCALE=auto|50|75|100|200,
//   EXPORT_OUT=<dir> (default docs/exportar-arquitecto), EXPORT_DPI (default 100).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Project } from '../model/types';
import { exportPdf, type PaperSize, type ScaleChoice } from './pdf';

const env = process.env;

test.skipIf(!env.EXPORT_SAMPLE)('sample PDF + PNG pages', { timeout: 600_000 }, async () => {
  const name = env.EXPORT_EXAMPLE ?? 'casa-cesar-5';
  const project = JSON.parse(readFileSync(join('public', 'ejemplos', `${name}.casa.json`), 'utf8')) as Project;
  const paper = (env.EXPORT_PAPER ?? 'A1') as PaperSize;
  const scale = (env.EXPORT_SCALE && env.EXPORT_SCALE !== 'auto' ? Number(env.EXPORT_SCALE) : 'auto') as ScaleChoice;
  const out = env.EXPORT_OUT ?? join('docs', 'exportar-arquitecto');
  mkdirSync(out, { recursive: true });
  const floors = project.floors.filter((f) => f.walls.length + f.rooms.length > 0);
  const bytes = exportPdf(project, floors, { paper, scaleChoice: scale, furniture: env.EXPORT_FURNITURE === '1' });
  const base = `${name}-${paper}-${env.EXPORT_SCALE ?? 'auto'}`;
  writeFileSync(join(out, `${base}.pdf`), new Uint8Array(bytes));

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { createCanvas } = await import('@napi-rs/canvas');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
  const dpi = Number(env.EXPORT_DPI ?? 100);
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: dpi / 72 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvas: canvas as any, canvasContext: ctx as any, viewport }).promise;
    writeFileSync(join(out, `${base}-p${i}.png`), canvas.toBuffer('image/png'));
  }
});
