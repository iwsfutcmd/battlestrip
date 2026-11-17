import { describe, expect, it } from 'vitest';
import { autoBoardSize, newGame, outfit, WARDROBE, wardrobeRules, type PlayerId, type ShipId } from '../src/engine/index.ts';
import { INTIMATE, TEST_OUTFITS, WRITTEN_PIECES } from '../scripts/test-outfits.ts';

describe('test outfits', () => {
  const ids = new Set(WARDROBE.map((w) => w.id as string));

  it('use only pieces from the wardrobe, each once', () => {
    expect(WRITTEN_PIECES.filter((p) => !ids.has(p))).toEqual([]);
    for (const o of TEST_OUTFITS) {
      expect(new Set(o.pieces).size).toBe(o.pieces.length);
      expect(o.pieces.length).toBeGreaterThan(0);
    }
    expect(new Set(TEST_OUTFITS.map((o) => o.id)).size).toBe(TEST_OUTFITS.length);
  });

  it('keep the underwear out of a variant and change nothing else', () => {
    for (const v of TEST_OUTFITS.filter((o) => o.variant === 'underwearKeptOut')) {
      const worn = TEST_OUTFITS.find((o) => o.base === v.base && o.variant === 'asWorn');
      expect(worn).toBeDefined();
      expect(v.pieces.some((p) => INTIMATE.includes(p))).toBe(false);
      expect(v.pieces).toEqual(worn?.pieces.filter((p) => !INTIMATE.includes(p)));
    }
  });

  it('can each be dealt at a table of Everyday outfits', () => {
    const base = wardrobeRules();
    for (const o of TEST_OUTFITS) {
      const fleets: ShipId[][] = [[...o.pieces], outfit('everyday'), outfit('everyday'), outfit('everyday')];
      const size = autoBoardSize(base, fleets);
      const g = newGame({ ...base, rows: size.rows, cols: size.cols }, fleets.map((fleet, i) => ({ id: `p${i}` as PlayerId, kind: 'bot', fleet })), 1);
      expect(g.ok, o.id).toBe(true);
    }
  });
});
