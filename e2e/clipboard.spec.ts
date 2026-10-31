import { expect, test } from '@playwright/test';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('Ctrl+C and Ctrl+V copy and paste the selected piece of furniture', async ({ page }) => {
  await page.goto('/?biblioteca');
  await page.getByRole('button', { name: 'Proyecto nuevo' }).click();
  await page.getByTestId('tool-furniture').click();
  await page.getByTestId('mueble-comoda').click();
  const box = (await page.getByTestId('plan2d').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.press('Escape');
  const pieces = page.getByTestId('plan2d').locator('g.mueble[data-id]');
  await expect(pieces).toHaveCount(1);

  await page.keyboard.press('Control+v'); // nothing copied yet
  await expect(page.getByText('Primero copia algo del plano con Ctrl+C')).toBeVisible();

  await pieces.first().click();
  await page.keyboard.press('Control+c');
  await expect(page.getByText('Copiado: 1 mueble. Ctrl+V para pegar')).toBeVisible();
  await page.keyboard.press('Control+v');
  await page.keyboard.press('Control+v');
  await expect(pieces).toHaveCount(3);
});
