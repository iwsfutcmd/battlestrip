import { describe, expect, it } from 'vitest';
import { drawTable, fairness, playBalanceGame, ratioBucket, RATIO_BUCKETS, type BalanceOptions } from '../scripts/balance-core.ts';

const options: BalanceOptions = { games: 8, seed: 3, players: [3, 4, 5], dress: ['matched', 'mixed', 'random'], maxPieces: 6 };

describe('balance runs', () => {
  const games = Array.from({ length: options.games }, (_, g) => playBalanceGame(options, g));

  it('are repeatable from the seed', () => {
    expect(playBalanceGame(options, 5)).toEqual(games[5]);
    expect(drawTable(options, 2)).toEqual(drawTable(options, 2));
  });

  it('draw tables within the options, on a board sized to the outfits', () => {
    for (const g of games) {
      expect(options.players).toContain(g.players);
      expect(g.seats).toHaveLength(g.players);
      for (const s of g.seats) expect(s.pieces).toBeGreaterThanOrEqual(1);
      if (g.dress === 'random') for (const s of g.seats) expect(s.pieces).toBeLessThanOrEqual(options.maxPieces);
      expect(g.rows).toBeGreaterThanOrEqual(5);
      expect(g.coveredShare).toBeGreaterThan(0);
      expect(g.coveredShare).toBeLessThanOrEqual(1);
    }
  });

  it('record each game consistently', () => {
    for (const g of games) {
      expect(g.turns).toBeGreaterThan(0);
      const last = g.seats.filter((s) => s.lastDressed);
      expect(last.length).toBe(g.allStrippedTogether ? 0 : 1);
      if (g.holdOut !== null) expect(g.holdOut).toBeGreaterThanOrEqual(0);
      for (const s of g.seats) {
        expect(s.nakedShare).toBeGreaterThanOrEqual(0);
        expect(s.nakedShare).toBeLessThanOrEqual(1);
      }
      expect(new Set(g.seats.map((s) => s.position)).size).toBe(g.players);
    }
  });

  it('measure fairness against each table’s fair share', () => {
    const rows = fairness(games, (p) => ratioBucket(p.squaresRatio), RATIO_BUCKETS);
    const players = rows.reduce((a, r) => a + r.players, 0);
    expect(players).toBe(games.filter((g) => !g.allStrippedTogether).reduce((a, g) => a + g.players, 0));
  });
});
