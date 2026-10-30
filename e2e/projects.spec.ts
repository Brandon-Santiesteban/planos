import { expect, test } from '@playwright/test';

async function drawWall(page: import('@playwright/test').Page, length: string) {
  await page.getByTestId('tool-wall').click();
  const box = (await page.getByTestId('plan2d').boundingBox())!;
  await page.mouse.click(box.x + 120, box.y + 200);
  await page.mouse.move(box.x + 300, box.y + 200);
  await page.keyboard.type(length);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
}

test('starting a new project keeps the previous one in Mis proyectos', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => indexedDB.deleteDatabase('keyval-store'));
  await page.reload();
  // A browser with nothing open starts on Mis proyectos.
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  await drawWall(page, '4');
  await expect(page.getByTestId('estado-guardado')).toContainText('Guardado');

  await page.getByRole('button', { name: 'Nuevo' }).click();
  await expect(page.getByTestId('plan2d').getByText('4,00 m')).toHaveCount(0);
  await drawWall(page, '2');
  await expect(page.getByTestId('estado-guardado')).toContainText('Guardado');

  await page.getByRole('button', { name: 'Mis proyectos' }).click();
  const dialog = page.getByRole('dialog');
  const own = dialog.locator('section').filter({ hasText: 'Mis dibujos' }).locator('.ficha-abrir');
  await expect(own).toHaveCount(2);
  await own.and(page.locator(':not([disabled])')).click();
  await expect(page.getByTestId('plan2d').getByText('4,00 m')).toBeVisible();

  await page.reload(); // the last opened project comes back
  await expect(page.getByTestId('plan2d').getByText('4,00 m')).toBeVisible();
});

test('a project link always shows the latest version of its file, and the gallery lists the app projects', async ({ page }) => {
  await page.goto('/?p=casa-etapa-1');
  await expect(page).toHaveURL(/\?p=casa-etapa-1/);
  await page.reload(); // the link stays in the address bar
  await expect(page).toHaveURL(/\?p=casa-etapa-1/);
  await page.getByRole('button', { name: 'Mis proyectos' }).click();
  const app = page.getByRole('dialog').locator('section').filter({ hasText: 'Proyectos de la app' });
  await expect(app.getByRole('button', { name: 'Abrir Casa CJ' })).toBeVisible();
  await app.getByRole('button', { name: 'Abrir Casa CJ' }).click();
  await expect(page).toHaveURL(/\?p=casa-cj/);
});

test('drawings are saved on the PC: another address (another link) lists them too', async ({ page, browser }) => {
  await page.goto('/?biblioteca');
  await page.getByRole('button', { name: 'Proyecto nuevo' }).click();
  page.once('dialog', (d) => void d.accept('Croquis compartido'));
  await page.locator('.project-name').click();
  await drawWall(page, '3');
  await expect(page.getByTestId('estado-guardado')).toContainText('Guardado');

  // 127.0.0.1 is a different origin for the browser: its own (empty) storage, like a new tunnel link.
  const other = await browser.newPage();
  await other.goto('http://127.0.0.1:5175/?biblioteca');
  await expect(other.getByRole('button', { name: 'Abrir Croquis compartido' })).toBeVisible();
  await other.close();
});

test('a project is renamed from its card without losing its drawing or its link', async ({ page }) => {
  await page.goto('/?biblioteca');
  const app = page.getByRole('dialog').locator('section').filter({ hasText: 'Proyectos de la app' });
  await app.getByRole('button', { name: 'Cambiar nombre de Casa etapa 1' }).click();
  await page.getByLabel('Nombre del proyecto').fill('Casa etapa 1 (renombrada)');
  await page.keyboard.press('Enter');
  await expect(app.getByRole('button', { name: 'Abrir Casa etapa 1 (renombrada)' })).toBeVisible();
  // Put the name back (the file is shared with the real app).
  await app.getByRole('button', { name: 'Cambiar nombre de Casa etapa 1 (renombrada)' }).click();
  await page.getByLabel('Nombre del proyecto').fill('Casa etapa 1');
  await page.keyboard.press('Enter');
  await expect(app.getByRole('button', { name: 'Abrir Casa etapa 1' })).toBeVisible();
});
