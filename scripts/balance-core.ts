/**
 * Balance runs for the game as it is played now: wardrobe outfits, the board
 * sized to the outfits (autoBoardSize), play on after one player is left
 * dressed, DensityBot in every seat. Each game draws its own table (player
 * count, outfits), so a few hundred games cover the space; summarize() then
 * slices the records by player count, by how the table dressed, and by how
 * much each player wore compared with the rest of the table.
 *
 * Pure apart from the bookkeeping: everything comes from the seed.
 */
import { playBotGame } from '../src/bots/index.ts';
import {
  autoBoardSize,
  cellsOf,
  fleetSquares,
  gameStats,
  nextInt,
  OUTFIT_IDS,
  outfit,
  seedRng,
  TARGET_HIT_CHANCE,
  WARDROBE,
  wardrobeRules,
  type PlayerId,
  type RngState,
  type Rules,
  type Seat,
  type ShipId,
} from '../src/engine/index.ts';
import { mixSeed } from './sim-core.ts';

/**
 * How the table dresses:
 * - `matched`: everyone in the same ready-made outfit;
 * - `mixed`: each player picks a ready-made outfit of their own;
 * - `random`: each player wears 1 to `maxPieces` pieces drawn from the whole wardrobe.
 */
export type Dress = 'matched' | 'mixed' | 'random';
export const DRESS: readonly Dress[] = ['matched', 'mixed', 'random'];

export interface BalanceOptions {
  readonly games: number;
  readonly seed: number;
  readonly players: readonly number[];
  readonly dress: readonly Dress[];
  readonly maxPieces: number;
  /** The first-shot hit chance the board is sized for (the game uses 0.5). */
  readonly target?: number | undefined;
}

export interface PlayerRecord {
  readonly pieces: number;
  readonly squares: number;
  /** This player's squares over the table's mean. */
  readonly squaresRatio: number;
  /** 0 = called first. */
  readonly position: number;
  /** The turn their last piece came off, or null if they never stripped. */
  readonly nakedOnTurn: number | null;
  /** Share of the game's turns spent with nothing on. */
  readonly nakedShare: number;
  /** The last one still dressed (shares no title with anyone if everyone stripped on the same call). */
  readonly lastDressed: boolean;
  readonly selfHits: number;
}

export interface GameRecord {
  readonly game: number;
  readonly dress: Dress;
  readonly players: number;
  readonly rows: number;
  readonly cols: number;
  /** The estimate the board was sized by: a random first shot hits someone. */
  readonly targetHitChance: number;
  /** The real thing on this game's layouts: squares under at least one piece, over all squares. */
  readonly coveredShare: number;
  readonly turns: number;
  /** When the first player was down to nothing. */
  readonly firstNakedTurn: number | null;
  /** When only one player was left dressed (null if the last ones stripped together). */
  readonly lastDressedFrom: number | null;
  /** Turns the last one dressed held out once everyone else was naked. */
  readonly holdOut: number | null;
  readonly allStrippedTogether: boolean;
  readonly selfHitTurns: number;
  /** When each piece came off, as a share of the game (0 = the start, 1 = the last call). */
  readonly piecesOff: readonly number[];
  /** Pieces worn at the table. */
  readonly pieces: number;
  readonly seats: readonly PlayerRecord[];
}

/** A seeded source of whole numbers in [0, n), threading the engine's pure RNG. */
function counter(seed: number): (n: number) => number {
  let state: RngState = seedRng(seed);
  return (n) => {
    const [i, next] = nextInt(state, n);
    state = next;
    return i;
  };
}

function pick<T>(items: readonly T[], int: (n: number) => number): T {
  const item = items[int(items.length)];
  if (item === undefined) throw new Error('pick: empty list');
  return item;
}

/** `k` distinct items, uniformly (a partial Fisher–Yates shuffle), kept in their original order. */
function draw<T>(items: readonly T[], k: number, int: (n: number) => number): T[] {
  const pool = items.map((_, i) => i);
  const chosen = new Set<number>();
  for (let i = 0; i < k && pool.length > 0; i++) {
    const [j] = pool.splice(int(pool.length), 1);
    if (j !== undefined) chosen.add(j);
  }
  return items.filter((_, i) => chosen.has(i));
}

/** The table for game `g`: who plays, how they dress, and the rules (board already sized). */
export function drawTable(options: BalanceOptions, g: number): { dress: Dress; fleets: ShipId[][]; rules: Rules } {
  const int = counter(mixSeed(options.seed, g, 0xba1a));
  const n = pick(options.players, int);
  const dress = pick(options.dress, int);
  const everyone = dress === 'matched' ? pick(OUTFIT_IDS, int) : null;
  const ids = WARDROBE.map((w) => w.id);
  const fleets: ShipId[][] = Array.from({ length: n }, () => {
    if (everyone) return outfit(everyone);
    if (dress === 'mixed') return outfit(pick(OUTFIT_IDS, int));
    return draw(ids, 1 + int(options.maxPieces), int);
  });
  const base = wardrobeRules({ playOut: true });
  const size = autoBoardSize(base, fleets, options.target ?? TARGET_HIT_CHANCE);
  return { dress, fleets, rules: { ...base, rows: size.rows, cols: size.cols } };
}

export function playBalanceGame(options: BalanceOptions, g: number): GameRecord {
  const { dress, fleets, rules } = drawTable(options, g);
  const seats: Seat[] = fleets.map((fleet, i) => ({ id: `p${i}` as PlayerId, kind: 'bot', fleet }));
  const s = playBotGame({ rules, seats, seed: mixSeed(options.seed, g, 0x9a3e), bots: seats.map(() => 'density') });
  if (typeof s === 'string') throw new Error(`game ${g}: setup failed (${s})`);
  const stats = gameStats(s);
  const n = seats.length;
  const area = rules.rows * rules.cols;
  const squares = fleets.map((f) => fleetSquares(rules, f));
  const meanSquares = squares.reduce((a, b) => a + b, 0) / n;

  const covered = new Set<number>();
  for (const fleet of s.fleets) for (const p of fleet) for (const c of cellsOf(rules, p)) covered.add(c.row * rules.cols + c.col);
  const targetHitChance = 1 - squares.reduce((miss, sq) => miss * (1 - sq / area), 1);

  const result = s.result;
  const lastId = result?.kind === 'playedOut' || result?.kind === 'lastFleet' ? result.player : null;
  const lastDressedFrom = result?.kind === 'playedOut' ? result.standingFrom : null;
  const sunk = stats.players.map((p) => p.sunkOnTurn).filter((t): t is number => t !== null);
  return {
    game: g,
    dress,
    players: n,
    rows: rules.rows,
    cols: rules.cols,
    targetHitChance,
    coveredShare: covered.size / area,
    turns: stats.turns,
    firstNakedTurn: sunk.length > 0 ? Math.min(...sunk) : null,
    lastDressedFrom,
    holdOut: lastDressedFrom === null ? null : stats.turns - lastDressedFrom,
    allStrippedTogether: lastId === null,
    selfHitTurns: stats.selfHitTurns,
    piecesOff: s.events.flatMap((e) => (e.kind === 'shipSunk' && stats.turns > 0 ? [Math.min(1, e.turn / stats.turns)] : [])),
    pieces: fleets.reduce((a, f) => a + f.length, 0),
    seats: stats.players.map((p, i) => ({
      pieces: fleets[i]?.length ?? 0,
      squares: squares[i] ?? 0,
      squaresRatio: meanSquares === 0 ? 1 : (squares[i] ?? 0) / meanSquares,
      position: (i - s.firstPlayer + n) % n,
      nakedOnTurn: p.sunkOnTurn,
      nakedShare: p.sunkOnTurn === null || stats.turns === 0 ? 0 : (stats.turns - p.sunkOnTurn) / stats.turns,
      lastDressed: seats[i]?.id === lastId,
      selfHits: p.selfHits,
    })),
  };
}

// ---- Summaries ------------------------------------------------------------------------------

export interface Spread {
  readonly mean: number;
  readonly median: number;
  readonly p95: number;
}

export function spread(values: readonly number[]): Spread {
  if (values.length === 0) return { mean: NaN, median: NaN, p95: NaN };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? NaN;
  return { mean: values.reduce((a, b) => a + b, 0) / values.length, median: at(0.5), p95: at(0.95) };
}

export interface GroupRow {
  readonly key: string;
  readonly games: number;
  readonly boardSquares: Spread;
  readonly coveredShare: number;
  readonly turns: Spread;
  readonly callsPerPlayer: number;
  /** First player naked, as a share of the game. */
  readonly firstNakedShare: number;
  readonly nakedShare: number;
  readonly holdOut: Spread;
  readonly allStrippedTogether: number;
  readonly selfHitTurnShare: number;
  /** The first piece off, as a share of the game. */
  readonly firstPieceOff: number;
  /** Share of all pieces off by ¼, ½ and ¾ of the way through the game. */
  readonly piecesOffBy: readonly [number, number, number];
}

export function groupRow(key: string, games: readonly GameRecord[]): GroupRow {
  const mean = (xs: readonly number[]): number => (xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length);
  const turns = games.reduce((a, g) => a + g.turns, 0);
  return {
    key,
    games: games.length,
    boardSquares: spread(games.map((g) => g.rows * g.cols)),
    coveredShare: mean(games.map((g) => g.coveredShare)),
    turns: spread(games.map((g) => g.turns)),
    callsPerPlayer: mean(games.map((g) => g.turns / g.players)),
    firstNakedShare: mean(games.flatMap((g) => (g.firstNakedTurn === null || g.turns === 0 ? [] : [g.firstNakedTurn / g.turns]))),
    nakedShare: mean(games.flatMap((g) => g.seats.map((p) => p.nakedShare))),
    holdOut: spread(games.flatMap((g) => (g.holdOut === null ? [] : [g.holdOut]))),
    allStrippedTogether: mean(games.map((g) => (g.allStrippedTogether ? 1 : 0))),
    selfHitTurnShare: turns === 0 ? 0 : games.reduce((a, g) => a + g.selfHitTurns, 0) / turns,
    firstPieceOff: mean(games.flatMap((g) => (g.piecesOff.length === 0 ? [] : [Math.min(...g.piecesOff)]))),
    piecesOffBy: ([0.25, 0.5, 0.75] as const).map((q) => {
      const total = games.reduce((a, g) => a + g.pieces, 0);
      return total === 0 ? NaN : games.reduce((a, g) => a + g.piecesOff.filter((t) => t <= q).length, 0) / total;
    }) as unknown as [number, number, number],
  };
}

export interface FairnessRow {
  readonly key: string;
  readonly players: number;
  /** How often they were the last one dressed, over the fair share (1/n at their table). 1 = fair. */
  readonly lastDressedMultiplier: number;
  readonly nakedShare: number;
}

/** Players grouped by `bucket`; each group's last-dressed rate against the fair share at its tables. */
export function fairness(games: readonly GameRecord[], bucket: (p: PlayerRecord, g: GameRecord) => string | null, order: readonly string[]): FairnessRow[] {
  const acc = new Map<string, { players: number; won: number; fair: number; naked: number }>();
  for (const g of games) {
    if (g.allStrippedTogether) continue;
    for (const p of g.seats) {
      const key = bucket(p, g);
      if (key === null) continue;
      const a = acc.get(key) ?? { players: 0, won: 0, fair: 0, naked: 0 };
      a.players += 1;
      a.won += p.lastDressed ? 1 : 0;
      a.fair += 1 / g.players;
      a.naked += p.nakedShare;
      acc.set(key, a);
    }
  }
  return order.flatMap((key) => {
    const a = acc.get(key);
    return a ? [{ key, players: a.players, lastDressedMultiplier: a.fair === 0 ? NaN : a.won / a.fair, nakedShare: a.naked / a.players }] : [];
  });
}

export const RATIO_BUCKETS = ['under ½', '½–⅘', '⅘–1¼', '1¼–2', 'over 2'] as const;

export function ratioBucket(ratio: number): (typeof RATIO_BUCKETS)[number] {
  if (ratio < 0.5) return 'under ½';
  if (ratio < 0.8) return '½–⅘';
  if (ratio <= 1.25) return '⅘–1¼';
  if (ratio <= 2) return '1¼–2';
  return 'over 2';
}
