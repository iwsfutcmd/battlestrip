import { expect, test } from '@playwright/test';
import { deal, handOut } from './table.ts';

const themeSelect = (page: import('@playwright/test').Page) => page.locator('.settings-grid select:has(option[value="laundromat"])');

test('a theme applies at once, is remembered, and goes to the TV window', async ({ page, context, browser }) => {
  await page.goto('./?lang=en');
  await page.waitForSelector('.lobby');
  const html = page.locator('html');
  // Classic is the stylesheet's own look: no attribute.
  await expect(themeSelect(page)).toHaveValue('classic');
  await expect(html).not.toHaveAttribute('data-theme');

  await themeSelect(page).selectOption('tieDye');
  await expect(html).toHaveAttribute('data-theme', 'tieDye');
  await expect(themeSelect(page).locator('option:checked')).toHaveText('Tie-dye');

  // This browser remembers it for the next table.
  await page.reload();
  await page.waitForSelector('.lobby');
  await expect(themeSelect(page)).toHaveValue('tieDye');
  await expect(html).toHaveAttribute('data-theme', 'tieDye');

  await deal(page, { lang: 'en', names: ['Amani', 'Bo'], theme: 'sockDrawer' });
  const tv = await context.newPage();
  await tv.goto('display/');
  await expect(tv.locator('html')).toHaveAttribute('data-theme', 'sockDrawer');
  await handOut(page, browser);
  await page.locator('.handout-done button.primary').click();
  await expect(tv.locator('.shared-board')).toBeVisible();
  await expect(tv.locator('html')).toHaveAttribute('data-theme', 'sockDrawer');
  await expect(html).toHaveAttribute('data-theme', 'sockDrawer');
});
