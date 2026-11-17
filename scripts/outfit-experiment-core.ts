/**
 * What kind of game does one player have, depending on what they wear? One
 * "focus" player wears `count` pieces drawn from one size class while
 * everyone else wears a fixed ready-made outfit; the board is sized to all
 * the outfits as the lobby does, and the game plays on until everyone is
 * naked. Only the focus player's outfit varies, so differences between cells
 * are theirs. Pure apart from the bookkeeping: everything comes from the seed.
 */
import { playBotGame, type BotKind } from '../src/bots/index.ts';
import {
  autoBoardSize,
  fleetSquares,
  gameStats,
  nextInt,
  outfit,
  seedRng,
  WARDROBE,
  wardrobeRules,
  type OutfitId,
  type PlayerId,
  type RngState,
  type Seat,
  type ShipId,
} from '../src/engine/index.ts';
import { mixSeed } from './sim-core.ts';

export type SizeClass = 'small' | 'medium' | 'big';
export const SIZE_CLASSES: readonly SizeClass[] = ['small', 'medium', 'big'];

/** Squares per piece in each class (inclusive). */
export const SIZE_RANGE: Readonly<Record<SizeClass, readonly [number, number]>> = {
  small: [1, 2],
  medium: [3, 5],
  big: [6, 9],
};

export function piecesOfSize(size: SizeClass): ShipId[] {
  const [lo, hi] = SIZE_RANGE[size];
  return WARDROBE.filter((w) => w.length >= lo && w.length <= hi).map((w) => w.id);
}

export interface ExperimentOptions {
  readonly games: number;
  readonly seed: number;
  readonly players: number;
  readonly counts: readonly number[];
  readonly sizes: readonly SizeClass[];
  /** What everyone else wears. */
  readonly others: OutfitId;
  /** The first-shot hit chance the board is sized for (the game uses 0.5). */
  readonly target: number;
  /** The bot in every seat (default DensityBot). Seeds don't depend on it, so runs with different bots are paired. */
  readonly bots?: BotKind | undefined;
}

/** One game, from the focus player's side. Shares are of the game's turns (0 = the start, 1 = the last call). */
export interface FocusGame {
  readonly size: SizeClass;
  readonly count: number;
  readonly squares: number;
  readonly board: number;
  readonly turns: number;
  readonly firstOff: number;
  /** Their pieces off by halfway through the game, over their pieces. */
  readonly offByHalf: number;
  readonly nakedAt: number;
  readonly nakedShare: number;
  /** The longest stretch, from the start or a lost piece, until their next piece came off. */
  readonly longestWait: number;
  readonly lastDressed: boolean;
  /** They went out on the final call together with someone else, so nobody was the last one dressed. */
  readonly jointStrip: boolean;
}

function counter(seed: number): (n: number) => number {
  let state: RngState = seedRng(seed);
  return (n) => {
    const [i, next] = nextInt(state, n);
    state = next;
    return i;
  };
}

/** `k` distinct pieces from `pool`, uniformly, in wardrobe order. */
function draw(pool: readonly ShipId[], k: number, int: (n: number) => number): ShipId[] {
  const left = [...pool];
  const chosen = new Set<ShipId>();
  for (let i = 0; i < k && left.length > 0; i++) {
    const [id] = left.splice(int(left.length), 1);
    if (id !== undefined) chosen.add(id);
  }
  return pool.filter((id) => chosen.has(id));
}

export function playFocusGame(o: ExperimentOptions, size: SizeClass, count: number, g: number): FocusGame {
  const cell = SIZE_CLASSES.indexOf(size) * 1000 + count;
  const int = counter(mixSeed(o.seed, cell, g, 0xf0c5));
  const focus = draw(piecesOfSize(size), count, int);
  const fleets: ShipId[][] = [focus, ...Array.from({ length: o.players - 1 }, () => outfit(o.others))];
  const base = wardrobeRules({ playOut: true });
  const sized = autoBoardSize(base, fleets, o.target);
  const rules = { ...base, rows: sized.rows, cols: sized.cols };
  const seats: Seat[] = fleets.map((fleet, i) => ({ id: `p${i}` as PlayerId, kind: 'bot', fleet }));
  const s = playBotGame({ rules, seats, seed: mixSeed(o.seed, cell, g, 0x9a3e), bots: seats.map(() => o.bots ?? 'density') });
  if (typeof s === 'string') throw new Error(`${size} × ${count}, game ${g}: setup failed (${s})`);
  const stats = gameStats(s);
  const T = Math.max(1, stats.turns);
  const me = seats[0]?.id;
  const lost = s.events.flatMap((e) => (e.kind === 'shipSunk' && e.board === me ? [e.turn] : [])).sort((a, b) => a - b);
  const nakedTurn = stats.players[0]?.sunkOnTurn ?? T;
  const marks = [0, ...lost];
  let longest = 0;
  for (let i = 1; i < marks.length; i++) longest = Math.max(longest, (marks[i] ?? 0) - (marks[i - 1] ?? 0));
  const lastTurn = Math.max(...stats.players.map((p) => p.sunkOnTurn ?? 0));
  const result = s.result;
  return {
    size,
    count: focus.length,
    squares: fleetSquares(rules, focus),
    board: rules.rows * rules.cols,
    turns: stats.turns,
    firstOff: (lost[0] ?? T) / T,
    offByHalf: lost.filter((t) => t <= T / 2).length / Math.max(1, focus.length),
    nakedAt: nakedTurn / T,
    nakedShare: (T - nakedTurn) / T,
    longestWait: longest / T,
    lastDressed: (result?.kind === 'playedOut' || result?.kind === 'lastFleet') && result.player === me,
    jointStrip: result?.kind === 'allNuclear' && nakedTurn === lastTurn,
  };
}

export interface CellSummary {
  readonly size: SizeClass;
  readonly count: number;
  readonly games: number;
  readonly squares: number;
  readonly board: number;
  readonly turns: number;
  readonly firstOff: number;
  readonly offByHalf: number;
  readonly longestWait: number;
  readonly nakedAt: number;
  readonly nakedShare: number;
  readonly lastDressed: number;
  /** lastDressed over a fair share (1 in the number of players). */
  readonly lastDressedMultiplier: number;
  readonly jointStrip: number;
}

export function summarizeCell(games: readonly FocusGame[], players: number): CellSummary {
  const mean = (f: (g: FocusGame) => number): number => games.reduce((a, g) => a + f(g), 0) / Math.max(1, games.length);
  const first = games[0];
  const lastDressed = mean((g) => (g.lastDressed ? 1 : 0));
  return {
    size: first?.size ?? 'small',
    count: first?.count ?? 0,
    games: games.length,
    squares: mean((g) => g.squares),
    board: mean((g) => g.board),
    turns: mean((g) => g.turns),
    firstOff: mean((g) => g.firstOff),
    offByHalf: mean((g) => g.offByHalf),
    longestWait: mean((g) => g.longestWait),
    nakedAt: mean((g) => g.nakedAt),
    nakedShare: mean((g) => g.nakedShare),
    lastDressed,
    lastDressedMultiplier: lastDressed * players,
    jointStrip: mean((g) => (g.jointStrip ? 1 : 0)),
  };
}
