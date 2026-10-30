import { expect, test } from '@playwright/test';

test('two quick rooms side by side share a wall that takes a door', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => indexedDB.deleteDatabase('keyval-store'));
  await page.reload();
  // A browser with nothing open starts on Mis proyectos.
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByTestId('tool-quickRoom').click();
  await page.getByLabel('Ancho (por dentro)').fill('3');
  await page.getByLabel('Ancho (por dentro)').press('Enter');
  await page.getByLabel('Largo (por dentro)').fill('4');
  await page.getByLabel('Largo (por dentro)').press('Enter');

  const plan = page.getByTestId('plan2d');
  const box = (await plan.boundingBox())!;
  const ppm = 60; // initial zoom
  // first room centred on screen point A; second one ~3.2 m to the right (snaps flush)
  const ax = box.x + 200;
  const ay = box.y + 300;
  await page.mouse.move(ax, ay);
  await page.mouse.click(ax, ay);
  await page.mouse.move(ax + 3.2 * ppm, ay);
  await page.mouse.click(ax + 3.2 * ppm, ay);

  const floor = () => page.evaluate(() => {
    const f = (window as unknown as { __editor: { getState(): { project: { floors: { walls: unknown[]; rooms: unknown[]; openings: unknown[] }[] } } } }).__editor.getState().project.floors[0];
    return { walls: f.walls.length, rooms: f.rooms.length, openings: f.openings.length };
  });
  expect(await floor()).toEqual({ walls: 7, rooms: 2, openings: 0 });

  // door on the shared wall, halfway between the two centres
  await page.getByTestId('tool-door').click();
  await page.mouse.click(ax + 1.6 * ppm, ay);
  expect((await floor()).openings).toBe(1);
  await expect(plan.getByText('Habitación 2')).toBeVisible();
});
