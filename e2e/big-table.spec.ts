import { expect, test } from '@playwright/test';
import { deal, handOut } from './table.ts';

test.use({ reducedMotion: 'reduce' });

test('the lobby seats up to sixteen players', async ({ page }) => {
  await page.goto('./?lang=en');
  await page.waitForSelector('.lobby');
  const addBot = page.locator('.lobby-section .actions button').nth(1);
  while ((await page.locator('.seat').count()) < 16) await addBot.click();
  await expect(addBot).toBeDisabled();
  await expect(page.locator('.lobby-section .actions button').first()).toBeDisabled();
});

test('a twelve-player game deals, and the roster switches to compact rows', async ({ page, browser }) => {
  test.setTimeout(120_000);
  const names = Array.from({ length: 12 }, (_, i) => `Player ${i + 1}`);
  await deal(page, { lang: 'en', names, bots: names.slice(1).map((_, i) => i + 1), autoSize: true });
  await handOut(page, browser);
  await page.locator('.handout-done button.primary').click();
  const rows = page.locator('.tv .roster-list.is-compact > li');
  await expect(rows).toHaveCount(12);
  // Each row sums up the outfit as one pip per piece, with a text alternative.
  await expect(rows.first().locator('.roster-pips')).toHaveAttribute('aria-label', /0 of \d+ pieces off/u);
  await expect(page.locator('.tv .fleet-pics')).toHaveCount(0);
});
