import { expect, test } from '@playwright/test';
import { EXPECTED_DIR, REQUIRED, visibleText, watchForErrors } from './helpers.ts';

for (const catalog of REQUIRED) {
  test(`phone page at a mobile viewport in ${catalog}`, async ({ page }) => {
    const noErrors = watchForErrors(page);
    await page.goto(`fleet/?lang=${catalog}&pseudo`);
    await expect(page.locator('html')).toHaveAttribute('dir', EXPECTED_DIR[catalog]);
    await expect(page.locator('h1')).toHaveText(visibleText(catalog, 'route.fleet.heading'));
    // Nothing overflows the viewport in the inline direction.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    noErrors();
  });
}

test.describe('phone language comes from the phone', () => {
  test.use({ locale: 'ar-EG' });
  test('an Arabic phone gets Arabic, and the picker lists languages by their own names', async ({ page }) => {
    await page.goto('fleet/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar-EG');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const options = page.locator('select option');
    await expect(options).toHaveText(['English', 'العربية', '繁體中文']);
    await page.locator('select').selectOption('zh-Hant');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('h1')).toHaveText(visibleText('zh-Hant', 'route.fleet.heading'));
  });
});
