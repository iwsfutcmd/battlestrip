import { expect, test, type Page } from '@playwright/test';
import { legalCalls, newGame, presetRules, reduce, type Seat, type PlayerId } from '../src/engine/index.ts';
import { deal, handOut } from './table.ts';
import { visibleText } from './helpers.ts';

test.use({ reducedMotion: 'reduce' });

const SQUARES = Array.from({ length: 100 }, (_, i) => `${String.fromCharCode(65 + Math.floor(i / 10))}${(i % 10) + 1}`);
const toCoord = (sq: string) => ({ row: sq.charCodeAt(0) - 65, col: Number(sq.slice(1)) - 1 });

/**
 * Find a seed where typing squares in reading order (skipping rejected ones,
 * as the test does through the UI) produces a last fleet standing that is
 * later sunk. Only the seed and the fleets matter to the engine, not the seat ids.
 */
function findSeed(): number {
  const rules = presetRules('classic', { playOut: true });
  const fleet = rules.shipyard.map((s) => s.id);
  for (let seed = 1; seed < 2000; seed++) {
    const seats: Seat[] = ['a', 'b', 'c'].map((id) => ({ id: id as PlayerId, kind: 'human', fleet }));
    const g0 = newGame(rules, seats, seed);
    if (!g0.ok) continue;
    const started = reduce(g0.value, { kind: 'start' });
    if (!started.ok) continue;
    let s = started.value.state;
    for (let i = 0; i < 4000 && s.phase === 'playing'; i++) {
      const player = s.seats[s.current]?.id;
      if (!player) break;
      const at = toCoord(SQUARES[i % 100] ?? 'A1');
      if (!legalCalls(s, player).some((c) => c.row === at.row && c.col === at.col)) continue;
      const r = reduce(s, { kind: 'call', player, at });
      if (r.ok) s = r.value.state;
    }
    if (s.result?.kind === 'playedOut' && s.turn - s.result.standingFrom > 2) return seed;
  }
  throw new Error('no seed found');
}

/** Type squares in reading order until `done` says stop. */
async function callUntil(page: Page, done: () => Promise<boolean>): Promise<void> {
  for (let i = 0; i < 4000 && !(await done()); i++) {
    await page.locator('.call-input').fill(SQUARES[i % 100] ?? 'A1');
    await page.locator('.call-input').press('Enter');
  }
}

const seed = findSeed();

test('play on after one fleet is left, until it sinks too', async ({ page, browser, context }) => {
  test.setTimeout(120_000);
  await deal(page, { lang: 'en', names: ['Amani', 'Bo', 'Chen'], seed });
  await handOut(page, browser);
  await page.locator('.handout-done button.primary').click();
  const tv = await context.newPage();
  await tv.goto('display/');
  await expect(tv.locator('.shared-board')).toBeVisible();

  // Calls are typed in the same order the seed search used, so the counter must not skip ahead.
  let i = 0;
  const step = async (): Promise<void> => {
    await page.locator('.call-input').fill(SQUARES[i % 100] ?? 'A1');
    await page.locator('.call-input').press('Enter');
    i++;
  };
  while (!(await page.locator('.last-fleet-banner').count())) await step();
  await expect(tv.locator('.badge-last')).toHaveCount(1);
  await expect(tv.locator('.result-last-fleet')).toBeVisible();
  await expect(page.locator('.game-over')).toHaveCount(0);

  while (!(await page.locator('.game-over').count()) && i < 4000) await step();
  await expect(tv.locator('.over-result')).toContainText('was the last one still dressed');
});

test('or end the game as soon as one fleet is left', async ({ page, browser }) => {
  test.setTimeout(120_000);
  await deal(page, { lang: 'en', names: ['Amani', 'Bo', 'Chen'], seed });
  await handOut(page, browser);
  await page.locator('.handout-done button.primary').click();
  await callUntil(page, async () => (await page.locator('.last-fleet-banner').count()) > 0);
  await page.getByRole('button', { name: visibleText('en', 'play.endHere') }).click();
  await expect(page.locator('.over-result')).toContainText('is the last one still dressed!');
});
