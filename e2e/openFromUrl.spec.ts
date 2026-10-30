import { expect, test } from '@playwright/test';

test('an old ?abrir link opens the example in 3D on the top floor and turns into its short link', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => indexedDB.deleteDatabase('keyval-store'));
  await page.goto('/?abrir=ejemplos/casa-etapa-1.casa.json&vista=3d');

  await expect(page.getByText('Casa etapa 1')).toBeVisible();
  await expect(page.getByTestId('scene3d').locator('canvas')).toBeVisible();
  await expect(page.locator('.floors-panel li.active')).toContainText('Terraza');
  await expect(page).toHaveURL(/\?p=casa-etapa-1&vista=3d$/);
});

test('a broken link explains what failed', async ({ page }) => {
  await page.goto('/?abrir=ejemplos/no-existe.casa.json');
  await expect(page.getByText('No se pudo abrir «ejemplos/no-existe.casa.json»')).toBeVisible();
});
