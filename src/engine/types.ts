import type { RngState } from './rng.ts';

export type PlayerId = string & { readonly __brand: 'PlayerId' };
export type ShipId = string & { readonly __brand: 'ShipId' };
/** carrier, cruiser, …: what messages and pictograms are keyed on. */
export type ShipKindId = string & { readonly __brand: 'ShipKindId' };

/** Logical, 0-based. Rows get letters, columns get numbers. */
export type Coord = Readonly<{ row: number; col: number }>;
/** Never "horizontal"/"vertical": those swap in vertical writing modes. */
export type Axis = 'alongRow' | 'alongCol';

export interface ShipyardShip {
  readonly id: ShipId;
  readonly kind: ShipKindId;
  /** Fixed, 1-based, the same for every player. "3" is the cruiser at any table. */
  readonly number: number;
  readonly length: number;
}

export interface Rules {
  readonly rows: number;
  readonly cols: number;
  readonly shipyard: readonly ShipyardShip[];
  readonly allowTouching: boolean;
  /** All true in play; false only for simulation comparisons. */
  readonly selfFire: boolean;
  readonly announceShipOnHit: boolean;
  readonly nuclear: boolean;
}

export interface Seat {
  readonly id: PlayerId;
  readonly kind: 'human' | 'bot';
  /** Non-empty, each shipyard ship at most once. Public. */
  readonly fleet: readonly ShipId[];
}

export interface PlacedShip {
  readonly ship: ShipId;
  readonly origin: Coord;
  readonly axis: Axis;
}

export type Phase = 'setup' | 'playing' | 'over';

export type Action =
  /** Setup only: place that fleet again at random with the seeded RNG. */
  | { readonly kind: 'reroll'; readonly player: PlayerId }
  /** Setup only: a layout the player chose themselves (M5, and tests). */
  | { readonly kind: 'place'; readonly player: PlayerId; readonly fleet: readonly PlacedShip[] }
  /** Ends setup; the seeded RNG picks who goes first. */
  | { readonly kind: 'start' }
  /** A single square while afloat, a 2×2 bomb (the square is its first corner) once nuclear. */
  | { readonly kind: 'call'; readonly player: PlayerId; readonly at: Coord };

export type ShotOutcome = 'miss' | 'hit' | 'alreadyShot';

export type GameResult =
  | { readonly kind: 'lastFleet'; readonly player: PlayerId }
  /** One call sank every remaining fleet. */
  | { readonly kind: 'allNuclear'; readonly lastToSink: readonly PlayerId[] };

export type GameEvent =
  | {
      readonly kind: 'shotCalled';
      readonly turn: number;
      readonly by: PlayerId;
      readonly at: Coord;
      readonly shape: 'single' | 'bomb';
      /** The full footprint, including squares that were already called. */
      readonly cells: readonly Coord[];
    }
  | {
      readonly kind: 'shotResolved';
      readonly turn: number;
      readonly board: PlayerId;
      readonly at: Coord;
      readonly outcome: ShotOutcome;
      /** Present on hits whenever `announceShipOnHit`. */
      readonly ship?: ShipId;
    }
  | {
      readonly kind: 'shipSunk';
      readonly turn: number;
      readonly board: PlayerId;
      readonly ship: ShipId;
      /** Whenever `announceShipOnHit`: then a sunk ship's footprint is exactly its hits. */
      readonly cells?: readonly Coord[];
    }
  | { readonly kind: 'wentNuclear'; readonly turn: number; readonly player: PlayerId }
  /** Only with `nuclear: false` (simulation): a sunk player is out of the game. */
  | { readonly kind: 'knockedOut'; readonly turn: number; readonly player: PlayerId }
  | { readonly kind: 'gameOver'; readonly turn: number; readonly result: GameResult };

export type RuleViolation =
  | 'wrongPhase'
  | 'notYourTurn'
  | 'outOfBounds'
  | 'noUnshotTarget'
  | 'bombOffBoard'
  | 'unknownPlayer'
  | 'emptyFleet'
  | 'duplicateShip'
  | 'shipNotInShipyard'
  | 'noLegalLayout'
  | 'badRules'
  | 'tooFewPlayers'
  | 'duplicatePlayer'
  | 'badLayout'
  | 'nothingToUndo';

/** Cell states on a board, in the private state. */
export const CELL_UNSHOT = 0;
export const CELL_MISS = 1;
export const CELL_HIT = 2;
export type CellState = typeof CELL_UNSHOT | typeof CELL_MISS | typeof CELL_HIT;

/** One player's board. Arrays are indexed by `row * cols + col`, or by shipyard index. */
export interface BoardState {
  readonly cells: readonly CellState[];
  /** PRIVATE: the shipyard index of the ship on each cell, or -1 for water. */
  readonly occupant: readonly number[];
  /** Hits per shipyard index (0 for ships not in this fleet). */
  readonly hits: readonly number[];
}

export interface PlayerStatus {
  /** Turn on which their last ship sank, or null while afloat. */
  readonly sunkOnTurn: number | null;
}

/**
 * The whole game, as plain JSON. It contains every fleet, so only the engine,
 * the private screens and share/ may look inside; everything shared goes
 * through viewFor(s, 'spectator').
 */
export interface GameState {
  readonly rules: Rules;
  readonly seats: readonly Seat[];
  readonly seed: number;
  readonly phase: Phase;
  readonly rng: RngState;
  /** PRIVATE, by seat index. */
  readonly fleets: readonly (readonly PlacedShip[])[];
  /** Times each seat's layout was replaced (reroll or place). Feeds the fleet check. */
  readonly layoutVersions: readonly number[];
  /** By seat index. */
  readonly boards: readonly BoardState[];
  readonly status: readonly PlayerStatus[];
  /** Calls made so far; the next call is turn `turn + 1`. */
  readonly turn: number;
  /** Seat index of the player to call, once playing. */
  readonly current: number;
  readonly firstPlayer: number;
  /** Everything that has been applied, for replay, undo and autosave. */
  readonly actions: readonly Action[];
  /** Every event so far. All events are public. */
  readonly events: readonly GameEvent[];
  readonly result: GameResult | null;
}
