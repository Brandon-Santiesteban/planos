// 3D views of Casa Cesar versión 4 for the chat: node docs/casa-cesar-v4/vistas3d.mjs NN [puerto] [vista,vista…]
// Writes docs/casa-cesar-v4/3d-NN-<vista>.jpg (needs the dev server).
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const [N = '01', PORT = '5173'] = process.argv.slice(2);
// [name, eye, target] in world coordinates (x, height, plan y). The lot is x 0–7, y 0 (back) – 32 (street).
const VIEWS = [
  ['frente', [-6, 13, 48], [7.5, 2, 22]],
  ['aerea-atras', [26, 26, -10], [7.5, 0, 15]],
  ['aerea-lado', [16, 15, 21], [3.5, 1.5, 13]],
  ['terraza', [12.5, 9.5, 13.5], [3.5, 3.6, 19.5]],
  ['escalera', [5.0, 2.0, 13.2], [2.0, 1.8, 18.6]],
  ['jardin', [11.0, 6.5, 20.5], [3.0, 0.5, 14.5]],
  ['escalera-dentro', [1.6, 1.7, 25.6], [1.5, 1.3, 19.0]],
  ['sala', [1.5, 1.8, 22.2], [6.2, 1.0, 24.8]],
  ['cocina', [2.2, 1.9, 25.4], [5.8, 1.0, 20.2]],
  ['hab2', [4.6, 2.0, 11.6], [3.6, 0.8, 8.2]],
  ['principal', [6.2, 1.9, 2.6], [3.8, 0.9, 6.6]],
  ['banos', [3.3, 2.1, 5.3], [1.4, 0.6, 7.6]],
  ['noche-frente', [-5, 6, 40], [6, 2, 24], 'noche'],
];
const ONLY = process.argv[4] ? process.argv[4].split(',') : null;
const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://localhost:${PORT}/?p=casa-cesar-v4&vista=3d`);
await page.getByTestId('scene3d').locator('canvas').waitFor();
await page.addStyleTag({ content: '.view-3d *:not(:has(canvas)):not(canvas) { visibility: hidden !important; } .toasts { display: none !important; }' });
await page.waitForTimeout(2500);
for (const [name, eye, at, time] of VIEWS) {
  if (ONLY && !ONLY.includes(name)) continue;
  await page.evaluate(async ([eye, at, time]) => {
    const { useSceneOptions } = await import('/src/view3d/sceneOptions.ts');
    useSceneOptions.getState().set({ time: time ?? 'manana' });
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes('@react-three_fiber'));
    const { _roots } = await import(url);
    const s = _roots.get(document.querySelector('[data-testid="scene3d"] canvas')).store.getState();
    s.camera.position.set(...eye);
    s.controls.target.set(...at);
    s.controls.update();
  }, [eye, at, time]);
  await page.waitForTimeout(2500);
  const clip = await page.getByTestId('scene3d').boundingBox();
  await page.screenshot({ path: join(here, `3d-${N}-${name}.jpg`), type: 'jpeg', quality: 85, clip, timeout: 120000 });
  console.log(`3d-${N}-${name}.jpg`);
}
await browser.close();
if (errors.length) console.log(errors.join('\n'));
