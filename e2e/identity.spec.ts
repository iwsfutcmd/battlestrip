import { expect, test } from '@playwright/test';
import { handOut } from './table.ts';

test.use({ reducedMotion: 'reduce' });

/** Words in a formatted message, which wraps each placeholder in bidi isolates. */
const words = (text: string): RegExp => new RegExp(text.split(' ').join('[\\u2066-\\u2069 ]+'), 'u');

test('clicking a player’s mark in the lobby steps through colours and shapes nobody else has, and the table uses it', async ({ page, browser }) => {
  await page.goto('./?lang=en');
  await page.waitForSelector('.lobby');
  const mark = page.locator('.seat').first().locator('.seat-glyph');
  await expect(mark).toHaveAttribute('aria-label', words('orange circle'));
  // Seats 2 and 3 have sky blue square and green triangle, so the next free one is yellow diamond.
  await mark.click();
  await expect(mark).toHaveAttribute('aria-label', words('yellow diamond'));
  await mark.click({ modifiers: ['Shift'] });
  await expect(mark).toHaveAttribute('aria-label', words('orange circle'));
  await mark.click();
  // Seat 3 can't take yellow diamond now: it steps past it.
  const third = page.locator('.seat').nth(2).locator('.seat-glyph');
  await third.click();
  await expect(third).toHaveAttribute('aria-label', words('blue star'));

  for (let i = 0; i < 3; i++) await page.locator('.seat').nth(i).locator('.outfit-presets button').first().click();
  const numbers = page.locator('.settings-grid input[type=number]');
  await numbers.nth(2).fill('0');
  await numbers.nth(3).fill('0');
  await numbers.nth(3).blur();
  await page.locator('button.primary.big').click();
  await handOut(page, browser);
  await page.locator('.handout-done button.primary').click();
  // The roster draws seat 1 in yellow, seat 3 in blue.
  const glyphs = page.locator('.tv .roster-list > li .glyph path');
  await expect(glyphs.nth(0)).toHaveAttribute('fill', '#F0E442');
  await expect(glyphs.nth(2)).toHaveAttribute('fill', '#0072B2');
});

test('with two players, removing one is greyed out and says why', async ({ page }) => {
  await page.goto('./?lang=en');
  await page.waitForSelector('.lobby');
  await page.locator('.seat').last().locator('.seat-remove').click();
  const remove = page.locator('.seat-remove');
  await expect(remove).toHaveCount(2);
  for (const r of await remove.all()) {
    await expect(r).toBeDisabled();
    await expect(r).toHaveAttribute('title', 'A game needs at least two players');
    expect(Number(await r.evaluate((e) => getComputedStyle(e).opacity))).toBeLessThan(0.5);
  }
});
