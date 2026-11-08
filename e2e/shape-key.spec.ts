import { expect, test } from '@playwright/test';
import { deal, handOut } from './table.ts';

test.use({ reducedMotion: 'reduce' });

test('the shape key lists each piece in play once, under the players', async ({ page, browser }) => {
  await deal(page, { lang: 'en', names: ['Amani', 'Bo', 'Chen'] });
  await handOut(page, browser);
  await page.locator('.handout-done button.primary').click();
  // Three everyday outfits: five distinct pieces, each listed once.
  const items = page.locator('.tv .tv-side .shape-key-item');
  await expect(items).toHaveCount(5);
  await expect(items.first()).toContainText('T-shirt');
  await expect(items.nth(1)).toContainText('jeans');
  await expect(page.locator('.tv .shape-key-item svg.shape-icon')).toHaveCount(5);
});

test('on a vertical table the key is a compact line in the title strip', async ({ page, browser }) => {
  await deal(page, { lang: 'zh-Hant', names: ['甲', '乙'], writingMode: 'vertical-rl', labels: 'heavenlyStems' });
  await handOut(page, browser, 'zh-TW');
  await page.locator('.handout-done button.primary').click();
  await expect(page.locator('.tv .tv-side .shape-key')).toHaveCount(0);
  await expect(page.locator('.tv .tv-bar .shape-key.is-compact .shape-key-item')).toHaveCount(5);
  // The names stay for screen readers.
  await expect(page.locator('.tv .tv-bar .shape-key-item .visually-hidden').first()).toHaveText('T 恤');
});
