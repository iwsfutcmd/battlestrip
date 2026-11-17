import { describe, expect, it } from 'vitest';
import { piecesOfSize, playFocusGame, SIZE_RANGE, summarizeCell, type ExperimentOptions } from '../scripts/outfit-experiment-core.ts';
import { WARDROBE } from '../src/engine/index.ts';

const options: ExperimentOptions = { games: 4, seed: 2, players: 4, counts: [2], sizes: ['small', 'big'], others: 'everyday', target: 0.5 };

describe('outfit experiment', () => {
  it('draws pieces from the right size class', () => {
    for (const size of ['small', 'medium', 'big'] as const) {
      const [lo, hi] = SIZE_RANGE[size];
      for (const id of piecesOfSize(size)) {
        const len = WARDROBE.find((w) => w.id === id)?.length ?? 0;
        expect(len).toBeGreaterThanOrEqual(lo);
        expect(len).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('is repeatable and records sane shares', () => {
    const games = Array.from({ length: 4 }, (_, g) => playFocusGame(options, 'big', 2, g));
    expect(playFocusGame(options, 'big', 2, 1)).toEqual(games[1]);
    for (const g of games) {
      expect(g.count).toBe(2);
      expect(g.squares).toBeGreaterThanOrEqual(12);
      for (const share of [g.firstOff, g.offByHalf, g.nakedAt, g.nakedShare, g.longestWait]) {
        expect(share).toBeGreaterThanOrEqual(0);
        expect(share).toBeLessThanOrEqual(1);
      }
      expect(g.lastDressed && g.jointStrip).toBe(false);
    }
    const cell = summarizeCell(games, 4);
    expect(cell.lastDressedMultiplier).toBeCloseTo(cell.lastDressed * 4);
  });
});
