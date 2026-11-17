import { expect, test } from '@playwright/test';
import { deal, handOut } from './table.ts';

test.use({ reducedMotion: 'reduce' });

const PIECES = /T-shirt|jeans|underwear|left sock|right sock/u;

test('a highlighted hit square says whose clothes are there, and which piece', async ({ page, browser }) => {
  await deal(page, { lang: 'en', names: ['Amani', 'Bo'], autoSize: true });
  await handOut(page, browser);
  await page.locator('.handout-done button.primary').click();
  const cells = page.locator('.tv [data-cell]');
  const n = await cells.count();
  for (let i = 0; i < n && (await page.locator('.tv .board-cell.is-hit').count()) === 0; i++) {
    await expect(page.locator('.call-input')).toBeEnabled();
    await cells.nth(i).dblclick();
  }
  const hit = page.locator('.tv .board-cell.is-hit').first();
  await page.mouse.move(0, 0);
  await expect(page.locator('.cell-info-card')).toHaveCount(0);
  await hit.hover();
  const card = page.locator('.cell-info-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText(/Amani|Bo/u);
  await expect(card).toContainText(PIECES);
  // Screen readers get the same: the square's name lists the piece.
  await expect(hit).toHaveAttribute('aria-label', PIECES);
});

test('when the caller is down to nothing, highlighting a square outlines the bomb’s four squares', async ({ page, browser }) => {
  test.setTimeout(120_000);
  await deal(page, { lang: 'en', names: ['Amani', 'Bo'], autoSize: true });
  await handOut(page, browser);
  await page.locator('.handout-done button.primary').click();
  const cells = page.locator('.tv [data-cell]');
  const n = await cells.count();
  const bombing = page.locator('.play-who', { hasText: 'bomb' });
  // Sweep the board in reading order until whoever's turn it is drops bombs.
  for (let i = 0; i < n && !(await bombing.count()) && !(await page.locator('.game-over').count()); i++) {
    await expect(page.locator('.call-input')).toBeEnabled();
    await cells.nth(i).dblclick();
  }
  await expect(bombing).toBeVisible();
  await cells.nth(0).hover();
  await expect(page.locator('.tv .board-cell.is-bomb-preview')).toHaveCount(4);
  // The last square: the bomb moves back onto the board, covering the 2×2 in the corner.
  await cells.nth(n - 1).hover();
  const preview = page.locator('.tv .board-cell.is-bomb-preview');
  await expect(preview).toHaveCount(4);
  const keys = await preview.evaluateAll((els) => els.map((e) => e.getAttribute('data-cell')));
  const last = await cells.nth(n - 1).getAttribute('data-cell');
  const [r, c] = (last ?? '0-0').split('-').map(Number) as [number, number];
  expect(new Set(keys)).toEqual(new Set([`${r - 1}-${c - 1}`, `${r - 1}-${c}`, `${r}-${c - 1}`, `${r}-${c}`]));
});
