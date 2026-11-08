import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cellsOf, inBounds, indexOf } from './board.ts';
import { callCells, isAfloat, legalCalls, newGame, reduce, replay, resolveCells, targetSeats, undoLastCall } from './game.ts';
import { CLASSIC_SHIPYARD } from './presets.ts';
import { nextInt, seedRng, type RngState } from './rng.ts';
import { CELL_HIT, CELL_UNSHOT, type Coord, type GameEvent, type GameState, type Rules, type Seat, type ShipId } from './types.ts';
import { VIEW_UNSHOT, viewFor } from './view.ts';
import { pid } from './test-utils.ts';

interface Setup {
  readonly rules: Rules;
  readonly seats: readonly Seat[];
  readonly seed: number;
  readonly playSeed: number;
}

const setupArb: fc.Arbitrary<Setup> = fc
  .record({
    rows: fc.integer({ min: 5, max: 8 }),
    cols: fc.integer({ min: 5, max: 8 }),
    selfFire: fc.boolean(),
    announceShipOnHit: fc.boolean(),
    nuclear: fc.boolean(),
    playOut: fc.boolean(),
    fleets: fc.array(fc.subarray([0, 1, 2, 3, 4], { minLength: 1, maxLength: 3 }), { minLength: 2, maxLength: 5 }),
    seed: fc.nat(),
    playSeed: fc.nat(),
  })
  .map(({ rows, cols, selfFire, announceShipOnHit, nuclear, playOut, fleets, seed, playSeed }) => ({
    rules: { rows, cols, shipyard: CLASSIC_SHIPYARD, allowTouching: true, selfFire, announceShipOnHit, nuclear, playOut },
    seats: fleets.map((picks, i) => ({
      id: pid(`p${i}`),
      kind: 'bot' as const,
      fleet: picks.map((k) => CLASSIC_SHIPYARD[k]?.id).filter((id): id is ShipId => id !== undefined),
    })),
    seed,
    playSeed,
  }));

interface Step {
  readonly before: GameState;
  readonly after: GameState;
  readonly events: readonly GameEvent[];
  readonly at: Coord;
}

/** Play a whole game with uniformly random legal calls, recording every step. */
function playOut(setup: Setup): { start: GameState; steps: Step[] } {
  const created = newGame(setup.rules, setup.seats, setup.seed);
  if (!created.ok) throw new Error(`newGame: ${created.error}`);
  const started = reduce(created.value, { kind: 'start' });
  if (!started.ok) throw new Error('start failed');
  let s = started.value.state;
  let rng: RngState = seedRng(setup.playSeed);
  const steps: Step[] = [];
  while (s.phase === 'playing') {
    const player = s.seats[s.current]?.id;
    if (!player) throw new Error('no current player');
    const legal = legalCalls(s, player);
    expect(legal.length, 'legalCalls is never empty while playing').toBeGreaterThan(0);
    const [k, next] = nextInt(rng, legal.length);
    rng = next;
    const at = legal[k];
    if (!at) throw new Error('unreachable');
    const r = reduce(s, { kind: 'call', player, at });
    if (!r.ok) throw new Error(`a legal call was rejected: ${r.error}`);
    steps.push({ before: s, after: r.value.state, events: r.value.events, at });
    s = r.value.state;
    if (steps.length > setup.rules.rows * setup.rules.cols * setup.seats.length) throw new Error('game did not end');
  }
  return { start: started.value.state, steps };
}

const shotSet = (s: GameState, seat: number): string =>
  (s.boards[seat]?.cells ?? []).map((c) => (c === CELL_UNSHOT ? '.' : 'x')).join('');

const RUNS = { numRuns: 120 };

describe('engine properties', () => {
  it('every game ends; with selfFire within rows × cols turns', () => {
    fc.assert(
      fc.property(setupArb, (setup) => {
        const { steps } = playOut(setup);
        const last = steps.at(-1);
        expect(last?.after.phase).toBe('over');
        if (setup.rules.selfFire) expect(steps.length).toBeLessThanOrEqual(setup.rules.rows * setup.rules.cols);
      }),
      RUNS,
    );
  });

  it('ends exactly when no fleet is afloat, or (without playOut) when at most one is', () => {
    fc.assert(
      fc.property(setupArb, (setup) => {
        for (const { after, events } of playOut(setup).steps) {
          const afloat = after.seats.filter((_, i) => isAfloat(after, i)).length;
          const playingOut = setup.rules.playOut === true && setup.rules.nuclear && setup.rules.selfFire;
          const shouldEnd = afloat === 0 || (!playingOut && afloat <= 1);
          expect(after.phase === 'over').toBe(shouldEnd);
          const standing = events.find((e) => e.kind === 'lastFleetStanding');
          if (standing) expect(playingOut && afloat === 1).toBe(true);
          const over = events.find((e) => e.kind === 'gameOver');
          if (over?.kind === 'gameOver' && over.result.kind === 'playedOut') {
            expect(after.standing?.player).toBe(over.result.player);
          }
        }
      }),
      RUNS,
    );
  });

  it('with selfFire, every afloat board has the same shot set after every turn', () => {
    fc.assert(
      fc.property(setupArb.filter((s) => s.rules.selfFire), (setup) => {
        for (const { after } of playOut(setup).steps) {
          const afloat = after.seats.flatMap((_, i) => (isAfloat(after, i) ? [shotSet(after, i)] : []));
          expect(new Set(afloat).size).toBeLessThanOrEqual(1);
        }
      }),
      RUNS,
    );
  });

  it('a player goes nuclear exactly when their last ship sinks, then only bombs, and no turn is skipped', () => {
    fc.assert(
      fc.property(setupArb.filter((s) => s.rules.nuclear), (setup) => {
        const { start, steps } = playOut(setup);
        let expectedCurrent = start.current;
        for (const { before, after, events } of steps) {
          expect(before.current).toBe(expectedCurrent);
          expectedCurrent = (before.current + 1) % before.seats.length;
          const call = events[0];
          if (call?.kind !== 'shotCalled') throw new Error('first event must be shotCalled');
          expect(call.shape).toBe(isAfloat(before, before.current) ? 'single' : 'bomb');
          before.seats.forEach((seat, i) => {
            const allSunk = seat.fleet.every((id) => {
              const k = after.rules.shipyard.findIndex((s) => s.id === id);
              return (after.boards[i]?.hits[k] ?? 0) === after.rules.shipyard[k]?.length;
            });
            expect(isAfloat(after, i)).toBe(!allSunk);
            const went = events.some((e) => e.kind === 'wentNuclear' && e.player === seat.id);
            expect(went).toBe(isAfloat(before, i) && !isAfloat(after, i));
          });
        }
      }),
      RUNS,
    );
  });

  it('bombs never leave the board, and the order of a bomb’s squares never changes the outcome', () => {
    fc.assert(
      fc.property(setupArb.filter((s) => s.rules.nuclear), fc.nat(), (setup, permSeed) => {
        for (const { before, events } of playOut(setup).steps) {
          const call = events[0];
          if (call?.kind !== 'shotCalled' || call.shape !== 'bomb') continue;
          expect(call.cells.every((c) => inBounds(before.rules, c))).toBe(true);
          // The called square is always under the bomb, even when it moved back onto the board.
          expect(call.cells).toContainEqual(call.at);
          const turn = before.turn + 1;
          const a = resolveCells(before, before.current, call.cells, turn);
          const shuffled = [...call.cells].sort((x, y) => ((x.row * 31 + x.col + permSeed) % 7) - ((y.row * 31 + y.col + permSeed) % 7));
          const b = resolveCells(before, before.current, shuffled.reverse(), turn);
          expect(b.boards).toEqual(a.boards);
          const key = (e: GameEvent): string => JSON.stringify(e);
          expect(b.events.map(key).sort()).toEqual(a.events.map(key).sort());
        }
      }),
      RUNS,
    );
  });

  it('a ship sinks exactly when its hits equal its length; a sunk ship’s footprint is its hit squares', () => {
    fc.assert(
      fc.property(setupArb, (setup) => {
        for (const { before, after, events } of playOut(setup).steps) {
          after.seats.forEach((seat, i) => {
            for (const id of seat.fleet) {
              const k = after.rules.shipyard.findIndex((s) => s.id === id);
              const len = after.rules.shipyard[k]?.length ?? 0;
              const was = (before.boards[i]?.hits[k] ?? 0) === len;
              const is = (after.boards[i]?.hits[k] ?? 0) === len;
              const sunkNow = events.find((e) => e.kind === 'shipSunk' && e.board === seat.id && e.ship === id);
              expect(Boolean(sunkNow)).toBe(!was && is);
              if (sunkNow?.kind === 'shipSunk' && after.rules.announceShipOnHit) {
                const placed = after.fleets[i]?.find((p) => p.ship === id);
                if (!placed) throw new Error('missing ship');
                const footprint = cellsOf(after.rules, placed);
                expect(sunkNow.cells).toEqual(footprint);
                expect(footprint.every((c) => after.boards[i]?.cells[indexOf(after.rules, c)] === CELL_HIT)).toBe(true);
              }
            }
          });
        }
      }),
      RUNS,
    );
  });

  it('the spectator view never contains an unsunk ship’s unhit square or any layout', () => {
    fc.assert(
      fc.property(setupArb, (setup) => {
        for (const { after } of playOut(setup).steps) {
          const view = viewFor(after, 'spectator');
          const json = JSON.stringify(view);
          if (after.phase !== 'over') {
            expect(json).not.toContain('"origin"');
            expect(json).not.toContain('"orientation"');
          }
          after.boards.forEach((board, i) => {
            board.occupant.forEach((o, j) => {
              if (o >= 0 && board.cells[j] === CELL_UNSHOT) expect(view.boards[i]?.cells[j]).toBe(VIEW_UNSHOT);
            });
          });
          // A player's own view adds their own fleet and nothing else.
          const me = after.seats[0]?.id;
          if (me) {
            const mine = viewFor(after, me);
            expect({ ...mine, viewer: 'spectator', ownFleet: null }).toEqual(view);
            expect(mine.ownFleet).toEqual(after.fleets[0]);
          }
        }
      }),
      RUNS,
    );
  });

  it('is deterministic: replay matches the live state, and undo returns the previous state', () => {
    fc.assert(
      fc.property(setupArb, (setup) => {
        const { steps } = playOut(setup);
        const final = steps.at(-1)?.after;
        if (!final) return;
        const replayed = replay(setup.rules, setup.seats, setup.seed, final.actions);
        expect(replayed).toEqual({ ok: true, value: final });
        const again = playOut(setup).steps.at(-1)?.after;
        expect(JSON.stringify(again)).toBe(JSON.stringify(final));
        for (const { before, after } of steps.slice(-3)) {
          expect(undoLastCall(after)).toEqual({ ok: true, value: before });
        }
      }),
      { numRuns: 60 },
    );
  });

  it('reduce accepts exactly the calls legalCalls lists', () => {
    fc.assert(
      fc.property(setupArb, fc.nat(), (setup, pick) => {
        const { steps } = playOut(setup);
        const step = steps[pick % steps.length];
        if (!step) return;
        const s = step.before;
        const player = s.seats[s.current]?.id;
        if (!player) return;
        const legal = new Set(legalCalls(s, player).map((c) => `${c.row},${c.col}`));
        for (let row = -1; row <= s.rules.rows; row++) {
          for (let col = -1; col <= s.rules.cols; col++) {
            const r = reduce(s, { kind: 'call', player, at: { row, col } });
            expect(r.ok, `${row},${col}`).toBe(legal.has(`${row},${col}`));
          }
        }
        // Nobody else may call.
        for (const other of s.seats) {
          if (other.id === player) continue;
          expect(legalCalls(s, other.id)).toEqual([]);
          const first = [...legal][0]?.split(',').map(Number);
          if (first) expect(reduce(s, { kind: 'call', player: other.id, at: { row: first[0] ?? 0, col: first[1] ?? 0 } })).toEqual({ ok: false, error: 'notYourTurn' });
        }
        // Every legal call shoots at least one new square.
        const firstLegal = legalCalls(s, player)[0];
        if (firstLegal) {
          const cells = callCells(s.rules, isAfloat(s, s.current) || !s.rules.nuclear ? 'single' : 'bomb', firstLegal);
          const targets = targetSeats(s, s.current);
          expect(cells.some((c) => targets.some((t) => s.boards[t]?.cells[indexOf(s.rules, c)] === CELL_UNSHOT))).toBe(true);
        }
      }),
      RUNS,
    );
  });
});
