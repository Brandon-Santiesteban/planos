// Screenshots of the complete house: the 2D plan of each floor and several 3D views, into docs/casa-completa/.
//   node scripts/casa-completa-capturas.mjs [puerto]      (needs the dev server: npx vite --port 5187 --strictPort)
// The 3D camera is placed through react-three-fiber's store (dev server only), so the views are repeatable.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'docs/casa-completa');
const PORT = process.argv[2] ?? '5187';
const URL = `http://localhost:${PORT}/?abrir=ejemplos/casa-completa.casa.json`;
mkdirSync(OUT, { recursive: true });

const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];

// ---- 2D, one floor at a time (tall window: the lot is 20 m deep) ----
{
  const page = await browser.newPage({ viewport: { width: 1100, height: 1300 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL);
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Ampliar' }).first().click();
  await page.waitForTimeout(500);
  for (const [floor, file] of [['Primer piso', 'plano-piso-1.png'], ['Segundo piso', 'plano-piso-2.png'], ['Tercer piso', 'plano-piso-3.png']]) {
    await page.getByText(floor, { exact: true }).click();
    await page.waitForTimeout(700);
    await page.locator('.view-2d').screenshot({ path: join(OUT, file) });
  }
  await page.close();
}

// ---- 3D ----
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${URL}&vista=3d`);
await page.waitForTimeout(4000);
const scene = page.getByTestId('scene3d');
/** Camera at `eye` looking at `at`, world coordinates (x, height, plan y). */
const camera = (eye, at) =>
  page.evaluate(async ([eye, at]) => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes('@react-three_fiber'));
    const { _roots } = await import(url);
    const s = _roots.get(document.querySelector('[data-testid="scene3d"] canvas')).store.getState();
    s.camera.position.set(...eye);
    s.controls.target.set(...at);
    s.controls.update();
  }, [eye, at]);
const shot = async (file, eye, at) => {
  await camera(eye, at);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, file), clip: await scene.boundingBox() });
};
const floor = async (name) => {
  await page.getByText(name, { exact: true }).click();
  await page.waitForTimeout(800);
};

// Whole house (top floor active: everything visible).
await shot('3d-frente.png', [-10, 13, 21], [2.75, 3, 1]);
await shot('3d-fondo-piscina.png', [-3, 15, -17], [2, 0, -8]);
await shot('3d-mirador-sobre-modulo-1.png', [-7, 11, 8], [2.75, 5.5, -2]);
// Floor by floor from above (the floors above hidden).
await floor('Primer piso');
await shot('3d-piso-1.png', [-6, 17, 9], [2.75, 0, -1]);
await shot('3d-piso-1-modulo-2.png', [-4, 9, -1], [2.5, 0, -6.5]);
await floor('Segundo piso');
await shot('3d-piso-2.png', [-6, 19, 9], [2.75, 2.6, -1]);
await shot('3d-patio-de-luz.png', [-3.5, 10, -1.3], [3.2, 0.3, -1.3]);
await floor('Tercer piso');
await shot('3d-piso-3.png', [-6, 21, 9], [2.75, 5.2, -1]);
await page.getByRole('radio', { name: 'Noche' }).click();
await shot('3d-noche-tercer-piso.png', [-6, 21, 9], [2.75, 5.2, -1]);
await floor('Cubierta (techo módulo 2)');
await shot('3d-noche.png', [-10, 13, 21], [2.75, 3, 1]);
await shot('3d-noche-piscina.png', [-3, 15, -17], [2, 0, -8]);
console.log(errors.length ? errors.join('\n') : `Capturas en ${OUT}`);
await browser.close();
