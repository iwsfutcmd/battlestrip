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

/**
 * The board for these fleets: the size whose first-shot hit chance is closest
 * to `target`, or the next size up on which every fleet can be laid out.
 * `rules` supplies the shipyard and the touching rule; its size is ignored.
 */
export function autoBoardSize(rules: Rules, fleets: readonly (readonly ShipId[])[], target = TARGET_HIT_CHANCE): AutoSize {
  const squares = fleets.map((f) => fleetSquares(rules, f));
  // Identical fleets need probing once.
  const keys = fleets.map((f) => [...f].sort().join(','));
  const distinct = fleets.filter((_, i) => keys.indexOf(keys[i] ?? '') === i);
  const candidates = boardSizesFor(squares, target);
  for (const size of candidates) {
    const sized: Rules = { ...rules, rows: size.rows, cols: size.cols };
    if (distinct.every((f) => fleetFits(sized, f))) {
      return { ...size, chance: hitChance(squares, size.rows * size.cols), fits: true };
    }
  }
  const largest = candidates[candidates.length - 1] ?? { rows: MAX_SIDE, cols: MAX_SIDE };
  return { ...largest, chance: hitChance(squares, largest.rows * largest.cols), fits: false };
}
