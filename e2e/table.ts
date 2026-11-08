import { expect, type Browser, type Page } from '@playwright/test';

export interface DealOptions {
  readonly lang: string;
  readonly names: readonly string[];
  /** Seat indices that are bots. */
  readonly bots?: readonly number[];
  readonly labels?: string;
  readonly rows?: number;
  readonly cols?: number;
  readonly writingMode?: 'horizontal-tb' | 'vertical-rl';
}

/** Fill the lobby and deal. Beat and bot delay go to 0 so tests run fast. */
export async function deal(page: Page, o: DealOptions): Promise<void> {
  await page.goto(`./?lang=${o.lang}`);
  await page.waitForSelector('.lobby');
  const addHuman = page.locator('.lobby-section .actions button').first();
  const addBot = page.locator('.lobby-section .actions button').nth(1);
  while ((await page.locator('.seat').count()) < o.names.length) {
    if ((o.bots ?? []).includes(await page.locator('.seat').count())) await addBot.click();
    else await addHuman.click();
  }
  for (const [i, name] of o.names.entries()) await page.locator('.seat-name').nth(i).fill(name);
  for (const i of o.bots ?? []) await page.locator('.seat').nth(i).locator('select').first().selectOption('bot');
  const numbers = page.locator('.settings-grid input[type=number]');
  if (o.rows) await numbers.nth(0).fill(String(o.rows));
  if (o.cols) await numbers.nth(1).fill(String(o.cols));
  await numbers.nth(2).fill('0');
  await numbers.nth(3).fill('0');
  await numbers.nth(3).blur();
  if (o.labels) await page.locator('.settings-grid select').nth(1).selectOption(o.labels);
  if (o.writingMode) await page.locator('.settings-grid select').nth(3).selectOption(o.writingMode);
  await page.locator('button.primary.big').click();
  await expect(page.locator('.handout')).toBeVisible();
}

/** Hand out every human fleet, opening each phone URL exactly once. Returns the URLs. */
export async function handOut(page: Page, browser: Browser, phoneLocale = 'en'): Promise<string[]> {
  const urls: string[] = [];
  const phone = await browser.newContext({ locale: phoneLocale, viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  while (await page.locator('.handout-privacy').count()) {
    await page.locator('.handout-privacy button.primary').click();
    const url = await page.locator('svg.qr').getAttribute('data-url');
    const check = await page.locator('[data-testid=fleet-check]').textContent();
    expect(url).toBeTruthy();
    if (!url) break;
    urls.push(url);
    const p = await phone.newPage();
    await p.goto(url);
    await expect(p.locator('[data-testid=fleet-check]')).toHaveText(check ?? '');
    await p.close();
    await page.locator('.handout-qr .actions button.primary').click();
  }
  await phone.close();
  return urls;
}

/** Type calls in reading order, skipping ones the game rejects, until the game ends. */
export async function playToTheEnd(page: Page, rows: number, cols: number, label: (r: number, c: number) => string): Promise<number> {
  const squares: string[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) squares.push(label(r, c));
  let calls = 0;
  for (let i = 0; i < 4000 && !(await page.locator('.game-over').count()); i++) {
    const input = page.locator('.call-input');
    if (await input.isDisabled()) {
      await page.waitForTimeout(20);
      continue;
    }
    await input.fill(squares[i % squares.length] ?? '');
    await input.press('Enter');
    if (!(await page.locator('.play-panel [role=alert]').count())) calls++;
  }
  return calls;
}
