import { expect, test, type Page } from '@playwright/test';
import { deal, handOut } from './table.ts';

/**
 * §7.9 screenshots: the TV at setup, mid-game and game over, and the phone,
 * in every required locale plus vertical zh-Hant and a mixed case (an Arabic
 * phone showing a Latin-labelled game). They are written to
 * test-results/screenshots/ for review rather than compared pixel by pixel:
 * fonts differ between machines. Each one also checks that nothing overflows.
 */
test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 720 } });

const CASES = [
  { id: 'en', lang: 'en', names: ['Amani', 'Bo'] },
  { id: 'ar', lang: 'ar', names: ['لينا', 'יעל'] },
  { id: 'ar-XB', lang: 'ar-XB', names: ['Amani', '7 Seas'] },
  { id: 'en-XA', lang: 'en-XA', names: ['Ngũgĩ', '👩🏽‍🚀 Ada'] },
  { id: 'zh-Hant', lang: 'zh-Hant', names: ['陳大文', 'Bo'] },
  { id: 'zh-Hant-vertical', lang: 'zh-Hant', names: ['陳大文', 'Bo'], writingMode: 'vertical-rl' as const },
] as const;

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/screenshots/${name}.png` });

async function noOverflow(page: Page): Promise<void> {
  const over = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - window.innerWidth,
    y: document.documentElement.scrollHeight - window.innerHeight,
  }));
  expect(over.x).toBeLessThanOrEqual(1);
  expect(over.y).toBeLessThanOrEqual(1);
}

for (const c of CASES) {
  test(`screenshots: ${c.id}`, async ({ page, context, browser }) => {
    test.setTimeout(90_000);
    await deal(page, { lang: c.lang, names: [...c.names, 'Robo'], bots: [2], ...('writingMode' in c ? { writingMode: c.writingMode } : {}) });
    const tv = await context.newPage();
    await tv.goto('display/');
    await expect(tv.locator('.roster-row')).toHaveCount(3);
    await shot(tv, `tv-${c.id}-setup`);
    const urls = await handOut(page, browser, c.lang === 'ar-XB' || c.lang === 'en-XA' ? 'en' : c.lang);
    await page.locator('.handout-done button.primary').click();
    for (let i = 0; i < 12; i++) {
      await expect(page.locator('.call-input')).toBeEnabled();
      await page.locator('.board-cell[role=gridcell]').nth(i * 7 + 3).dblclick();
    }
    await expect(tv.locator('.last-call')).toBeVisible();
    await noOverflow(tv);
    await shot(tv, `tv-${c.id}-mid`);
    // Let the rest of the game play itself: turn the humans' seats over to the grid in order.
    for (let i = 0; i < 400 && !(await page.locator('.game-over').count()); i++) {
      if (await page.locator('.call-input').isEnabled()) await page.locator('.board-cell[role=gridcell]').nth(i % 100).dblclick();
      else await page.waitForTimeout(10);
    }
    await expect(tv.locator('.game-over')).toBeVisible();
    await shot(tv, `tv-${c.id}-over`);

    const phoneLocales = c.id === 'en' ? ['en', 'ar'] : [c.lang];
    for (const locale of phoneLocales) {
      const ctx = await browser.newContext({ locale, viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true });
      const phone = await ctx.newPage();
      await phone.goto(urls[0] ?? '');
      await phone.getByRole('checkbox').check();
      await expect(phone.locator('.fleet-board')).toBeVisible();
      // On a mobile viewport, overflowing content widens the layout viewport instead of scrolling.
      expect(await phone.evaluate(() => window.innerWidth)).toBe(412);
      await phone.screenshot({ path: `test-results/screenshots/phone-${c.id}${locale === c.lang ? '' : `-phone-${locale}`}.png`, fullPage: true });
      await ctx.close();
    }
  });
}
