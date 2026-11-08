import { VIEW_MISS, VIEW_UNSHOT, type Coord, type GameEvent, type PlayerId, type PlayerView, type ShipId } from '../../engine/index.ts';

export interface SharedCell {
  readonly called: boolean;
  /** Seat indices hit on this square. */
  readonly hits: readonly number[];
  /** A sunk ship covers this square on at least one board. */
  readonly sunk: boolean;
}

/**
 * The one shared grid (§2.5): with self-hits every afloat board has the same
 * shots, so a square is either a miss or marked with everyone hit there.
 */
export function sharedGrid(view: PlayerView): SharedCell[] {
  const { rows, cols } = view.rules;
  const called = new Array<boolean>(rows * cols).fill(false);
  for (const e of view.events) {
    if (e.kind === 'shotCalled') for (const c of e.cells) called[c.row * cols + c.col] = true;
  }
  const sunk = new Array<boolean>(rows * cols).fill(false);
  for (const p of view.players) for (const s of p.ships) if (s.cells) for (const c of s.cells) sunk[c.row * cols + c.col] = true;
  return called.map((isCalled, i) => {
    const hits: number[] = [];
    view.boards.forEach((b, seat) => {
      const v = b.cells[i] ?? VIEW_UNSHOT;
      if (v !== VIEW_UNSHOT && v !== VIEW_MISS) hits.push(seat);
    });
    return { called: isCalled || hits.length > 0, hits, sunk: sunk[i] ?? false };
  });
}

export interface CallSummary {
  readonly turn: number;
  readonly by: PlayerId;
  readonly at: Coord;
  readonly shape: 'single' | 'bomb';
  readonly cells: readonly Coord[];
  /** Footprint squares that resolved nowhere (already called everywhere). */
  readonly noOps: readonly Coord[];
  readonly hits: readonly { readonly board: PlayerId; readonly ship: ShipId | null; readonly at: Coord }[];
  readonly sunk: readonly { readonly board: PlayerId; readonly ship: ShipId }[];
  readonly nuclear: readonly PlayerId[];
  readonly gameOver: boolean;
}

export function summarizeTurn(events: readonly GameEvent[], turn: number): CallSummary | null {
  const mine = events.filter((e) => e.turn === turn);
  const call = mine.find((e) => e.kind === 'shotCalled');
  if (call?.kind !== 'shotCalled') return null;
  const resolvedAt = new Set(mine.flatMap((e) => (e.kind === 'shotResolved' ? [`${e.at.row},${e.at.col}`] : [])));
  return {
    turn,
    by: call.by,
    at: call.at,
    shape: call.shape,
    cells: call.cells,
    noOps: call.cells.filter((c) => !resolvedAt.has(`${c.row},${c.col}`)),
    hits: mine.flatMap((e) => (e.kind === 'shotResolved' && e.outcome === 'hit' ? [{ board: e.board, ship: e.ship ?? null, at: e.at }] : [])),
    sunk: mine.flatMap((e) => (e.kind === 'shipSunk' ? [{ board: e.board, ship: e.ship }] : [])),
    nuclear: mine.flatMap((e) => (e.kind === 'wentNuclear' || e.kind === 'knockedOut' ? [e.player] : [])),
    gameOver: mine.some((e) => e.kind === 'gameOver'),
  };
}
