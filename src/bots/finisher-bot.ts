import { bombFootprint, type Coord, type PlayerView } from '../engine/index.ts';
import { boardDensity } from './density-bot.ts';
import { coordIndex, ownUnhitSquares, pick, targetSeats, viewerSeat } from './common.ts';

const EPSILON = 1e-9;
/** Weight of everything else in finishing mode: only enough to break ties between equally good squares for the chosen piece. */
const TIEBREAK = 1e-3;

/**
 * FinisherBot plays like a person chasing a hit: "let's finish Amani's
 * jeans." While any opponent has a piece with a named hit that is still on,
 * it picks one such piece, the one with the fewest squares left to hit (ties:
 * the one whose next square is likeliest), and calls where that piece can
 * still be, by the same placement density as DensityBot, until it comes off.
 * With nothing hit, it searches like DensityBot. Like DensityBot it avoids its
 * own unhit squares (each costs 1 expected self-hit). Ties are broken with
 * the seeded RNG.
 *
 * DensityBot, by contrast, calls the square with the most expected hits over
 * everyone's boards, so a piece whose remaining squares don't overlap anyone
 * else's tends to be left half-hit.
 */
export function finisherBotCall(view: PlayerView, legal: readonly Coord[], seed: number): Coord {
  const me = viewerSeat(view);
  const { rows, cols, shipyard } = view.rules;
  const size = rows * cols;
  const bomb = view.currentShape === 'bomb';
  const at = (field: Float64Array, c: Coord): number =>
    bomb ? bombFootprint(view.rules, c).reduce((s, x) => s + (field[coordIndex(view, x)] ?? 0), 0) : (field[coordIndex(view, c)] ?? 0);

  const all = new Float64Array(size);
  const wounded: { seat: number; ship: string; left: number }[] = [];
  for (const seat of targetSeats(view, me)) {
    if (seat === me) continue;
    const d = boardDensity(view, seat);
    for (let i = 0; i < size; i++) all[i] = (all[i] ?? 0) + (d[i] ?? 0);
    const cells = view.boards[seat]?.cells;
    if (!cells || !view.rules.announceShipOnHit) continue;
    for (const p of view.players[seat]?.ships ?? []) {
      if (p.sunk) continue;
      const k = shipyard.findIndex((s) => s.id === p.ship);
      let hits = 0;
      for (let i = 0; i < size; i++) if (cells[i] === k) hits++;
      if (hits > 0) wounded.push({ seat, ship: p.ship, left: p.length - hits });
    }
  }

  const selfTarget = !bomb && me >= 0 && view.rules.selfFire && view.players[me]?.afloat === true;
  const own = selfTarget ? ownUnhitSquares(view, me) : new Uint8Array(size);
  const ownCost = (c: Coord): number => (bomb ? 0 : (own[coordIndex(view, c)] ?? 0));

  // The piece to finish: fewest squares left, then the likeliest next square.
  let focus: Float64Array | null = null;
  let focusKey = [Infinity, -Infinity];
  for (const w of wounded) {
    const d = boardDensity(view, w.seat, 'wounded', w.ship);
    let best = 0;
    for (const c of legal) {
      const v = at(d, c) - ownCost(c);
      if (v > best) best = v;
    }
    if (best <= EPSILON) continue;
    if (w.left < (focusKey[0] ?? Infinity) || (w.left === focusKey[0] && best > (focusKey[1] ?? -Infinity) + EPSILON)) {
      focus = d;
      focusKey = [w.left, best];
    }
  }

  const scoreOf = (c: Coord): number => (focus ? at(focus, c) + TIEBREAK * at(all, c) : at(all, c)) - ownCost(c);
  let best = -Infinity;
  let ties: Coord[] = [];
  for (const c of legal) {
    const s = scoreOf(c);
    if (s > best + EPSILON) {
      best = s;
      ties = [c];
    } else if (Math.abs(s - best) <= EPSILON) {
      ties.push(c);
    }
  }
  return pick(ties, seed);
}

