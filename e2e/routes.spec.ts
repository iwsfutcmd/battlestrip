import { expect, test } from '@playwright/test';
import { EXPECTED_DIR, REQUIRED, visibleText, watchForErrors } from './helpers.ts';

const ROUTES = [
  { path: '', title: 'title.control', heading: 'app.title' },
  { path: 'display/', title: 'title.display', heading: 'app.title' },
  { path: 'fleet/', title: 'title.fleet', heading: 'route.fleet.heading' },
] as const;

for (const route of ROUTES) {
  for (const catalog of REQUIRED) {
    test(`/${route.path} renders in ${catalog}`, async ({ page }) => {
      const noErrors = watchForErrors(page);
      await page.goto(`${route.path}?lang=${catalog}`);
      const html = page.locator('html');
      await expect(html).toHaveAttribute('lang', catalog);
      await expect(html).toHaveAttribute('dir', EXPECTED_DIR[catalog]);
      await expect(page.locator('h1')).toHaveText(visibleText(catalog, route.heading));
      await expect(page).toHaveTitle(visibleText(catalog, route.title));
      noErrors();
    });
  }
}

test.describe('negotiation from the browser’s languages', () => {
  test.use({ locale: 'zh-TW' });
  test('zh-TW gets the zh-Hant catalog, tagged zh-Hant-TW', async ({ page }) => {
    await page.goto('display/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant-TW');
    await expect(page.locator('h1')).toHaveText(visibleText('zh-Hant', 'app.title'));
  });
});

test.describe('negotiation keeps -u-nu-', () => {
  test('ar-u-nu-latn formats Latin digits in an RTL page', async ({ page }) => {
    await page.goto('display/?lang=ar-u-nu-latn');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('.tv-seat-number').first()).toHaveText('المقعد 1');
  });
});

test('the TV isolates every player name with <bdi>', async ({ page }) => {
  await page.goto('display/?lang=ar');
  await expect(page.locator('.tv-seat-name')).toHaveCount(6);
  for (const name of await page.locator('.tv-seat-name').all()) {
    expect(await name.evaluate((el) => el.tagName)).toBe('BDI');
  }
  // Names inside sentences are isolated too.
  await expect(page.locator('.tv-seat-status bdi').first()).toHaveText('יעל');
});

test('the control panel switches the game language and hands it to the display link', async ({ page }) => {
  await page.goto('?lang=en');
  await page.getByRole('combobox').selectOption('ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('h2')).toHaveText(visibleText('ar', 'route.control.heading'));
  await expect(page.getByRole('link').first()).toHaveAttribute('href', 'display/?lang=ar');
});
