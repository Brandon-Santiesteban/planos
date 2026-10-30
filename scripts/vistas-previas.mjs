// 3D preview of each project in public/ejemplos for the Mis proyectos gallery, into public/ejemplos/vistas/<name>.jpg.
//   node scripts/vistas-previas.mjs [puerto] [nombre ...]      (needs the dev server; no names = every project)
// Run it after changing a project so its card shows the new look.
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public/ejemplos/vistas');
const [PORT = '5173', ...only] = process.argv.slice(2);
const BASE = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });

const catalog = await (await fetch(`${BASE}/ejemplos/catalogo.json`)).json();
const names = catalog.map((c) => c.file.match(/^ejemplos\/(.+)\.casa\.json$/)?.[1]).filter((n) => n && (!only.length || only.includes(n)));

const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];

/** Camera from the street side, front-left and above, close enough for the house to fill the picture. */
function frameHouse(page, project) {
  // The house itself: streets, gardens and pools (exterior zones) left out.
  const pts = project.floors.flatMap((f) => [...f.walls.flatMap((w) => [w.a, w.b]), ...f.rooms.filter((r) => r.kind !== 'exterior').flatMap((r) => r.points)]);
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const height = project.floors.reduce((h, f) => h + f.height, 0);
  const [cx, cy] = [(minX + maxX) / 2, (minY + maxY) / 2];
  const r = Math.max(Math.hypot(maxX - minX, maxY - minY, height) / 2, 4);
  const dir = [-0.5, 0.62, 0.8];
  const len = Math.hypot(...dir);
  const eye = [cx + (dir[0] / len) * r * 1.9, height * 0.35 + (dir[1] / len) * r * 1.9, cy + (dir[2] / len) * r * 1.9];
  const at = [cx, height * 0.3, cy];
  // Through react-three-fiber's store (dev server only), as in casa-completa-capturas.mjs.
  return page.evaluate(async ([eye, at]) => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes('@react-three_fiber'));
    const { _roots } = await import(url);
    const s = _roots.get(document.querySelector('[data-testid="scene3d"] canvas')).store.getState();
    s.camera.position.set(...eye);
    s.controls.target.set(...at);
    s.controls.update();
  }, [eye, at]);
}

for (const name of names) {
  // A fresh context each time: no saved copies, the file itself is shown.
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  await page.goto(`${BASE}/?p=${name}&vista=3d`);
  await page.getByTestId('scene3d').locator('canvas').waitFor();
  // Only the picture: hide the labels and buttons drawn over the 3D view.
  await page.addStyleTag({ content: '.view-3d *:not(:has(canvas)):not(canvas) { visibility: hidden !important; } .toasts { display: none !important; }' });
  await page.waitForTimeout(2500);
  await frameHouse(page, JSON.parse(readFileSync(join(root, 'public/ejemplos', `${name}.casa.json`), 'utf8')));
  await page.waitForTimeout(2500);
  const clip = await page.getByTestId('scene3d').boundingBox();
  await page.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 82, clip, timeout: 120000 });
  await context.close();
  console.log(`vistas/${name}.jpg`);
}
console.log(errors.length ? errors.join('\n') : `Vistas en ${OUT}`);
await browser.close();
