import { describe, expect, it } from 'vitest';
import { newGame } from './game.ts';
import { autoBoardSize, BOARD_SIZES, boardSizesFor, fleetFits, fleetSquares, hitChance, TARGET_HIT_CHANCE } from './sizing.ts';
import { outfit, WARDROBE, wardrobeRules } from './wardrobe.ts';
import type { PlayerId, ShipId } from './types.ts';

const everyday = outfit('everyday');
const rules = wardrobeRules();

describe('hitChance', () => {
  it('is 1 − ∏(1 − s/A)', () => {
    expect(hitChance([], 100)).toBe(0);
    expect(hitChance([25], 100)).toBeCloseTo(0.25);
    expect(hitChance([50, 50], 100)).toBeCloseTo(0.75);
    expect(hitChance([200], 100)).toBe(1);
  });
});

describe('BOARD_SIZES', () => {
  it('runs from 5×5 to 20×20, square or one column wider, in increasing area', () => {
    expect(BOARD_SIZES[0]).toEqual({ rows: 5, cols: 5 });
    expect(BOARD_SIZES.at(-1)).toEqual({ rows: 20, cols: 20 });
    for (const [i, s] of BOARD_SIZES.entries()) {
      expect(s.cols - s.rows).toBeGreaterThanOrEqual(0);
      expect(s.cols - s.rows).toBeLessThanOrEqual(1);
      const prev = BOARD_SIZES[i - 1];
      if (prev) expect(s.rows * s.cols).toBeGreaterThan(prev.rows * prev.cols);
    }
  });
});

describe('autoBoardSize', () => {
  it('counts an outfit’s squares', () => {
    expect(fleetSquares(rules, everyday)).toBe(13);
  });

  it('gets smaller with fewer players and keeps a first shot near 50%', () => {
    const sizes = [2, 3, 4, 5, 6, 7, 8].map((n) => autoBoardSize(rules, Array.from({ length: n }, () => everyday)));
    for (const [i, s] of sizes.entries()) {
      expect(s.fits).toBe(true);
      expect(Math.abs(s.chance - TARGET_HIT_CHANCE)).toBeLessThan(0.05);
      const prev = sizes[i - 1];
      if (prev) expect(s.rows * s.cols).toBeGreaterThan(prev.rows * prev.cols);
    }
    expect(sizes.map((s) => `${s.rows}×${s.cols}`)).toEqual(['6×7', '8×8', '9×9', '10×10', '11×11', '12×12', '12×13']);
  });

  it('picks the size closest to the target', () => {
    const squares = [13, 13, 13];
    const [best] = boardSizesFor(squares);
    if (!best) throw new Error('no size');
    const gap = (s: { rows: number; cols: number }): number => Math.abs(hitChance(squares, s.rows * s.cols) - 0.5);
    for (const s of BOARD_SIZES) expect(gap(best)).toBeLessThanOrEqual(gap(s));
  });

  it('counts bigger outfits', () => {
    const bundled = outfit('bundledUp');
    const small = autoBoardSize(rules, [everyday, everyday]);
    const big = autoBoardSize(rules, [bundled, bundled]);
    expect(big.rows * big.cols).toBeGreaterThan(small.rows * small.cols);
  });

  it('never goes below 5×5', () => {
    const tiny = autoBoardSize(rules, [['ring' as ShipId], ['ring' as ShipId]]);
    expect(tiny).toMatchObject({ rows: 5, cols: 5, fits: true });
  });

  it('grows when the closest size can’t hold an outfit', () => {
    // Two beach outfits would get 6×6, but without touching each piece needs room around it.
    const strict = wardrobeRules({ allowTouching: false });
    const beach = [outfit('beachDay'), outfit('beachDay')];
    const [closest] = boardSizesFor(beach.map((f) => fleetSquares(strict, f)));
    expect(closest).toEqual({ rows: 6, cols: 6 });
    expect(fleetFits({ ...strict, rows: 6, cols: 6 }, outfit('beachDay'))).toBe(false);
    expect(autoBoardSize(strict, beach)).toMatchObject({ rows: 6, cols: 7, fits: true });
    // With touching allowed, 6×6 is fine.
    expect(autoBoardSize(rules, beach)).toMatchObject({ rows: 6, cols: 6, fits: true });
  });

  it('gives up at 20×20 when nothing fits', () => {
    const everything = WARDROBE.map((s) => s.id);
    const size = autoBoardSize(wardrobeRules({ allowTouching: false }), [everything, everything]);
    expect(size).toMatchObject({ rows: 20, cols: 20, fits: false });
  });

  it('deals a game on the size it picks', () => {
    const fleets = [everyday, outfit('beachDay'), outfit('nightIn')];
    const size = autoBoardSize(rules, fleets);
    const g = newGame({ ...rules, ...size }, fleets.map((fleet, i) => ({ id: `p${i}` as PlayerId, kind: 'human', fleet })), 7);
    expect(g.ok).toBe(true);
  });
});
