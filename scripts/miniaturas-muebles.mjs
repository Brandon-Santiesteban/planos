// Catalog pictures: public/muebles/<id>.png, each piece drawn by its own 3D model (src/furniture/thumbStudio.tsx).
// Run it after adding or changing pieces of the catalog:
//   node scripts/miniaturas-muebles.mjs [puerto] [id...]     (needs the dev server, default :5173)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public/muebles');
const [PORT = '5173', ...ids] = process.argv.slice(2);

const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://localhost:${PORT}/?biblioteca`);
await page.waitForTimeout(1500);
const shots = await page.evaluate(async (ids) => {
  const { renderThumbs } = await import('/src/furniture/thumbStudio.tsx');
  return renderThumbs(ids.length ? ids : undefined);
}, ids);
await browser.close();
mkdirSync(OUT, { recursive: true });
for (const [id, url] of Object.entries(shots)) writeFileSync(join(OUT, `${id}.png`), Buffer.from(url.split(',')[1], 'base64'));
console.log(errors.length ? errors.join('\n') : `${Object.keys(shots).length} miniaturas en ${OUT}`);
