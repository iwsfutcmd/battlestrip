import { expect, test, type Page } from '@playwright/test';
import { deal, handOut } from './table.ts';

const strip = (s: string | null): string => (s ?? '').replaceAll(/[\u2066-\u2069]/gu, '');
const lastCall = async (page: Page): Promise<string> =>
  (await page.locator('.last-call-coord').count()) ? strip(await page.locator('.last-call-coord').textContent()) : '';
const cell = (page: Page, rc: string) => page.locator(`.tv [data-cell="${rc}"]`);

test('a click picks a square, a second click on it calls it, and Enter calls the picked square', async ({ page, browser }) => {
  await deal(page, { lang: 'en', names: ['Amani', 'Bo'] });
  await handOut(page, browser);
  await page.locator('.handout-done button.primary').click();
  await expect(page.locator('.call-input')).toBeEnabled();

  // One click only picks C4: it's selected and in the call box, but not called.
  await cell(page, '2-3').click();
  await expect(cell(page, '2-3')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.call-input')).toHaveValue('C4');
  expect(await lastCall(page)).toBe('');
  // Clicking the picked square calls it, and the results are there straight away.
  await cell(page, '2-3').click();
  expect(await lastCall(page)).toContain('C4');
  await expect(page.locator('.last-call-results .results')).toBeVisible({ timeout: 200 });

  // A call clears the pick: the next caller's single click on that square only picks it.
  await expect(cell(page, '2-3')).toHaveAttribute('aria-selected', 'false');
  await expect(page.locator('.call-input')).toBeEnabled();
  await cell(page, '2-3').click();
  await page.waitForTimeout(100);
  expect(await lastCall(page)).toContain('C4');

  // Enter calls the picked square from anywhere that isn't a field or a button.
  await cell(page, '3-4').click();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Enter');
  await expect.poll(() => lastCall(page)).toContain('D5');

  // And from the grid itself.
  await expect(page.locator('.call-input')).toBeEnabled();
  await cell(page, '4-5').click();
  await page.keyboard.press('Enter');
  await expect.poll(() => lastCall(page)).toContain('E6');

  // With nothing picked since that call, Enter on the page does nothing.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  expect(await lastCall(page)).toContain('E6');
});
