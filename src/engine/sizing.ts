import { randomLayout } from './placement.ts';
import { MAX_SIDE, MIN_SIDE } from './presets.ts';
import { seedRng } from './rng.ts';
import type { Rules, ShipId } from './types.ts';

/** What auto-sizing aims for: a first shot at a random square hits someone half the time. */
export const TARGET_HIT_CHANCE = 0.5;

/** Draws a feasibility probe makes before calling a board too small for a fleet. */
export const PROBE_ATTEMPTS = 5_000;

export interface BoardSize {
  readonly rows: number;
  readonly cols: number;
}

/**
 * The chance that one square, picked uniformly, holds a piece of at least one
 * fleet, when fleet `p` covers `squares[p]` of the `area` squares. Fleets are
 * laid out independently, and a random square is under a given fleet with
 * probability `s/area`, so this is `1 − ∏(1 − s/area)`. (It treats every square
 * as equally likely to be covered; edges are covered a little less often, so it
 * is a close estimate, not an exact one.)
 */
export function hitChance(squares: readonly number[], area: number): number {
  if (area <= 0) return 0;
  let miss = 1;
  for (const s of squares) miss *= 1 - Math.min(1, Math.max(0, s) / area);
  return 1 - miss;
}

/**
 * Every board the auto-sizer picks from, smallest first: square boards and
 * boards one column wider (a little wider than tall suits a TV), from
 * MIN_SIDE×MIN_SIDE to MAX_SIDE×MAX_SIDE.
 */
export const BOARD_SIZES: readonly BoardSize[] = (() => {
  const out: BoardSize[] = [];
  for (let r = MIN_SIDE; r <= MAX_SIDE; r++) {
    out.push({ rows: r, cols: r });
    if (r < MAX_SIDE) out.push({ rows: r, cols: r + 1 });
  }
  return out;
})();

/** The squares each fleet covers: the sum of its pieces' sizes. */
export function fleetSquares(rules: Pick<Rules, 'shipyard'>, fleet: readonly ShipId[]): number {
  let n = 0;
  for (const id of fleet) n += rules.shipyard.find((s) => s.id === id)?.length ?? 0;
  return n;
}

/**
 * The candidate sizes in the order to try them: the one whose hit chance is
 * closest to `target` first, then every larger size (for when a fleet will not
 * fit). Ties go to the smaller board.
 */
export function boardSizesFor(squares: readonly number[], target = TARGET_HIT_CHANCE): readonly BoardSize[] {
  let best = 0;
  let bestGap = Infinity;
  BOARD_SIZES.forEach((size, i) => {
    const gap = Math.abs(hitChance(squares, size.rows * size.cols) - target);
    if (gap < bestGap) {
      best = i;
      bestGap = gap;
    }
  });
  return BOARD_SIZES.slice(best);
}

/** Whether a random layout of `fleet` turned up within `attempts` draws (a fixed seed, so the answer is repeatable). */
export function fleetFits(rules: Rules, fleet: readonly ShipId[], attempts = PROBE_ATTEMPTS): boolean {
  if (fleet.length === 0) return true;
  for (const id of fleet) {
    const ship = rules.shipyard.find((s) => s.id === id);
    if (!ship) return false;
  }
  return randomLayout(rules, fleet, seedRng(0x5eed), attempts)[0] !== null;
}

export interface AutoSize extends BoardSize {
  /** The estimated chance a first shot hits someone on this board. */
  readonly chance: number;
  /** False when even the largest board failed the probe (dealing will report the problem). */
  readonly fits: boolean;
}

/** The first size in `candidates` on which every fleet can be laid out, or the last one if none passes. */
function firstThatFits(rules: Rules, fleets: readonly (readonly ShipId[])[], candidates: readonly BoardSize[]): { size: BoardSize; fits: boolean } {
  // Identical fleets need probing once.
  const keys = fleets.map((f) => [...f].sort().join(','));
  const distinct = fleets.filter((_, i) => keys.indexOf(keys[i] ?? '') === i);
  for (const size of candidates) {
    const sized: Rules = { ...rules, rows: size.rows, cols: size.cols };
    if (distinct.every((f) => fleetFits(sized, f))) return { size, fits: true };
  }
  return { size: candidates[candidates.length - 1] ?? { rows: MAX_SIDE, cols: MAX_SIDE }, fits: false };
}

/**
 * The board for these fleets: the size whose first-shot hit chance is closest
 * to `target`, or the next size up on which every fleet can be laid out.
 * `rules` supplies the shipyard and the touching rule; its size is ignored.
 */
export function autoBoardSize(rules: Rules, fleets: readonly (readonly ShipId[])[], target = TARGET_HIT_CHANCE): AutoSize {
  const squares = fleets.map((f) => fleetSquares(rules, f));
  const { size, fits } = firstThatFits(rules, fleets, boardSizesFor(squares, target));
  return { ...size, chance: hitChance(squares, size.rows * size.cols), fits };
}

// ---- Sizing for game length -------------------------------------------------------------

/**
 * How many calls a whole game takes, from bot games: each square under
 * someone's clothes costs about 0.85 calls to clear (less than one, since
 * naked players' bombs clear four at once) and each empty square about 0.58.
 * Two-player games run about a third longer, because each player avoids their
 * own squares and the last squares left hold both outfits. Fitted to 1,500
 * DensityBot games, 2–8 players, on boards sized for 25–85% first-shot hit
 * chances; for 3–8 players it is within about 6% on average and 11% for a
 * typical single game. People search less well than the bot, so real games run longer.
 */
export const LENGTH_MODEL = { covered: 0.848, empty: 0.579, twoPlayers: 1.34 } as const;

/** Predicted calls in a whole game (every player's turns together), played on until everyone is naked. */
export function predictTurns(squares: readonly number[], area: number): number {
  const covered = hitChance(squares, area);
  const turns = area * (LENGTH_MODEL.covered * covered + LENGTH_MODEL.empty * (1 - covered));
  return squares.length === 2 ? turns * LENGTH_MODEL.twoPlayers : turns;
}

/** Candidate sizes for a game of about `turns` calls: the closest first, then every larger size. */
export function boardSizesForLength(squares: readonly number[], turns: number): readonly BoardSize[] {
  let best = 0;
  let bestGap = Infinity;
  BOARD_SIZES.forEach((size, i) => {
    const gap = Math.abs(predictTurns(squares, size.rows * size.cols) - turns);
    if (gap < bestGap) {
      best = i;
      bestGap = gap;
    }
  });
  return BOARD_SIZES.slice(best);
}

export interface LengthSize extends AutoSize {
  /** Predicted calls in the whole game on this board. */
  readonly turns: number;
}

/** The board for a game of about `turns` calls, or the next size up on which every fleet can be laid out. */
export function autoBoardSizeForLength(rules: Rules, fleets: readonly (readonly ShipId[])[], turns: number): LengthSize {
  const squares = fleets.map((f) => fleetSquares(rules, f));
  const { size, fits } = firstThatFits(rules, fleets, boardSizesForLength(squares, turns));
  const area = size.rows * size.cols;
  return { ...size, chance: hitChance(squares, area), fits, turns: predictTurns(squares, area) };
}
