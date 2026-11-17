import { expect, test } from '@playwright/test';
import { watchForErrors } from './helpers.ts';
import { deal, handOut } from './table.ts';

test.use({ reducedMotion: 'reduce' });

const cells = (page: import('@playwright/test').Page) => page.locator('.tv [data-cell]');

test('auto board size: two players in everyday outfits get 7×7', async ({ page, browser }) => {
  const noErrors = watchForErrors(page);
  await page.goto('./?lang=en');
  await page.waitForSelector('.lobby');
  // Outfits start empty, and nobody can deal until everyone has something on.
  await expect(page.locator('.seat .chip')).toHaveCount(0);
  await expect(page.locator('button.primary.big')).toBeDisabled();
  for (let i = 0; i < 3; i++) await page.locator('.seat').nth(i).locator('.outfit-presets button').first().click();
  await expect(page.locator('button.primary.big')).toBeEnabled();
  const auto = page.locator('.settings-grid label.check input[type=checkbox]').first();
  const numbers = page.locator('.settings-grid input[type=number]');
  await expect(auto).toBeChecked();
  // Three seats to start: 8×9, and the rows and columns follow the outfits.
  await expect(numbers.nth(0)).toBeDisabled();
  await expect(numbers.nth(0)).toHaveValue('8');
  await expect(numbers.nth(1)).toHaveValue('9');
  await expect(page.locator('.settings-note')).toContainText('48%');
  // Turning auto off keeps the size it had picked, ready to edit.
  await auto.uncheck();
  await expect(numbers.nth(0)).toBeEnabled();
  await expect(numbers.nth(0)).toHaveValue('8');
  await numbers.nth(0).fill('10');
  await numbers.nth(1).fill('10');
  await numbers.nth(1).blur();
  await expect(page.locator('.settings-note')).toContainText('36%');

  await deal(page, { lang: 'en', names: ['Amani', 'Bo'], autoSize: true });
  await handOut(page, browser);
  await page.locator('.handout-done button.primary').click();
  await expect(cells(page)).toHaveCount(49);
  await expect(page.locator('.tv [data-cell="6-6"]')).toHaveCount(1);
  noErrors();
});

test('auto board size: four players get 9×10', async ({ page, browser }) => {
  await deal(page, { lang: 'en', names: ['Amani', 'Bo', 'Chen', 'Dana'], autoSize: true });
  await handOut(page, browser);
  await page.locator('.handout-done button.primary').click();
  await expect(cells(page)).toHaveCount(90);
});
