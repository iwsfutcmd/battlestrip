import { expect, test } from '@playwright/test';

test('outfit search puts the best name match first', async ({ page }) => {
  await page.goto('./?lang=en');
  await page.waitForSelector('.lobby');
  const seat = page.locator('.seat').first();
  const results = seat.locator('.outfit-results button');
  await seat.locator('.outfit-search input, input[type=search]').first().fill('glasses');
  // "glasses" is the whole name of one piece and part of another: the whole name comes first.
  await expect(results.first()).toContainText(/^\W*glasses/u);
  await expect(results.nth(1)).toContainText('sunglasses');
  await seat.locator('.outfit-search input, input[type=search]').first().fill('hat');
  // Starts with "hat" before a word that does ("sun hat"), and both before a name that only contains it.
  await expect(results.first()).toContainText(/^\W*hat\b/u);
  await expect(results.nth(1)).toContainText('sun hat');
});
