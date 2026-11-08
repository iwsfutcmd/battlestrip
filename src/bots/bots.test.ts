import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CLASSIC_SHIPYARD,
  legalCalls,
  newGame,
  presetRules,
  reduce,
  shipCells,
  viewFor,
  type Coord,
  type GameState,
  type Rules,
  type Seat,
  type ShipId,
} from '../engine/index.ts';
import { at, call, pid, seat, ship, startedGame } from '../engine/test-utils.ts';
import { boardDensity, callSeed, chooseCall, chooseFleet, playBotGame, type BotKind } from './index.ts';

const key = (c: Coord): string => `${c.row},${c.col}`;

const setupArb = fc
  .record({
    rows: fc.integer({ min: 5, max: 8 }),
    cols: fc.integer({ min: 5, max: 8 }),
    selfFire: fc.boolean(),
    announceShipOnHit: fc.boolean(),
    nuclear: fc.boolean(),
    allowTouching: fc.boolean(),
    fleets: fc.array(fc.subarray([0, 1, 2, 3, 4], { minLength: 1, maxLength: 2 }), { minLength: 2, maxLength: 4 }),
    bots: fc.array(fc.constantFrom<BotKind>('density', 'random'), { minLength: 4, maxLength: 4 }),
    seed: fc.nat(),
  })
  .map(({ fleets, bots, seed, ...r }) => ({
    rules: { ...r, shipyard: CLASSIC_SHIPYARD } satisfies Rules,
    seats: fleets.map(
      (picks, i): Seat => ({
        id: pid(`p${i}`),
        kind: 'bot',
        fleet: picks.map((k) => CLASSIC_SHIPYARD[k]?.id).filter((id): id is ShipId => id !== undefined),
      }),
    ),
    bots,
    seed,
  }));

describe('bots', () => {
  it('only ever choose legal calls, in every rule variant', () => {
    fc.assert(
      fc.property(setupArb, ({ rules, seats, bots, seed }) => {
        const created = newGame(rules, seats, seed);
        if (!created.ok) throw new Error(created.error);
        const started = reduce(created.value, { kind: 'start' });
        if (!started.ok) throw new Error(started.error);
        let s = started.value.state;
        while (s.phase === 'playing') {
          const me = s.seats[s.current];
          if (!me) throw new Error('no current seat');
          const legal = legalCalls(s, me.id);
          const choice = chooseCall(bots[s.current] ?? 'density', viewFor(s, me.id), legal, callSeed(seed, s.turn, s.current));
          expect(legal.map(key)).toContain(key(choice));
          const r = reduce(s, { kind: 'call', player: me.id, at: choice });
          if (!r.ok) throw new Error(r.error);
          s = r.value.state;
        }
      }),
      { numRuns: 80 },
    );
  });

  it('are deterministic in the seed', () => {
    const rules = presetRules('classic');
    const seats = [seat('a', ['carrier', 'destroyer'], 'bot'), seat('b', ['cruiser'], 'bot'), seat('c', ['battleship'], 'bot')];
    for (const kind of ['density', 'random'] as const) {
      const one = playBotGame({ rules, seats, seed: 5, bots: [kind, kind, kind] });
      const two = playBotGame({ rules, seats, seed: 5, bots: [kind, kind, kind] });
      expect(JSON.stringify(one)).toBe(JSON.stringify(two));
    }
  });
});

describe('RandomBot', () => {
  it('avoids its own unhit ship squares while afloat, when it can', () => {
    const s = startedGame(
      [seat('me', ['carrier'], 'bot'), seat('you', ['destroyer'], 'bot')],
      { me: [ship('carrier', 'C2', 'alongRow')], you: [ship('destroyer', 'J9', 'alongRow')] },
      'me',
    );
    const own = new Set(shipCells(at('C2'), 'alongRow', 5).map(key));
    const view = viewFor(s, pid('me'));
    const legal = legalCalls(s, pid('me'));
    for (let seed = 0; seed < 300; seed++) expect(own.has(key(chooseCall('random', view, legal, seed)))).toBe(false);
  });

  it('calls its own square if nothing else is legal', () => {
    const s = startedGame(
      [seat('me', ['carrier'], 'bot'), seat('you', ['destroyer'], 'bot')],
      { me: [ship('carrier', 'C2', 'alongRow')], you: [ship('destroyer', 'J9', 'alongRow')] },
      'me',
    );
    const legal = [at('C3')];
    expect(chooseCall('random', viewFor(s, pid('me')), legal, 1)).toEqual(at('C3'));
  });
});

describe('DensityBot', () => {
  function afterOneNamedHit(): GameState {
    const s0 = startedGame(
      [seat('me', ['destroyer'], 'bot'), seat('you', ['carrier'], 'bot')],
      { me: [ship('destroyer', 'J1', 'alongRow')], you: [ship('carrier', 'E3', 'alongRow')] },
      'me',
    );
    let s = call(s0, 'me', 'E5').state; // hit: carrier
    s = call(s, 'you', 'A10').state; // a miss everywhere
    return s;
  }

  it('after a single named hit on an opponent, calls a square orthogonally adjacent to it', () => {
    const s = afterOneNamedHit();
    const adjacent = new Set(['D5', 'F5', 'E4', 'E6'].map((l) => key(at(l))));
    for (let seed = 0; seed < 50; seed++) {
      const c = chooseCall('density', viewFor(s, pid('me')), legalCalls(s, pid('me')), seed);
      expect(adjacent.has(key(c))).toBe(true);
    }
  });

  it('puts the density of a hit ship only on placements through that hit', () => {
    const s = afterOneNamedHit();
    const d = boardDensity(viewFor(s, pid('me')), 1);
    // Carrier (5) through E5: 5 placements along the row, 5 along the column.
    expect(d[at('E4').row * 10 + at('E4').col]).toBeCloseTo(0.4);
    expect(d[at('C5').row * 10 + at('C5').col]).toBeCloseTo(0.3);
    expect(d[at('A1').row * 10 + at('A1').col]).toBe(0);
    expect(d[at('E5').row * 10 + at('E5').col]).toBe(0); // already shot
  });

  it('never calls its own unhit ship square when a free square scores as well', () => {
    const s0 = startedGame(
      [seat('me', ['carrier'], 'bot'), seat('you', ['carrier'], 'bot')],
      { me: [ship('carrier', 'E3', 'alongRow')], you: [ship('carrier', 'A1', 'alongCol')] },
      'me',
    );
    const own = new Set(shipCells(at('E3'), 'alongRow', 5).map(key));
    const c = chooseCall('density', viewFor(s0, pid('me')), legalCalls(s0, pid('me')), 3);
    expect(own.has(key(c))).toBe(false);
  });

  it('beats RandomBot: shorter games, and wins most head-to-heads', () => {
    const rules = presetRules('classic');
    const fleet = CLASSIC_SHIPYARD.map((s) => s.id);
    const seats = [seat('a', fleet, 'bot'), seat('b', fleet, 'bot')];
    let densityTurns = 0;
    let randomTurns = 0;
    let densityWins = 0;
    const games = 30;
    for (let g = 0; g < games; g++) {
      const d = playBotGame({ rules, seats, seed: g, bots: ['density', 'density'] });
      const r = playBotGame({ rules, seats, seed: g, bots: ['random', 'random'] });
      const h = playBotGame({ rules, seats, seed: g, bots: g % 2 ? ['density', 'random'] : ['random', 'density'] });
      if (typeof d === 'string' || typeof r === 'string' || typeof h === 'string') throw new Error('setup failed');
      densityTurns += d.turn;
      randomTurns += r.turn;
      const densitySeat = g % 2 ? 'a' : 'b';
      if (h.result?.kind === 'lastFleet' && h.result.player === densitySeat) densityWins++;
    }
    expect(densityTurns).toBeLessThan(randomTurns);
    expect(densityWins / games).toBeGreaterThan(0.6);
  });
});

describe('chooseFleet', () => {
  const rules = presetRules('classic');
  it('full takes the whole shipyard', () => {
    expect(chooseFleet({ kind: 'full' }, rules, 1)).toEqual(CLASSIC_SHIPYARD.map((s) => s.id));
  });
  it('fixed keeps shipyard order and falls back to full when empty', () => {
    const ships = ['destroyer', 'carrier', 'nope'] as ShipId[];
    expect(chooseFleet({ kind: 'fixed', ships }, rules, 1)).toEqual(['carrier', 'destroyer']);
    expect(chooseFleet({ kind: 'fixed', ships: [] }, rules, 1)).toHaveLength(5);
  });
  it('random is a non-empty subset, every subset reachable, roughly uniform', () => {
    const counts: Record<string, number> = {};
    for (let seed = 0; seed < 31 * 200; seed++) {
      const fleet = chooseFleet({ kind: 'random' }, rules, seed);
      expect(fleet.length).toBeGreaterThan(0);
      expect(new Set(fleet).size).toBe(fleet.length);
      counts[fleet.join(',')] = (counts[fleet.join(',')] ?? 0) + 1;
    }
    expect(Object.keys(counts)).toHaveLength(31);
    for (const n of Object.values(counts)) expect(n).toBeGreaterThan(120);
  });
});
