import { describe, expect, it } from 'vitest';
import { gameSeed, mixSeed, runConfig, summarize, type SimConfig, type SimOptions } from '../scripts/sim-core.ts';

const options: SimOptions = { games: 12, seed: 3, preset: 'classic', rows: 10, cols: 10 };
const base: SimConfig = { players: 4, bots: 'density', fleets: 'random', nuclear: true, selfFire: true, announce: true };

describe('simulation core', () => {
  it('is deterministic', () => {
    expect(runConfig(base, options)).toEqual(runConfig(base, options));
  });

  it('pairs games across rule switches, so 2-player results ignore the nuclear switch', () => {
    // With two players the game ends when the first fleet sinks: no bombs are ever dropped.
    const two = { ...base, players: 2 };
    const on = runConfig(two, options);
    const off = runConfig({ ...two, nuclear: false }, options);
    expect(off.turns).toEqual(on.turns);
    expect(on.bombShare).toBe(0);
    expect(gameSeed(two, options, 5)).toBe(gameSeed({ ...two, nuclear: false, announce: false }, options, 5));
  });

  it('produces sane shares and bounds', () => {
    const r = runConfig(base, options);
    expect(r.games).toBe(12);
    expect(r.turns.median).toBeGreaterThan(0);
    expect(r.turns.p95).toBeLessThanOrEqual(100); // selfFire: at most rows × cols turns
    for (const share of [r.fleetlessShare, r.bombShare, r.selfHitTurnShare, r.noLastFleetShare]) {
      expect(share).toBeGreaterThanOrEqual(0);
      expect(share).toBeLessThanOrEqual(1);
    }
    const wins = r.lastFleetByPosition.reduce((a, b) => a + b, 0);
    expect(wins + r.noLastFleetShare).toBeCloseTo(1);
    expect(r.callsPerPlayer.mean).toBeCloseTo(r.turns.mean / 4);
  });

  it('summarize gives mean, median and nearest-rank p95', () => {
    expect(summarize([1, 2, 3, 4, 100])).toEqual({ mean: 22, median: 3, p95: 100 });
    expect(summarize(Array.from({ length: 100 }, (_, i) => i + 1))).toMatchObject({ median: 50, p95: 95 });
  });

  it('mixSeed separates nearby inputs', () => {
    const seeds = new Set(Array.from({ length: 1000 }, (_, i) => mixSeed(1, i)));
    expect(seeds.size).toBe(1000);
  });
});
