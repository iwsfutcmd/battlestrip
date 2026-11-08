import { expect, test, type Page } from '@playwright/test';
import { deal, handOut, type DealOptions } from './table.ts';

test.use({ reducedMotion: 'reduce' });

/** Where the board is, to the pixel. */
async function boardBox(page: Page): Promise<string> {
  const box = await page.locator('.tv .board').boundingBox();
  if (!box) return 'none';
  return [box.x, box.y, box.width, box.height].map((n) => Math.round(n)).join(',');
}

const CASES: readonly { name: string; viewport: { width: number; height: number }; deal: DealOptions }[] = [
  { name: 'wide', viewport: { width: 1280, height: 720 }, deal: { lang: 'en', names: ['Amani', 'Bo', 'Chen'], autoSize: true } },
  { name: 'narrow, with a bot', viewport: { width: 900, height: 650 }, deal: { lang: 'en', names: ['Amani', 'Robo'], bots: [1], autoSize: true } },
  { name: 'Arabic', viewport: { width: 1280, height: 720 }, deal: { lang: 'ar', names: ['أمل', 'بشرى'], autoSize: true } },
  {
    name: 'vertical Chinese',
    viewport: { width: 1280, height: 720 },
    deal: { lang: 'zh-Hant', names: ['甲', '乙'], writingMode: 'vertical-rl', labels: 'heavenlyStems', autoSize: true },
  },
];

for (const c of CASES) {
  test(`the board keeps its size and place through a game: ${c.name}`, async ({ page, context, browser }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(c.viewport);
    await deal(page, c.deal);
    await handOut(page, browser);
    const tv = await context.newPage();
    await tv.setViewportSize(c.viewport);
    await tv.goto('display/');
    await page.locator('.handout-done button.primary').click();
    await expect(tv.locator('.shared-board')).toBeVisible();
    const seen = { tv: new Set<string>(), control: new Set<string>() };
    const look = async (): Promise<void> => {
      seen.tv.add(await boardBox(tv));
      seen.control.add(await boardBox(page));
    };
    await look();
    const cells = page.locator('.tv [data-cell]');
    const count = await cells.count();
    for (let i = 0; i < 24 && !(await page.locator('.game-over').count()); i++) {
      const input = page.locator('.call-input');
      await expect(input).toBeEnabled();
      if (i === 3) {
        // A call the game can't read puts an error in the controls.
        await input.fill('ZZ99');
        await input.press('Enter');
        await expect(page.locator('.play-panel [role=alert]')).toBeVisible();
        await look();
      }
      // Call by clicking a cell: works whatever the labels are.
      await cells.nth((i * 7) % count).dblclick();
      await look();
      await page.waitForTimeout(30);
      await look();
    }
    expect([...seen.tv]).toHaveLength(1);
    expect([...seen.control]).toHaveLength(1);
    // On the laptop, the board never sits under the controls.
    const board = await page.locator('.tv .board').boundingBox();
    const panel = await page.locator('.play-panel').boundingBox();
    if (!board || !panel) throw new Error('board or controls missing');
    const overlaps =
      board.x < panel.x + panel.width && panel.x < board.x + board.width && board.y < panel.y + panel.height && panel.y < board.y + board.height;
    expect(overlaps).toBe(false);
  });
}
