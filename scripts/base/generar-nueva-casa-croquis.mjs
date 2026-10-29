// Nueva casa, cleaned (user, 2026-10-29): only the user's own sketch of the 7 m house, first floor, as quick rooms
// (0,15 m walls, inside sizes as drawn), on a 7 × 34 m lot. The earlier designs (Lote 1/2 and propuestas 1 and 2)
// are kept in nueva-casa-propuestas.casa.json (scripts/base/generar-nueva-casa.mjs).
//
//   node scripts/base/generar-nueva-casa-croquis.mjs [puerto]     (needs a dev server, default :5173)
//
// Plan coordinates (wall centre lines, y 0 at the back, the street at the bottom), from the back to the street:
//   y 0–6,15      Habitación 15, 6 × 6
//   y 6,15–16,45  a 1 m strip on the left (x 0–1) beside Habitación 1 and Habitación 2, 5 × 5 each (x 1–6,15)
//   y 16,45–20,6  Patio, 6 × 4
//   y 20,6–26,75  Sala comedor, 6 × 6
//   y 26,75–32,9  Habitación 16 (1 × 2, x 0–1, at the top of the left strip) and the Parqueadero, 5 × 6 (x 1–6,15)
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const OUT = join(root, 'public/ejemplos/nueva-casa.casa.json');
const PORT = process.argv[2] ?? '5173';

const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://localhost:${PORT}`);
await page.waitForTimeout(800);

const json = await page.evaluate(async () => {
  const ops = await import('/src/model/ops.ts');
  const { siteAround } = await import('/src/model/site.ts');
  const { createEmptyProject } = await import('/src/model/defaults.ts');
  const { serializeProject } = await import('/src/persistence/projectFile.ts');
  const p = createEmptyProject('Nueva casa');
  const f = p.floors[0].id;
  ops.renameFloor(p, f, 'Primer piso');
  // [name, x, y (wall centre line of the top-left corner), inside width, inside length]
  const ROOMS = [
    ['Habitación 15', 0, 0, 6, 6],
    ['Pasillo lateral', 0, 6.15, 0.85, 10.15],
    ['Habitación 1', 1, 6.15, 5, 5],
    ['Habitación 2', 1, 11.3, 5, 5],
    ['Patio', 0, 16.45, 6, 4],
    ['Sala comedor', 0, 20.6, 6, 6],
    ['Habitación 16', 0, 26.75, 0.85, 2],
    ['Parqueadero', 1, 26.75, 5, 6],
  ];
  for (const [name, x, y, w, d] of ROOMS) if (!ops.addRectRoom(p, f, { x, y }, w, d, name)) throw new Error(name);
  p.site = siteAround(p, 7, 34, 'derecha');
  return serializeProject(p);
});
await browser.close();
if (errors.length) throw new Error(errors.join('\n'));
writeFileSync(OUT, json + '\n');
execFileSync(process.execPath, [join(root, 'scripts/nuevo-id-ejemplo.mjs'), OUT], { stdio: 'inherit' });
console.log(`Listo: ${OUT}`);
