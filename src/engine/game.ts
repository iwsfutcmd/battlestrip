import { bombCells, coordOf, inBounds, indexOf, occupancy, shipCells } from './board.ts';
import { MAX_SIDE, MIN_SIDE } from './presets.ts';
import { randomLayout } from './placement.ts';
import { err, ok, type Result } from './result.ts';
import { nextInt, seedRng, type RngState } from './rng.ts';
import {
  CELL_HIT,
  CELL_MISS,
  CELL_UNSHOT,
  type Action,
  type BoardState,
  type CellState,
  type Coord,
  type GameEvent,
  type GameResult,
  type GameState,
  type PlacedShip,
  type PlayerId,
  type PlayerStatus,
  type Rules,
  type RuleViolation,
  type Seat,
  type ShipId,
} from './types.ts';

// ---- Helpers ---------------------------------------------------------------

export function seatIndex(s: Pick<GameState, 'seats'>, p: PlayerId): number {
  return s.seats.findIndex((seat) => seat.id === p);
}

/** Afloat: at least one unsunk ship. */
export function isAfloat(s: Pick<GameState, 'status'>, seat: number): boolean {
  return s.status[seat]?.sunkOnTurn === null;
}

/** May this seat still call? Nuclear players do; knocked-out players (nuclear off) don't. */
export function isInPlay(s: Pick<GameState, 'status' | 'rules'>, seat: number): boolean {
  return s.rules.nuclear || isAfloat(s, seat);
}

/** Boards a call by `caller` would resolve on: every afloat board, minus the caller's own without selfFire. */
export function targetSeats(s: Pick<GameState, 'status' | 'rules' | 'seats'>, caller: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.seats.length; i++) {
    if (!isAfloat(s, i)) continue;
    if (i === caller && !s.rules.selfFire) continue;
    out.push(i);
  }
  return out;
}

export function callShape(s: GameState, caller: number): 'single' | 'bomb' {
  return s.rules.nuclear && !isAfloat(s, caller) ? 'bomb' : 'single';
}

/** The squares a call covers, including any that were already called. */
export function callCells(shape: 'single' | 'bomb', at: Coord): Coord[] {
  return shape === 'bomb' ? bombCells(at) : [at];
}

function liveOn(s: GameState, targets: readonly number[], i: number): boolean {
  return targets.some((t) => s.boards[t]?.cells[i] === CELL_UNSHOT);
}

function hasDuplicates(values: readonly string[]): boolean {
  return values.some((v, i) => values.indexOf(v) !== i);
}

function validateRules(rules: Rules): boolean {
  const sideOk = (n: number): boolean => Number.isInteger(n) && n >= MIN_SIDE && n <= MAX_SIDE;
  if (!sideOk(rules.rows) || !sideOk(rules.cols)) return false;
  const ids = rules.shipyard.map((s) => s.id);
  if (hasDuplicates(ids) || rules.shipyard.length === 0) return false;
  return rules.shipyard.every((s) => Number.isInteger(s.length) && s.length >= 1 && s.length <= Math.max(rules.rows, rules.cols));
}

function validateSeats(rules: Rules, seats: readonly Seat[]): RuleViolation | null {
  if (seats.length < 2) return 'tooFewPlayers';
  if (hasDuplicates(seats.map((s) => s.id))) return 'duplicatePlayer';
  for (const seat of seats) {
    if (seat.fleet.length === 0) return 'emptyFleet';
    if (hasDuplicates(seat.fleet)) return 'duplicateShip';
    if (!seat.fleet.every((id) => rules.shipyard.some((s) => s.id === id))) return 'shipNotInShipyard';
  }
  return null;
}

function emptyBoard(rules: Rules, occupant: readonly number[]): BoardState {
  return {
    cells: new Array<CellState>(rules.rows * rules.cols).fill(CELL_UNSHOT),
    occupant,
    hits: new Array<number>(rules.shipyard.length).fill(0),
  };
}

function layoutFor(rules: Rules, fleet: readonly ShipId[], rng: RngState): Result<[PlacedShip[], number[], RngState], RuleViolation> {
  const [layout, next] = randomLayout(rules, fleet, rng);
  if (!layout) return err('noLegalLayout');
  const occ = occupancy(rules, layout);
  if (!occ) throw new Error('randomLayout produced an illegal layout');
  return ok([layout, occ, next]);
}

// ---- New game --------------------------------------------------------------

/** Validate the setup and place every fleet at random. The game starts in `setup`. */
export function newGame(rules: Rules, seats: readonly Seat[], seed: number): Result<GameState, RuleViolation> {
  if (!validateRules(rules)) return err('badRules');
  const seatProblem = validateSeats(rules, seats);
  if (seatProblem) return err(seatProblem);
  let rng = seedRng(seed);
  const fleets: PlacedShip[][] = [];
  const boards: BoardState[] = [];
  for (const seat of seats) {
    const placed = layoutFor(rules, seat.fleet, rng);
    if (!placed.ok) return placed;
    const [layout, occ, next] = placed.value;
    rng = next;
    fleets.push(layout);
    boards.push(emptyBoard(rules, occ));
  }
  return ok({
    rules,
    seats,
    seed,
    phase: 'setup',
    rng,
    fleets,
    layoutVersions: seats.map(() => 0),
    boards,
    status: seats.map((): PlayerStatus => ({ sunkOnTurn: null })),
    turn: 0,
    current: 0,
    firstPlayer: 0,
    actions: [],
    events: [],
    result: null,
  });
}

// ---- Legal calls -----------------------------------------------------------

function checkCall(s: GameState, a: Extract<Action, { kind: 'call' }>): Result<{ caller: number; shape: 'single' | 'bomb'; cells: Coord[] }, RuleViolation> {
  if (s.phase !== 'playing') return err('wrongPhase');
  const caller = seatIndex(s, a.player);
  if (caller < 0) return err('unknownPlayer');
  if (caller !== s.current) return err('notYourTurn');
  if (!inBounds(s.rules, a.at)) return err('outOfBounds');
  const shape = callShape(s, caller);
  const cells = callCells(shape, a.at);
  if (!cells.every((c) => inBounds(s.rules, c))) return err('bombOffBoard');
  const targets = targetSeats(s, caller);
  if (!cells.some((c) => liveOn(s, targets, indexOf(s.rules, c)))) return err('noUnshotTarget');
  return ok({ caller, shape, cells });
}

/** Every call `p` may make now (the first corner, for bombs). Empty when it isn't their turn. */
export function legalCalls(s: GameState, p: PlayerId): readonly Coord[] {
  if (s.phase !== 'playing') return [];
  const caller = seatIndex(s, p);
  if (caller !== s.current) return [];
  const shape = callShape(s, caller);
  const targets = targetSeats(s, caller);
  const { rows, cols } = s.rules;
  const live = new Array<boolean>(rows * cols);
  for (let i = 0; i < rows * cols; i++) live[i] = liveOn(s, targets, i);
  const out: Coord[] = [];
  if (shape === 'single') {
    for (let i = 0; i < rows * cols; i++) if (live[i]) out.push(coordOf(s.rules, i));
  } else {
    for (let row = 0; row < rows - 1; row++) {
      for (let col = 0; col < cols - 1; col++) {
        const i = row * cols + col;
        if (live[i] || live[i + 1] || live[i + cols] || live[i + cols + 1]) out.push({ row, col });
      }
    }
  }
  return out;
}

// ---- Resolution ------------------------------------------------------------

interface Resolution {
  readonly boards: BoardState[];
  readonly events: GameEvent[];
}

/**
 * Resolve `cells` on every target board. Squares already shot on every target
 * board are skipped; a live square resolves on every target board (miss, hit,
 * or alreadyShot where that board was shot before). Exported for the
 * order-independence property test.
 */
export function resolveCells(s: GameState, caller: number, cells: readonly Coord[], turn: number): Resolution {
  const { rules } = s;
  const targets = targetSeats(s, caller);
  const boards = s.boards.slice();
  const events: GameEvent[] = [];
  const live = cells.filter((c) => liveOn(s, targets, indexOf(rules, c)));
  for (const t of targets) {
    const board = boards[t];
    if (!board) continue;
    const seat = s.seats[t];
    if (!seat) continue;
    const newCells = board.cells.slice();
    const hits = board.hits.slice();
    const sunkBefore = hits.map((h, k) => h > 0 && h === rules.shipyard[k]?.length);
    for (const c of live) {
      const i = indexOf(rules, c);
      if (newCells[i] !== CELL_UNSHOT) {
        events.push({ kind: 'shotResolved', turn, board: seat.id, at: c, outcome: 'alreadyShot' });
        continue;
      }
      const occ = board.occupant[i] ?? -1;
      if (occ < 0) {
        newCells[i] = CELL_MISS;
        events.push({ kind: 'shotResolved', turn, board: seat.id, at: c, outcome: 'miss' });
      } else {
        newCells[i] = CELL_HIT;
        hits[occ] = (hits[occ] ?? 0) + 1;
        const ship = rules.shipyard[occ]?.id;
        events.push(
          rules.announceShipOnHit && ship !== undefined
            ? { kind: 'shotResolved', turn, board: seat.id, at: c, outcome: 'hit', ship }
            : { kind: 'shotResolved', turn, board: seat.id, at: c, outcome: 'hit' },
        );
      }
    }
    // Sinkings, in shipyard order, after the whole call has resolved on this board.
    hits.forEach((h, k) => {
      const ship = rules.shipyard[k];
      if (!ship || sunkBefore[k] || h !== ship.length) return;
      const placed = s.fleets[t]?.find((p) => p.ship === ship.id);
      events.push(
        rules.announceShipOnHit && placed
          ? { kind: 'shipSunk', turn, board: seat.id, ship: ship.id, cells: shipCells(placed.origin, placed.axis, ship.length) }
          : { kind: 'shipSunk', turn, board: seat.id, ship: ship.id },
      );
    });
    boards[t] = { cells: newCells, occupant: board.occupant, hits };
  }
  return { boards, events };
}

function fleetSunk(s: GameState, boards: readonly BoardState[], seat: number): boolean {
  const board = boards[seat];
  const fleet = s.seats[seat]?.fleet ?? [];
  return fleet.every((id) => {
    const k = s.rules.shipyard.findIndex((ship) => ship.id === id);
    return (board?.hits[k] ?? 0) >= (s.rules.shipyard[k]?.length ?? Infinity);
  });
}

function applyCall(s: GameState, a: Extract<Action, { kind: 'call' }>): Result<{ state: GameState; events: readonly GameEvent[] }, RuleViolation> {
  const checked = checkCall(s, a);
  if (!checked.ok) return checked;
  const { caller, shape, cells } = checked.value;
  const turn = s.turn + 1;
  const events: GameEvent[] = [{ kind: 'shotCalled', turn, by: a.player, at: a.at, shape, cells }];
  const resolution = resolveCells(s, caller, cells, turn);
  events.push(...resolution.events);

  const status = s.status.slice();
  const newlySunk: PlayerId[] = [];
  for (let i = 0; i < s.seats.length; i++) {
    const seat = s.seats[i];
    if (!seat || !isAfloat(s, i) || !fleetSunk(s, resolution.boards, i)) continue;
    status[i] = { sunkOnTurn: turn };
    newlySunk.push(seat.id);
    events.push(s.rules.nuclear ? { kind: 'wentNuclear', turn, player: seat.id } : { kind: 'knockedOut', turn, player: seat.id });
  }

  const afloat = status.flatMap((st, i) => (st.sunkOnTurn === null ? [i] : []));
  let phase: GameState['phase'] = 'playing';
  let result: GameResult | null = null;
  if (afloat.length <= 1) {
    phase = 'over';
    const winner = afloat[0] !== undefined ? s.seats[afloat[0]] : undefined;
    result = winner ? { kind: 'lastFleet', player: winner.id } : { kind: 'allNuclear', lastToSink: newlySunk };
    events.push({ kind: 'gameOver', turn, result });
  }

  let current = s.current;
  if (phase === 'playing') {
    const probe = { ...s, status };
    do current = (current + 1) % s.seats.length;
    while (!isInPlay(probe, current));
  }

  return ok({
    state: {
      ...s,
      phase,
      boards: resolution.boards,
      status,
      turn,
      current,
      result,
      actions: [...s.actions, a],
      events: [...s.events, ...events],
    },
    events,
  });
}

// ---- Reduce ----------------------------------------------------------------

export function reduce(s: GameState, a: Action): Result<{ state: GameState; events: readonly GameEvent[] }, RuleViolation> {
  switch (a.kind) {
    case 'reroll': {
      if (s.phase !== 'setup') return err('wrongPhase');
      const seat = seatIndex(s, a.player);
      const fleet = s.seats[seat]?.fleet;
      if (!fleet) return err('unknownPlayer');
      const placed = layoutFor(s.rules, fleet, s.rng);
      if (!placed.ok) return placed;
      const [layout, occ, rng] = placed.value;
      return ok({ state: withLayout(s, seat, layout, occ, rng, a), events: [] });
    }
    case 'place': {
      if (s.phase !== 'setup') return err('wrongPhase');
      const seat = seatIndex(s, a.player);
      const fleet = s.seats[seat]?.fleet;
      if (!fleet) return err('unknownPlayer');
      const ships = a.fleet.map((p) => p.ship);
      if (ships.length !== fleet.length || !fleet.every((id) => ships.includes(id))) return err('badLayout');
      const occ = occupancy(s.rules, a.fleet);
      if (!occ) return err('badLayout');
      return ok({ state: withLayout(s, seat, a.fleet, occ, s.rng, a), events: [] });
    }
    case 'start': {
      if (s.phase !== 'setup') return err('wrongPhase');
      const [first, rng] = nextInt(s.rng, s.seats.length);
      return ok({ state: { ...s, phase: 'playing', rng, current: first, firstPlayer: first, actions: [...s.actions, a] }, events: [] });
    }
    case 'call':
      return applyCall(s, a);
  }
}

function withLayout(s: GameState, seat: number, layout: readonly PlacedShip[], occ: number[], rng: RngState, a: Action): GameState {
  const fleets = s.fleets.slice();
  fleets[seat] = layout;
  const boards = s.boards.slice();
  boards[seat] = emptyBoard(s.rules, occ);
  const layoutVersions = s.layoutVersions.slice();
  layoutVersions[seat] = (layoutVersions[seat] ?? 0) + 1;
  return { ...s, fleets, boards, layoutVersions, rng, actions: [...s.actions, a] };
}

// ---- Replay and undo ---------------------------------------------------------

export function replay(
  rules: Rules,
  seats: readonly Seat[],
  seed: number,
  actions: readonly Action[],
): Result<GameState, { index: number; violation: RuleViolation }> {
  const start = newGame(rules, seats, seed);
  if (!start.ok) return err({ index: -1, violation: start.error });
  let s = start.value;
  for (let index = 0; index < actions.length; index++) {
    const a = actions[index];
    if (!a) break;
    const r = reduce(s, a);
    if (!r.ok) return err({ index, violation: r.error });
    s = r.value.state;
  }
  return ok(s);
}

/** Take back the most recent call (for typos) by replaying the log without it. */
export function undoLastCall(s: GameState): Result<GameState, RuleViolation> {
  const last = s.actions.at(-1);
  if (last?.kind !== 'call') return err('nothingToUndo');
  const r = replay(s.rules, s.seats, s.seed, s.actions.slice(0, -1));
  if (!r.ok) throw new Error('undo: replay of a valid log failed');
  return ok(r.value);
}
