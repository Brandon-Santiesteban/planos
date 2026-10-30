import { expect, test } from '@playwright/test';

test('draw a wall, undo/redo it, and get it back after a reload', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => indexedDB.deleteDatabase('keyval-store'));
  await page.reload();
  // A browser with nothing open starts on Mis proyectos.
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByTestId('tool-wall').click();
  const box = (await page.getByTestId('plan2d').boundingBox())!;
  await page.mouse.click(box.x + 120, box.y + 200);
  await page.mouse.move(box.x + 300, box.y + 200);
  await page.keyboard.type('4');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');

  const label = page.getByTestId('plan2d').getByText('4,00 m');
  await expect(label).toBeVisible();

  await page.keyboard.press('Control+z');
  await expect(label).toHaveCount(0);
  await page.keyboard.press('Control+y');
  await expect(label).toBeVisible();

  await page.waitForTimeout(1500); // autosave debounce
  await page.reload();
  await expect(page.getByTestId('plan2d').getByText('4,00 m')).toBeVisible();
  await expect(page.getByTestId('scene3d').locator('canvas')).toBeVisible();
});
