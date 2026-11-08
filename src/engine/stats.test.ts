import { describe, expect, it } from 'vitest';
import { gameStats } from './stats.ts';
import { ALL_CLASSIC, call, seat, ship, startedGame } from './test-utils.ts';

describe('gameStats', () => {
  const s0 = startedGame(
    [seat('Amani', ALL_CLASSIC), seat('Bo', ['battleship', 'cruiser', 'submarine']), seat('Chen', ['destroyer'])],
    {
      Amani: [
        ship('carrier', 'A1', 'alongRow'),
        ship('battleship', 'B1', 'alongRow'),
        ship('cruiser', 'H1', 'alongRow'),
        ship('submarine', 'I1', 'alongRow'),
        ship('destroyer', 'J1', 'alongRow'),
      ],
      Bo: [ship('cruiser', 'D3', 'alongRow'), ship('battleship', 'E5', 'alongRow'), ship('submarine', 'A8', 'alongRow')],
      Chen: [ship('destroyer', 'D4', 'alongRow')],
    },
    'Amani',
  );
  let s = call(s0, 'Amani', 'D4').state;
  s = call(s, 'Bo', 'D5').state;
  s = call(s, 'Chen', 'D4').state; // bomb: hits Bo's battleship at E5

  it('counts calls, hits, self-hits and sinkings per player', () => {
    const stats = gameStats(s);
    expect(stats.turns).toBe(3);
    expect(stats.selfHitTurns).toBe(1);
    const by = Object.fromEntries(stats.players.map((p) => [p.player, p]));
    expect(by['Amani']).toMatchObject({ singles: 1, bombs: 0, hitsDealt: 2, selfHits: 0, shipsSunk: 0 });
    expect(by['Bo']).toMatchObject({ singles: 1, hitsDealt: 1, selfHits: 1, shipsSunk: 1 });
    expect(by['Chen']).toMatchObject({ singles: 0, bombs: 1, hitsDealt: 1, bestBomb: 1, sunkOnTurn: 2 });
  });

  it('lists only the awards someone earned', () => {
    const awards = Object.fromEntries(gameStats(s).awards.map((a) => [a.kind, a]));
    expect(awards['friendlyFire']).toEqual({ kind: 'friendlyFire', winners: [{ player: 'Bo' }], count: 1 });
    expect(awards['firstNuclear']).toEqual({ kind: 'firstNuclear', winners: [{ player: 'Chen' }], count: 2 });
    expect(awards['biggestBomb']).toEqual({ kind: 'biggestBomb', winners: [{ player: 'Chen' }], count: 1 });
    expect(awards['longestSurvivor']).toEqual({
      kind: 'longestSurvivor',
      winners: [{ player: 'Chen', ship: 'destroyer' }],
      count: 2,
    });
    expect(awards['bombSinker']).toBeUndefined();
    expect(awards['sharpshooter']?.winners).toEqual([{ player: 'Amani' }]);
  });
});
