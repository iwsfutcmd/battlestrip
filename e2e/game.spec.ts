import { expect, test } from '@playwright/test';
import { visibleText, watchForErrors } from './helpers.ts';
import { deal, handOut, playToTheEnd } from './table.ts';

test.use({ reducedMotion: 'reduce' });

const latin = (r: number, c: number): string => `${String.fromCharCode(65 + r)}${c + 1}`;

test('exit test: a 4-player game, each phone used exactly once to scan', async ({ page, browser, context }) => {
  test.setTimeout(120_000);
  const noErrors = watchForErrors(page);
  await deal(page, { lang: 'en', names: ['Amani', 'Bo', 'Chen', 'Dana'] });
  // The TV, in its own window, synced over BroadcastChannel.
  const tv = await context.newPage();
  await tv.goto('display/');
  await expect(tv.locator('.roster-row')).toHaveCount(4);

  const urls = await handOut(page, browser);
  expect(urls).toHaveLength(4);
  expect(new Set(urls).size).toBe(4);
  // The QR code never appears on the TV.
  await expect(tv.locator('svg.qr')).toHaveCount(0);

  await page.locator('.handout-done button.primary').click();
  await expect(tv.locator('.shared-board')).toBeVisible();
  // No fleet anywhere on the shared screens during play.
  await expect(tv.locator('.piece-cell')).toHaveCount(0);
  await expect(page.locator('.tv .piece-cell')).toHaveCount(0);

  const calls = await playToTheEnd(page, 10, 10, latin);
  expect(calls).toBeGreaterThan(10);
  await expect(page.locator('.game-over')).toBeVisible();
  await expect(tv.locator('.game-over')).toBeVisible();
  await expect(tv.locator('.over-result')).not.toBeEmpty();
  // Game over reveals every fleet.
  await expect(tv.locator('.revealed-fleet')).toHaveCount(4);
  noErrors();
});

const strip = (s: string | null): string => (s ?? '').replaceAll(/[\u2066-\u2069]/gu, '');

test('bots call by themselves after a human call', async ({ page, browser }) => {
  await deal(page, { lang: 'en', names: ['Amani', 'Robo'], bots: [1] });
  await handOut(page, browser);
  await page.locator('.handout-done button.primary').click();
  await expect(page.locator('.call-input')).toBeEnabled();
  await page.locator('.call-input').fill('J10');
  await page.locator('.call-input').press('Enter');
  // The bot answers on its own; then it's the human's turn again.
  await expect.poll(async () => strip(await page.locator('.last-call-coord').textContent())).not.toContain('J10');
  await expect(page.locator('.call-input')).toBeEnabled();
});

test('undo takes back only the last call (Ctrl+Z on the physical key)', async ({ page, browser }) => {
  await deal(page, { lang: 'en', names: ['Amani', 'Bo'] });
  await handOut(page, browser);
  await page.locator('.handout-done button.primary').click();
  for (const sq of ['A1', 'J10']) {
    await page.locator('.call-input').fill(sq);
    await page.locator('.call-input').press('Enter');
  }
  await expect.poll(async () => strip(await page.locator('.last-call-coord').textContent())).toContain('J10');
  await page.locator('body').click();
  await page.keyboard.press('Control+KeyZ');
  await expect(page.locator('.play-panel [role=status]')).toBeVisible();
  await expect.poll(async () => strip(await page.locator('.last-call-coord').textContent())).toContain('A1');
  await expect(page.getByRole('button', { name: visibleText('en', 'play.undo') })).toBeDisabled();
});

test('an Arabic table: mirrored grid with abjad labels on the TV and the phones', async ({ page, browser }) => {
  await deal(page, { lang: 'ar', names: ['لينا', 'יעל'] });
  const urls = await handOut(page, browser, 'ar');
  await page.locator('.handout-done button.primary').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const firstCol = page.locator('.shared-board .board-col-label').first();
  const secondCol = page.locator('.shared-board .board-col-label').nth(1);
  const [a, b] = [await firstCol.boundingBox(), await secondCol.boundingBox()];
  // Column 1 sits at the inline-start (right) edge.
  expect((a?.x ?? 0) > (b?.x ?? 0)).toBe(true);
  // Two labels per row (both sides): row 5 (heh) is the 9th.
  await expect(page.locator('.shared-board .board-row-label').nth(8)).toContainText('هـ');
  // A phone in Arabic shows the same labels; one set to English still does, with its legend in English.
  for (const locale of ['ar', 'en']) {
    const ctx = await browser.newContext({ locale, viewport: { width: 412, height: 915 } });
    const phone = await ctx.newPage();
    await phone.goto(urls[0] ?? '');
    await phone.getByRole('checkbox').check();
    await expect(phone.locator('.fleet-board .board-row-label').first()).toContainText('أ');
    await expect(phone.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    await expect(phone.locator('.fleet-board')).toHaveAttribute('dir', 'rtl');
    await ctx.close();
  }
});

test('a Chinese table: 天干 rows on the TV and the phone', async ({ page, browser }) => {
  await deal(page, { lang: 'zh-Hant', names: ['陳大文', 'Ngũgĩ'] });
  const urls = await handOut(page, browser, 'zh-TW');
  await page.locator('.handout-done button.primary').click();
  await expect(page.locator('.shared-board .board-row-label').first()).toContainText('甲');
  const phone = await browser.newPage({ locale: 'zh-TW' });
  await phone.goto(urls[0] ?? '');
  await phone.getByRole('checkbox').check();
  await expect(phone.locator('.fleet-board .board-row-label').nth(18)).toContainText('癸');
  await expect(phone.locator('.phone-legend')).toContainText('牛仔褲');
  await phone.close();
  // Typed calls in the table's own labels.
  await page.locator('.call-input').fill('甲７');
  await page.locator('.call-input').press('Enter');
  await expect.poll(async () => strip(await page.locator('.last-call-coord').textContent())).toContain('甲7');
});

test('autosave: a reload offers to resume the game', async ({ page, browser }) => {
  await deal(page, { lang: 'en', names: ['Amani', 'Bo'] });
  await handOut(page, browser);
  await page.locator('.handout-done button.primary').click();
  await page.locator('.call-input').fill('C3');
  await page.locator('.call-input').press('Enter');
  await page.reload();
  await page.locator('.banner button.primary').click();
  await expect.poll(async () => strip(await page.locator('.last-call-coord').textContent())).toContain('C3');
});

test('the private peek shows a fleet only while held', async ({ page, browser }) => {
  await deal(page, { lang: 'en', names: ['Amani', 'Bo'] });
  await handOut(page, browser);
  await page.locator('.handout-done button.primary').click();
  await page.getByRole('button', { name: visibleText('en', 'play.peek') }).click();
  await page.locator('.peek-players button').first().click();
  await page.locator('.peek button.primary').click();
  await expect(page.locator('.peek .piece-cell')).toHaveCount(0);
  const hold = page.locator('.hold-button');
  await hold.dispatchEvent('pointerdown', { pointerId: 1 });
  await expect(page.locator('.peek .piece-cell').first()).toBeVisible();
  await hold.dispatchEvent('pointerup', { pointerId: 1 });
  await expect(page.locator('.peek .piece-cell')).toHaveCount(0);
});
