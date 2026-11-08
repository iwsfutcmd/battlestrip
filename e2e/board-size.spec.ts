import { expect, test } from '@playwright/test';
import { watchForErrors } from './helpers.ts';
import { deal, handOut } from './table.ts';

test.use({ reducedMotion: 'reduce' });

const cells = (page: import('@playwright/test').Page) => page.locator('.tv [data-cell]');

test('auto board size: two players in everyday outfits get 6×7', async ({ page, browser }) => {
  const noErrors = watchForErrors(page);
  await page.goto('./?lang=en');
  await page.waitForSelector('.lobby');
  const auto = page.locator('.settings-grid label.check input[type=checkbox]').first();
  const numbers = page.locator('.settings-grid input[type=number]');
  await expect(auto).toBeChecked();
  // Three seats to start: 8×8, and the rows and columns follow the outfits.
  await expect(numbers.nth(0)).toBeDisabled();
  await expect(numbers.nth(0)).toHaveValue('8');
  await expect(numbers.nth(1)).toHaveValue('8');
  await expect(page.locator('.settings-note')).toContainText('49%');
  // Turning auto off keeps the size it had picked, ready to edit.
  await auto.uncheck();
  await expect(numbers.nth(0)).toBeEnabled();
  await expect(numbers.nth(0)).toHaveValue('8');
  await numbers.nth(0).fill('10');
  await numbers.nth(1).fill('10');
  await numbers.nth(1).blur();
  await expect(page.locator('.settings-note')).toContainText('34%');

  await deal(page, { lang: 'en', names: ['Amani', 'Bo'], autoSize: true });
  await handOut(page, browser);
  await page.locator('.handout-done button.primary').click();
  await expect(cells(page)).toHaveCount(42);
  await expect(page.locator('.tv [data-cell="5-6"]')).toHaveCount(1);
  noErrors();
});

test('auto board size: four players get 9×9', async ({ page, browser }) => {
  await deal(page, { lang: 'en', names: ['Amani', 'Bo', 'Chen', 'Dana'], autoSize: true });
  await handOut(page, browser);
  await page.locator('.handout-done button.primary').click();
  await expect(cells(page)).toHaveCount(81);
});
