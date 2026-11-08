import { legalCalls, newGame, reduce, viewFor, type GameState, type Rules, type RuleViolation, type Seat } from '../engine/index.ts';
import { chooseCall, type BotKind } from './choose.ts';

/** A per-call seed that varies with the game seed, the turn and the seat. */
export function callSeed(gameSeed: number, turn: number, seat: number): number {
  return (Math.imul(gameSeed ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(turn + 1, 0xc2b2ae35) + seat) >>> 0;
}

export interface BotGame {
  readonly rules: Rules;
  readonly seats: readonly Seat[];
  readonly seed: number;
  /** The bot playing each seat, by seat index. */
  readonly bots: readonly BotKind[];
}

/** Play a whole game with bots in every seat. Bots see only viewFor(state, theirId). */
export function playBotGame(game: BotGame): GameState | RuleViolation {
  const created = newGame(game.rules, game.seats, game.seed);
  if (!created.ok) return created.error;
  const started = reduce(created.value, { kind: 'start' });
  if (!started.ok) return started.error;
  let s = started.value.state;
  const limit = game.rules.rows * game.rules.cols * game.seats.length + 1;
  while (s.phase === 'playing') {
    if (s.turn > limit) throw new Error('playBotGame: game did not end');
    const seat = s.seats[s.current];
    if (!seat) throw new Error('playBotGame: no current seat');
    const legal = legalCalls(s, seat.id);
    const at = chooseCall(game.bots[s.current] ?? 'density', viewFor(s, seat.id), legal, callSeed(game.seed, s.turn, s.current));
    const r = reduce(s, { kind: 'call', player: seat.id, at });
    if (!r.ok) throw new Error(`playBotGame: bot made an illegal call (${r.error})`);
    s = r.value.state;
  }
  return s;
}
