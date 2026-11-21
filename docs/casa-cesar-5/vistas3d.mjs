// 3D views of Casa Cesar 5 for the chat: node docs/casa-cesar-5/vistas3d.mjs NN [puerto] [vista,vista…]
// Writes docs/casa-cesar-5/3d-NN-<vista>.jpg (needs the dev server).
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const [N = '01', PORT = '5173'] = process.argv.slice(2);
// [name, eye, target] in world coordinates (x, height, plan y). The site is x 0–31, y 0 (back) – 32,26 (street).
const VIEWS = [
  ['frente', [8, 16, 58], [15.5, 2, 20]],
  ['aerea-atras', [34, 30, -14], [15.5, 0, 15]],
  ['planta', [15.5, 62, 16.5], [15.5, 0, 16.4]],
  ['piscina-terraza', [22, 9, 1], [10.5, 1.5, 11.5]],
  ['bbq-jardin', [27, 7, 15.5], [19, 1.2, 7]],
  ['comedor-e10', [7.5, 1.7, 15], [13, 1.0, 17]],
  ['terraza-privada', [14, 7, 34], [6, 3.5, 25]],
  ['noche-frente', [6, 8, 50], [15.5, 2, 22], 'noche'],
];
const ONLY = process.argv[4] ? process.argv[4].split(',') : null;
const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://localhost:${PORT}/?p=casa-cesar-5&vista=3d`);
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
