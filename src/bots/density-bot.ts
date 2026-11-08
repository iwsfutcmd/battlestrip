import { placementsFor, shapeOf, VIEW_HIT, VIEW_UNSHOT, type Coord, type PlayerView, type ShipyardShip } from '../engine/index.ts';
import { coordIndex, ownUnhitSquares, pick, targetSeats, viewerSeat } from './common.ts';

/** Weight per unattributed hit a placement covers (classic hit-only reporting; simulation only). */
export const UNATTRIBUTED_HIT_WEIGHT = 30;

interface Placement {
  /** Board indices the ship would occupy. */
  readonly cells: Int32Array;
  /** The 8-neighbourhood ring around it, for no-touching rules. */
  readonly ring: Int32Array;
}

const placementCache = new Map<string, readonly Placement[]>();

function placements(rows: number, cols: number, ship: Pick<ShipyardShip, 'length' | 'shape'>): readonly Placement[] {
  const key = `${rows}x${cols}:${shapeOf(ship).map(([r, c]) => `${r},${c}`).join(';')}`;
  const cached = placementCache.get(key);
  if (cached) return cached;
  const out = placementsFor({ rows, cols }, ship).map(({ cells }): Placement => {
    const mine = new Set<number>(cells.map((c) => c.row * cols + c.col));
    const ring = new Set<number>();
    for (const i of mine) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
          const j = rr * cols + cc;
          if (!mine.has(j)) ring.add(j);
        }
      }
    }
    return { cells: Int32Array.from(mine), ring: Int32Array.from(ring) };
  });
  placementCache.set(key, out);
  return out;
}

/**
 * Expected number of new ship squares on each square of one board, from public
 * information: for every unsunk ship of that player, the share of its
 * consistent placements that cover the square, summed over ships (each ship
 * normalised on its own).
 *
 * A placement is consistent if it covers *all* of that ship's named hits, no
 * miss, and no square hit on a different ship (nor touches one, when ships
 * may not touch). With unattributed hits (classic reporting, simulation
 * only), placements covering them get a heavy weight instead.
 */
export function boardDensity(view: PlayerView, seat: number): Float64Array {
  const { rows, cols, shipyard, allowTouching, announceShipOnHit } = view.rules;
  const size = rows * cols;
  const density = new Float64Array(size);
  const cells = view.boards[seat]?.cells;
  const player = view.players[seat];
  if (!cells || !player) return density;
  const acc = new Float64Array(size);

  for (const ship of player.ships) {
    if (ship.sunk) continue;
    const k = shipyard.findIndex((s) => s.id === ship.ship);
    let named = 0;
    if (announceShipOnHit) for (let i = 0; i < size; i++) if (cells[i] === k) named++;
    acc.fill(0);
    let total = 0;
    for (const p of placements(rows, cols, ship)) {
      let covered = 0;
      let unknown = 0;
      let ok = true;
      for (const j of p.cells) {
        const code = cells[j] ?? VIEW_UNSHOT;
        if (code === VIEW_UNSHOT) continue;
        if (code === k) covered++;
        else if (code === VIEW_HIT) unknown++;
        else {
          ok = false; // a miss, or another ship's hit
          break;
        }
      }
      if (!ok || covered !== named) continue;
      if (!allowTouching) {
        for (const j of p.ring) {
          const code = cells[j] ?? VIEW_UNSHOT;
          if (code >= 0 && code !== k) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
      }
      const w = unknown > 0 ? UNATTRIBUTED_HIT_WEIGHT ** unknown : 1;
      total += w;
      for (const j of p.cells) if (cells[j] === VIEW_UNSHOT) acc[j] = (acc[j] ?? 0) + w;
    }
    if (total > 0) for (let i = 0; i < size; i++) density[i] = (density[i] ?? 0) + (acc[i] ?? 0) / total;
  }
  return density;
}

const EPSILON = 1e-9;

/**
 * Score each legal call by expected hits on the other target boards minus
 * expected hits on its own board (1 on its own unhit ship square); score
 * bombs by expected hits over their squares, with no self term. Ties are
 * broken with the seeded RNG.
 */
export function densityBotCall(view: PlayerView, legal: readonly Coord[], seed: number): Coord {
  const me = viewerSeat(view);
  const { cols } = view.rules;
  const size = view.rules.rows * cols;
  const expected = new Float64Array(size);
  for (const seat of targetSeats(view, me)) {
    if (seat === me) continue;
    const d = boardDensity(view, seat);
    for (let i = 0; i < size; i++) expected[i] = (expected[i] ?? 0) + (d[i] ?? 0);
  }

  let scoreOf: (c: Coord) => number;
  if (view.currentShape === 'bomb') {
    scoreOf = (c) => {
      const i = coordIndex(view, c);
      return (expected[i] ?? 0) + (expected[i + 1] ?? 0) + (expected[i + cols] ?? 0) + (expected[i + cols + 1] ?? 0);
    };
  } else {
    const selfTarget = me >= 0 && view.rules.selfFire && view.players[me]?.afloat === true;
    const own = selfTarget ? ownUnhitSquares(view, me) : new Uint8Array(size);
    scoreOf = (c) => {
      const i = coordIndex(view, c);
      return (expected[i] ?? 0) - (own[i] ?? 0);
    };
  }

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
