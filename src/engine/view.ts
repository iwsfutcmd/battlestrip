import { shipCells } from './board.ts';
import { isAfloat } from './game.ts';
import {
  CELL_HIT,
  CELL_MISS,
  type GameEvent,
  type GameResult,
  type GameState,
  type PlacedShip,
  type Phase,
  type PlayerId,
  type Rules,
  type Seat,
  type ShipId,
  type Coord,
} from './types.ts';

/** Public cell codes in a view: a shipyard index (≥ 0) means "hit on that ship". */
export const VIEW_UNSHOT = -1;
export const VIEW_MISS = -2;
/** A hit whose ship isn't announced (only with `announceShipOnHit: false`). */
export const VIEW_HIT = -3;

export interface ShipView {
  readonly ship: ShipId;
  readonly length: number;
  /** Hits so far; null when hits aren't attributed to ships. */
  readonly hits: number | null;
  readonly sunk: boolean;
  /** Known once sunk (always equal to its hits when hits are named). */
  readonly cells: readonly Coord[] | null;
}

export interface PlayerPublicView {
  readonly id: PlayerId;
  readonly kind: Seat['kind'];
  readonly afloat: boolean;
  /** Turn their last ship sank on, or null while afloat. */
  readonly sunkOnTurn: number | null;
  readonly ships: readonly ShipView[];
}

export interface BoardView {
  readonly player: PlayerId;
  /** `row * cols + col` → VIEW_UNSHOT, VIEW_MISS, VIEW_HIT, or the shipyard index hit there. */
  readonly cells: readonly number[];
}

export interface PlayerView {
  readonly viewer: PlayerId | 'spectator';
  readonly rules: Rules;
  readonly seats: readonly Seat[];
  readonly phase: Phase;
  /** Calls made so far. */
  readonly turn: number;
  /** Whose call it is, while playing. */
  readonly current: PlayerId | null;
  readonly currentShape: 'single' | 'bomb' | null;
  readonly players: readonly PlayerPublicView[];
  readonly boards: readonly BoardView[];
  /** The viewer's own fleet; null for spectators. */
  readonly ownFleet: readonly PlacedShip[] | null;
  /** Every fleet, once the game is over; null before. */
  readonly revealed: readonly (readonly PlacedShip[])[] | null;
  readonly events: readonly GameEvent[];
  readonly result: GameResult | null;
  /** With `playOut`: the last fleet standing, once there is one (public). */
  readonly standing: { readonly player: PlayerId; readonly turn: number } | null;
}

/**
 * What `viewer` may know. Spectators (the TV, the control panel) get only
 * public information; a player additionally gets their own fleet. No other
 * function exposes hidden information except `fleetOf`.
 */
export function viewFor(s: GameState, viewer: PlayerId | 'spectator'): PlayerView {
  const { rules } = s;
  const viewerSeat = viewer === 'spectator' ? -1 : s.seats.findIndex((seat) => seat.id === viewer);
  const players = s.seats.map((seat, i): PlayerPublicView => {
    const board = s.boards[i];
    const ships = seat.fleet.map((id): ShipView => {
      const k = rules.shipyard.findIndex((ship) => ship.id === id);
      const def = rules.shipyard[k];
      const length = def?.length ?? 0;
      const hits = board?.hits[k] ?? 0;
      const sunk = hits >= length;
      const placed = sunk ? s.fleets[i]?.find((p) => p.ship === id) : undefined;
      return {
        ship: id,
        length,
        hits: rules.announceShipOnHit ? hits : null,
        sunk,
        cells: sunk && placed && rules.announceShipOnHit ? shipCells(placed.origin, placed.axis, length) : null,
      };
    });
    return { id: seat.id, kind: seat.kind, afloat: isAfloat(s, i), sunkOnTurn: s.status[i]?.sunkOnTurn ?? null, ships };
  });
  const boards = s.seats.map((seat, i): BoardView => {
    const board = s.boards[i];
    const cells = (board?.cells ?? []).map((c, j) => {
      if (c === CELL_MISS) return VIEW_MISS;
      if (c === CELL_HIT) return rules.announceShipOnHit ? (board?.occupant[j] ?? VIEW_HIT) : VIEW_HIT;
      return VIEW_UNSHOT;
    });
    return { player: seat.id, cells };
  });
  const current = s.phase === 'playing' ? (s.seats[s.current]?.id ?? null) : null;
  return {
    viewer,
    rules,
    seats: s.seats,
    phase: s.phase,
    turn: s.turn,
    current,
    currentShape: s.phase === 'playing' ? (rules.nuclear && !isAfloat(s, s.current) ? 'bomb' : 'single') : null,
    players,
    boards,
    ownFleet: viewerSeat >= 0 ? (s.fleets[viewerSeat] ?? null) : null,
    revealed: s.phase === 'over' ? s.fleets : null,
    events: s.events,
    result: s.result,
    standing: s.standing ?? null,
  };
}

/**
 * A player's hidden layout. ONLY for the private handout and peek screens and
 * the share/ payload encoder (lint-enforced).
 */
export function fleetOf(s: GameState, p: PlayerId): readonly PlacedShip[] {
  const i = s.seats.findIndex((seat) => seat.id === p);
  return s.fleets[i] ?? [];
}
