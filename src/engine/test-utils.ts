import { presetRules } from './presets.ts';
import { reduce } from './game.ts';
import type { Action, Axis, Coord, GameEvent, GameState, PlacedShip, PlayerId, Rules, Seat, ShipId, ShipKindId, ShipyardShip } from './types.ts';
import { newGame } from './game.ts';

/** "D4" → row 3, col 3 (Latin rows, 1-based columns), for readable tests. */
export function at(label: string): Coord {
  const m = /^([A-Z])(\d+)$/u.exec(label);
  if (!m?.[1] || !m[2]) throw new Error(`bad label ${label}`);
  return { row: m[1].charCodeAt(0) - 65, col: Number(m[2]) - 1 };
}

export const pid = (id: string): PlayerId => id as PlayerId;
export const sid = (id: string): ShipId => id as ShipId;

export function seat(id: string, fleet: readonly string[], kind: Seat['kind'] = 'human'): Seat {
  return { id: pid(id), kind, fleet: fleet.map(sid) };
}

/**
 * The spec's naval shipyard (§2.1), so the worked examples in §2.4 stay
 * verbatim. The game itself ships clothing (presets.ts); the engine only
 * cares about lengths.
 */
export const NAVAL_SHIPYARD: readonly ShipyardShip[] = (
  [
    ['carrier', 5],
    ['battleship', 4],
    ['cruiser', 3],
    ['submarine', 3],
    ['destroyer', 2],
  ] as const
).map(([id, length], i) => ({ id: id as ShipId, kind: id as string as ShipKindId, number: i + 1, length }));

export const navalRules = (overrides: Partial<Rules> = {}): Rules => presetRules('classic', { shipyard: NAVAL_SHIPYARD, ...overrides });

export const ALL_CLASSIC = NAVAL_SHIPYARD.map((s) => s.id);

export function ship(id: string, origin: string, axis: Axis): PlacedShip {
  return { ship: sid(id), origin: at(origin), axis };
}

export function must<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.value;
}

/**
 * A started game with the given layouts, where the seeded RNG happens to let
 * `first` go first (we search seeds; everything stays deterministic).
 */
export function startedGame(
  seats: readonly Seat[],
  layouts: Readonly<Record<string, readonly PlacedShip[]>>,
  first: string,
  rules: Rules = navalRules(),
): GameState {
  for (let seed = 0; seed < 10_000; seed++) {
    let s = must(newGame(rules, seats, seed));
    for (const [player, fleet] of Object.entries(layouts)) {
      s = must(reduce(s, { kind: 'place', player: pid(player), fleet })).state;
    }
    s = must(reduce(s, { kind: 'start' })).state;
    if (s.seats[s.current]?.id === first) return s;
  }
  throw new Error('no seed lets that player go first');
}

export function call(s: GameState, player: string, label: string): { state: GameState; events: readonly GameEvent[] } {
  return must(reduce(s, { kind: 'call', player: pid(player), at: at(label) } satisfies Action));
}

/** Compact "board:square:outcome[:ship]" strings for resolved shots, sorted. */
export function resolved(events: readonly GameEvent[]): string[] {
  return events
    .flatMap((e) =>
      e.kind === 'shotResolved'
        ? [`${e.board}:${String.fromCharCode(65 + e.at.row)}${e.at.col + 1}:${e.outcome}${e.ship ? `:${e.ship}` : ''}`]
        : [],
    )
    .sort();
}
