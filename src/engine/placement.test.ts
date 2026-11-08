import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { occupancy, placementsFor } from './board.ts';
import { newGame, reduce } from './game.ts';
import { presetRules } from './presets.ts';
import { randomLayout } from './placement.ts';
import { seedRng, type RngState } from './rng.ts';
import { pid, seat } from './test-utils.ts';
import type { PlacedShip, Rules, ShipId, ShipKindId } from './types.ts';

function smallRules(lengths: readonly number[], allowTouching: boolean): Rules {
  return {
    rows: 5,
    cols: 5,
    shipyard: lengths.map((length, i) => ({ id: `s${i}` as ShipId, kind: `k${length}` as ShipKindId, number: i + 1, length })),
    allowTouching,
    selfFire: true,
    announceShipOnHit: true,
    nuclear: true,
  };
}

/** Exact P(cell occupied) over all legal layouts, by brute-force enumeration. */
function exactOccupancy(rules: Rules): number[] {
  const counts = new Array<number>(rules.rows * rules.cols).fill(0);
  let layouts = 0;
  const recurse = (k: number, chosen: PlacedShip[]): void => {
    const ship = rules.shipyard[k];
    if (!ship) {
      const occ = occupancy(rules, chosen);
      if (!occ) return;
      layouts++;
      occ.forEach((o, i) => {
        if (o >= 0) counts[i] = (counts[i] ?? 0) + 1;
      });
      return;
    }
    for (const p of placementsFor(rules, ship.length)) recurse(k + 1, [...chosen, { ship: ship.id, ...p }]);
  };
  recurse(0, []);
  return counts.map((c) => c / layouts);
}

describe('random placement', () => {
  it.each([
    ['[3, 2] touching allowed', [3, 2], true],
    ['[3, 2, 2] no touching', [3, 2, 2], false],
    ['[4, 1, 1] no touching', [4, 1, 1], false],
  ] as const)('is uniform over legal layouts: %s', (_label, lengths, touching) => {
    const rules = smallRules(lengths, touching);
    const exact = exactOccupancy(rules);
    const n = 20_000;
    const counts = new Array<number>(25).fill(0);
    let rng: RngState = seedRng(12345);
    for (let i = 0; i < n; i++) {
      const [layout, next] = randomLayout(rules, rules.shipyard.map((s) => s.id), rng);
      rng = next;
      const occ = layout && occupancy(rules, layout);
      if (!occ) throw new Error('illegal layout');
      occ.forEach((o, j) => {
        if (o >= 0) counts[j] = (counts[j] ?? 0) + 1;
      });
    }
    exact.forEach((p, j) => {
      const observed = (counts[j] ?? 0) / n;
      const sigma = Math.sqrt((p * (1 - p)) / n);
      expect(Math.abs(observed - p), `cell ${j}: observed ${observed}, exact ${p}`).toBeLessThan(5 * sigma + 1e-9);
    });
  });

  it('a naive one-ship-at-a-time placer fails the same test (so the test has teeth)', () => {
    const rules = smallRules([3, 2, 2], false);
    const exact = exactOccupancy(rules);
    const n = 20_000;
    const counts = new Array<number>(25).fill(0);
    let rng: RngState = seedRng(1);
    const draw = (len: number): PlacedShip => {
      const opts = placementsFor(rules, len);
      const [k, next] = [Math.floor((rng.a / 2 ** 32) * opts.length), seedRng(rng.b ^ rng.c)];
      rng = next;
      const p = opts[k] ?? opts[0];
      if (!p) throw new Error('no placements');
      return { ship: 's0' as ShipId, ...p };
    };
    for (let i = 0; i < n; i++) {
      const chosen: PlacedShip[] = [];
      rules.shipyard.forEach((s) => {
        for (;;) {
          const p = { ...draw(s.length), ship: s.id };
          if (occupancy(rules, [...chosen, p])) {
            chosen.push(p);
            return;
          }
        }
      });
      occupancy(rules, chosen)?.forEach((o, j) => {
        if (o >= 0) counts[j] = (counts[j] ?? 0) + 1;
      });
    }
    const worst = Math.max(...exact.map((p, j) => Math.abs((counts[j] ?? 0) / n - p) / Math.sqrt((p * (1 - p)) / n)));
    expect(worst).toBeGreaterThan(5);
  });

  it('every placed layout is legal, for random rules and fleets', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 12 }),
        fc.integer({ min: 5, max: 12 }),
        fc.boolean(),
        fc.subarray([0, 1, 2, 3, 4], { minLength: 1 }),
        fc.nat(),
        (rows, cols, touching, picks, seed) => {
          // No-touch only for small fleets, so every generated case has a layout.
          const rules = presetRules('classic', { rows, cols, allowTouching: touching || picks.length > 2 });
          const fleet = picks.map((k) => rules.shipyard[k]?.id).filter((id): id is ShipId => id !== undefined);
          const [layout] = randomLayout(rules, fleet, seedRng(seed));
          expect(layout).not.toBeNull();
          if (layout) expect(occupancy(rules, layout)).not.toBeNull();
        },
      ),
      { numRuns: 200 },
    );
  });

  it('reports noLegalLayout when no layout exists', () => {
    // Four length-5 ships can't avoid touching on 5×5 (they'd need rows 0, 2, 4 and 6).
    const rules = smallRules([5, 5, 5, 5], false);
    expect(newGame(rules, [seat('a', ['s0', 's1', 's2', 's3']), seat('b', ['s0'])], 1)).toEqual({
      ok: false,
      error: 'noLegalLayout',
    });
  }, 20_000); // a million rejected attempts: about 2 s, longer on a busy machine

  it('rerolls change the layout version and (almost always) the layout', () => {
    const rules = presetRules('classic');
    const s0 = newGame(rules, [seat('a', ['carrier', 'cruiser']), seat('b', ['destroyer'])], 9);
    if (!s0.ok) throw new Error('setup failed');
    const r = reduce(s0.value, { kind: 'reroll', player: pid('a') });
    if (!r.ok) throw new Error('reroll failed');
    expect(r.value.state.layoutVersions).toEqual([1, 0]);
    expect(r.value.state.fleets[0]).not.toEqual(s0.value.fleets[0]);
    expect(r.value.state.fleets[1]).toEqual(s0.value.fleets[1]);
  });
});
