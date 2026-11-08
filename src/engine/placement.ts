import { indexOf, inBounds, placementsFor, type Placement } from './board.ts';
import { nextInt, type RngState } from './rng.ts';
import type { PlacedShip, Rules, ShipId } from './types.ts';

/** Whole-layout attempts before giving up with `noLegalLayout`. */
export const MAX_LAYOUT_ATTEMPTS = 1_000_000;

/**
 * A layout drawn uniformly from all legal layouts of `fleet`.
 *
 * Rejection sampling of whole layouts: every ship's placement is drawn
 * independently and uniformly from all its placements on the board, and the
 * whole draw is thrown away on any overlap (or touch, when touching is off).
 * Every legal layout is drawn with the same probability, the product of
 * 1/placements over the ships, so accepted layouts are uniform. Placing ships
 * one by one and retrying only the one that collides is biased towards edges
 * and corners, which is why it isn't done that way.
 *
 * Ships are drawn longest first so that most rejections happen early; that
 * changes nothing about which draws are accepted.
 *
 * Returns `null` (with the advanced RNG) if no layout was found within
 * `maxAttempts` draws.
 */
export function randomLayout(
  rules: Rules,
  fleet: readonly ShipId[],
  rng: RngState,
  maxAttempts: number = MAX_LAYOUT_ATTEMPTS,
): readonly [PlacedShip[] | null, RngState] {
  const ships = fleet.map((id) => {
    const ship = rules.shipyard.find((s) => s.id === id);
    if (!ship) throw new Error(`randomLayout: ${id} is not in the shipyard`);
    return ship;
  });
  const order = ships.map((_, i) => i).sort((a, b) => (ships[b]?.length ?? 0) - (ships[a]?.length ?? 0));
  const options = ships.map((s) => placementsFor(rules, s));

  const size = rules.rows * rules.cols;
  const taken = new Array<number>(size).fill(0);
  const blocked = new Array<number>(size).fill(0);
  const chosen = new Array<Placement | undefined>(ships.length);
  let state = rng;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let ok = true;
    for (const k of order) {
      const ship = ships[k];
      const opts = options[k];
      if (!ship || !opts || opts.length === 0) return [null, state];
      const [pick, next] = nextInt(state, opts.length);
      state = next;
      const placement = opts[pick];
      if (!placement) return [null, state];
      const cells = placement.cells;
      for (const c of cells) {
        const i = indexOf(rules, c);
        if (taken[i] === attempt || blocked[i] === attempt) {
          ok = false;
          break;
        }
      }
      if (!ok) break;
      for (const c of cells) {
        taken[indexOf(rules, c)] = attempt;
        if (!rules.allowTouching) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const n = { row: c.row + dr, col: c.col + dc };
              if (inBounds(rules, n)) blocked[indexOf(rules, n)] = attempt;
            }
          }
        }
      }
      chosen[k] = placement;
    }
    if (ok) {
      return [
        ships.map((s, k) => {
          const p = chosen[k];
          if (!p) throw new Error('unreachable');
          return { ship: s.id, origin: p.origin, orientation: p.orientation };
        }),
        state,
      ];
    }
  }
  return [null, state];
}
