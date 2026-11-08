import { nextInt, seedRng, placedCells, VIEW_UNSHOT, type Coord, type PlayerView } from '../engine/index.ts';

/** The viewer's seat index in the view, or -1 for a spectator. */
export function viewerSeat(view: PlayerView): number {
  return view.viewer === 'spectator' ? -1 : view.seats.findIndex((s) => s.id === view.viewer);
}

/**
 * Seats whose boards a call by `me` resolves on: every afloat board, minus
 * the caller's own without selfFire (the engine's target rule, from public
 * information only).
 */
export function targetSeats(view: PlayerView, me: number): number[] {
  const out: number[] = [];
  view.players.forEach((p, i) => {
    if (!p.afloat) return;
    if (i === me && !view.rules.selfFire) return;
    out.push(i);
  });
  return out;
}

/**
 * The viewer's own unhit ship squares, as 0/1 over the board. All zero for
 * spectators or when the view carries no own fleet.
 */
export function ownUnhitSquares(view: PlayerView, me: number): Uint8Array {
  const { rows, cols } = view.rules;
  const out = new Uint8Array(rows * cols);
  const board = view.boards[me]?.cells;
  if (!view.ownFleet || !board) return out;
  for (const placed of view.ownFleet) {
    const ship = view.rules.shipyard.find((s) => s.id === placed.ship);
    if (!ship) continue;
    for (const c of placedCells(ship, placed.origin, placed.orientation)) {
      const i = c.row * cols + c.col;
      if (board[i] === VIEW_UNSHOT) out[i] = 1;
    }
  }
  return out;
}

/** A uniformly random element, deterministic in `seed`. */
export function pick<T>(items: readonly T[], seed: number): T {
  if (items.length === 0) throw new Error('pick: nothing to choose from');
  const [k] = nextInt(seedRng(seed), items.length);
  const item = items[k];
  if (item === undefined) throw new Error('unreachable');
  return item;
}

export const coordIndex = (view: PlayerView, c: Coord): number => c.row * view.rules.cols + c.col;
