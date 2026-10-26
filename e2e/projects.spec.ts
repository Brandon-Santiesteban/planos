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

  await drawWall(page, '4');
  await expect(page.getByTestId('estado-guardado')).toContainText('Guardado');

  await page.getByRole('button', { name: 'Nuevo' }).click();
  await expect(page.getByTestId('plan2d').getByText('4,00 m')).toHaveCount(0);
  await drawWall(page, '2');
  await expect(page.getByTestId('estado-guardado')).toContainText('Guardado');

  await page.getByRole('button', { name: 'Mis proyectos' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.fila-proyecto')).toHaveCount(2);
  await dialog.locator('.fila-proyecto:not([disabled])').click();
  await expect(page.getByTestId('plan2d').getByText('4,00 m')).toBeVisible();

  await page.reload(); // the last opened project comes back
  await expect(page.getByTestId('plan2d').getByText('4,00 m')).toBeVisible();
});
