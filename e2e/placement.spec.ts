import { expect, test } from '@playwright/test';
import { visibleText } from './helpers.ts';
import { deal } from './table.ts';

test.use({ reducedMotion: 'reduce' });

test('M5: players place their own ships on their phones and bring back fleet codes', async ({ page, context, browser }) => {
  test.setTimeout(90_000);
  await deal(page, { lang: 'en', names: ['Amani', 'Bo', 'Robo'], bots: [2], placement: 'phones' });
  const tv = await context.newPage();
  await tv.goto('display/');
  const invite = await tv.locator('.tv-invite svg.qr').getAttribute('data-url');
  expect(invite).toContain('/place/#');

  const phoneCtx = await browser.newContext({ locale: 'en', viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });

  // Amani: random placement.
  const a = await phoneCtx.newPage();
  await a.goto(invite ?? '');
  await a.locator('.place-seats button', { hasText: 'Amani' }).click();
  await a.getByRole('button', { name: visibleText('en', 'place.random') }).click();
  await a.getByRole('button', { name: visibleText('en', 'place.done') }).click();
  const codeA = (await a.locator('[data-testid=fleet-code]').textContent()) ?? '';
  expect(codeA).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{1,4}-[0-9A-Z*~$=]$/u);

  // A typo is caught, and a code is accepted however it's typed.
  const typo = codeA.slice(0, 1) === 'A' ? `B${codeA.slice(1)}` : `A${codeA.slice(1)}`;
  await page.locator('.code-input').fill(typo);
  await page.locator('.code-input').press('Enter');
  await expect(page.locator('.placement [role=alert]')).toBeVisible();
  await page.locator('.code-input').fill(codeA.toLowerCase().replaceAll('-', ' '));
  await page.locator('.code-input').press('Enter');
  await expect(page.locator('.placement-seats li.is-ready')).toHaveCount(1);
  await expect(tv.locator('.badge-ready')).toHaveCount(2); // Amani and the bot

  // Bo: places the everyday outfit piece by piece by tapping (T-shirt, jeans, underwear, left sock, right sock),
  // each piece's first square on a spot where its shape fits without overlapping.
  const b = await phoneCtx.newPage();
  await b.goto(invite ?? '');
  await b.locator('.place-seats button', { hasText: 'Bo' }).click();
  for (const [i, cell] of ['0-0', '0-4', '3-0', '3-4', '6-0'].entries()) {
    await b.locator('.place-ships button').nth(i).click();
    await b.locator(`[data-cell="${cell}"]`).click();
  }
  await expect(b.locator('.fleet-board .ship-number')).toHaveCount(5);
  await b.getByRole('button', { name: visibleText('en', 'place.done') }).click();
  const codeB = (await b.locator('[data-testid=fleet-code]').textContent()) ?? '';
  // Bo's phone image: the same fleet check the laptop will compute.
  await b.getByRole('link', { name: visibleText('en', 'place.showFleet') }).click();
  await b.getByRole('checkbox').check();
  await expect(b.locator('.fleet-board .ship-number')).toHaveCount(5);
  const phoneCheck = await b.locator('[data-testid=fleet-check]').textContent();

  await page.locator('.code-input').fill(codeB);
  await page.locator('.code-input').press('Enter');
  await expect(page.locator('.placement-seats li.is-ready')).toHaveCount(2);
  await page.locator('.placement button.primary.big').click();
  await expect(page.locator('.shared-board')).toBeVisible();

  // The private peek shows the same fleet check for Bo.
  await page.getByRole('button', { name: visibleText('en', 'play.peek') }).click();
  await page.locator('.peek-players button').nth(1).click();
  await page.locator('.peek button.primary').click();
  const hold = page.locator('.hold-button');
  await hold.dispatchEvent('pointerdown', { pointerId: 1 });
  await expect(page.locator('.peek [data-testid=fleet-check]')).toHaveText(phoneCheck ?? '');
  await phoneCtx.close();
});
