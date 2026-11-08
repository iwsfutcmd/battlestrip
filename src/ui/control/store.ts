import { batch, computed, effect, signal } from '@preact/signals';
import { callSeed, chooseCall, type BotKind } from '../../bots/index.ts';
import {
  autoBoardSize,
  fleetSquares,
  gameStats,
  hitChance,
  legalCalls,
  newGame,
  OUTFIT_IDS,
  outfit,
  wardrobeRules,
  reduce,
  replay,
  undoLastCall,
  viewFor,
  type Action,
  type Coord,
  type GameState,
  type PlayerId,
  type Rules,
  type RuleViolation,
  type Seat,
  type ShipId,
  type AutoSize,
  type BoardSize,
} from '../../engine/index.ts';
import type { WritingMode } from '../../i18n/direction.ts';
import { defaultLabelSystem, numberingSystemOf, systemForRows, type LabelSystemId } from '../../i18n/labels.ts';
import type { MessageKey, MessageValues } from '../../i18n/index.ts';
import { gameCode } from '../../share/codes.ts';
import { decodeFleetCode } from '../../share/fleet-code.ts';
import { encodeInvite, type PlacementInvite } from '../../share/invite.ts';
import { directionOf } from '../../i18n/direction.ts';
import { translator } from '../common/locale-state.ts';
import type { PublicSeat, PublicTable, TableSettings, TableStage } from '../table/types.ts';

export type FleetPolicyKind = 'full' | 'random' | 'fixed';

export interface SeatConfig {
  readonly key: string;
  readonly name: string;
  readonly kind: 'human' | 'bot';
  readonly bot: BotKind;
  readonly policy: FleetPolicyKind;
  /** The chosen ships (humans, and bots with the `fixed` policy). */
  /** The chosen outfit (humans, and bots with the `fixed` policy). */
  readonly fleet: readonly ShipId[];
}

export interface LobbyConfig {
  /** Size the board from the outfits so a first shot hits someone about half the time (rows and cols are then ignored). */
  readonly autoSize: boolean;
  readonly rows: number;
  readonly cols: number;
  readonly allowTouching: boolean;
  readonly labels: LabelSystemId;
  readonly labels2: LabelSystemId | null;
  readonly writingMode: WritingMode;
  readonly seed: string;
  readonly beatSeconds: number;
  readonly botSeconds: number;
  /** Read calls and results aloud (off unless the table turns it on). */
  readonly speech: boolean;
  /** M5: random layouts handed out by QR, or players place their own on their phones. */
  readonly placement: 'random' | 'phones';
  /** Keep playing after one fleet is left, until it sinks too (the table can still end it early). */
  readonly playOut: boolean;
  readonly seats: readonly SeatConfig[];
}

/** Fixed once the fleets are dealt. */
export interface Session {
  readonly rules: Rules;
  readonly seed: number;
  readonly seats: readonly Seat[];
  readonly names: readonly string[];
  readonly bots: readonly BotKind[];
  readonly settings: TableSettings;
  readonly botMs: number;
}

export interface Notice {
  readonly key: MessageKey;
  readonly values?: MessageValues | undefined;
  readonly tone: 'info' | 'error';
}

export const MAX_SEATS = 8;
let seatCounter = 0;
const newKey = (): string => `s${Date.now().toString(36)}${(seatCounter++).toString(36)}`;

export function rulesForLobby(c: LobbyConfig): Rules {
  // Saves from before playOut existed read as "play on" (the lobby default).
  return wardrobeRules({ rows: c.rows, cols: c.cols, allowTouching: c.allowTouching, playOut: c.playOut ?? true });
}

function defaultSeat(kind: 'human' | 'bot'): SeatConfig {
  return { key: newKey(), name: '', kind, bot: 'density', policy: 'full', fleet: outfit('everyday') };
}

export function defaultLobby(locale = 'en'): LobbyConfig {
  return {
    autoSize: true,
    rows: 10,
    cols: 10,
    allowTouching: true,
    labels: defaultLabelSystem(locale),
    labels2: null,
    writingMode: 'horizontal-tb',
    seed: '',
    beatSeconds: 1.5,
    botSeconds: 1.2,
    speech: false,
    placement: 'random',
    playOut: true,
    seats: [defaultSeat('human'), defaultSeat('human'), defaultSeat('human')],
  };
}

export const lobby = signal<LobbyConfig>(defaultLobby());
export const session = signal<Session | null>(null);
export const game = signal<GameState | null>(null);
export const stage = signal<TableStage>('lobby');
export const ready = signal<readonly PlayerId[]>([]);
export const reveal = signal<{ readonly turn: number; readonly revealed: boolean } | null>(null);
export const choosing = signal<PlayerId | null>(null);
export const canUndo = signal(false);
export const notice = signal<Notice | null>(null);
export const focusCell = signal<Coord>({ row: 0, col: 0 });
/** Seats whose layout came from a fleet code (M5). */
export const placedOnPhone = signal<readonly PlayerId[]>([]);

// ---- Lobby edits -------------------------------------------------------------

export function updateLobby(patch: Partial<LobbyConfig>): void {
  const next = { ...lobby.value, ...patch };
  lobby.value = next;
}

export function updateSeat(key: string, patch: Partial<SeatConfig>): void {
  lobby.value = { ...lobby.value, seats: lobby.value.seats.map((s) => (s.key === key ? { ...s, ...patch } : s)) };
}

export function addSeat(kind: 'human' | 'bot'): void {
  if (lobby.value.seats.length >= MAX_SEATS) return;
  lobby.value = { ...lobby.value, seats: [...lobby.value.seats, defaultSeat(kind)] };
}

export function removeSeat(key: string): void {
  if (lobby.value.seats.length <= 2) return;
  lobby.value = { ...lobby.value, seats: lobby.value.seats.filter((s) => s.key !== key) };
}

export function moveSeat(key: string, delta: -1 | 1): void {
  const seats = [...lobby.value.seats];
  const i = seats.findIndex((s) => s.key === key);
  const j = i + delta;
  const a = seats[i];
  const b = seats[j];
  if (!a || !b) return;
  seats[i] = b;
  seats[j] = a;
  lobby.value = { ...lobby.value, seats };
}

// ---- Dealing -------------------------------------------------------------------

function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] ?? 1;
}

function seedFrom(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return randomSeed();
  const n = Number(trimmed);
  if (Number.isInteger(n) && n >= 0) return n >>> 0;
  // Any text works as a seed.
  let h = 0x811c9dc5;
  for (const ch of trimmed) h = Math.imul(h ^ (ch.codePointAt(0) ?? 0), 0x01000193) >>> 0;
  return h;
}

export const violationNotice = (code: RuleViolation): Notice =>
  code === 'noLegalLayout' ? { key: 'lobby.noLayout', tone: 'error' } : { key: 'error.violation', values: { code }, tone: 'error' };

/**
 * A bot's outfit: the everyday outfit (`full`), one of the ready-made
 * outfits picked by the seed (`random`), or the pieces chosen in the lobby.
 */
function botOutfit(s: SeatConfig, seed: number): ShipId[] {
  if (s.policy === 'fixed' && s.fleet.length > 0) return [...s.fleet];
  if (s.policy === 'random') return outfit(OUTFIT_IDS[seed % OUTFIT_IDS.length] ?? 'everyday');
  return outfit('everyday');
}

/** Every seat's outfit, in seat order, for a game with this seed. */
function seatFleets(c: LobbyConfig, seed: number): ShipId[][] {
  return c.seats.map((s, i) => (s.kind === 'bot' ? botOutfit(s, seed + i) : [...s.fleet]));
}

/** Saves from before auto-sizing existed read as "auto" (the lobby default). */
const isAuto = (c: LobbyConfig): boolean => c.autoSize ?? true;

const autoCache = new Map<string, AutoSize>();

/**
 * The auto size for the lobby as it stands. A bot that picks a random outfit
 * is counted in the everyday outfit unless the seed is set, since its outfit
 * isn't known until the deal.
 */
export function lobbyAutoSize(c: LobbyConfig): AutoSize {
  return autoSizeFor(rulesForLobby(c), previewFleets(c));
}

function previewFleets(c: LobbyConfig): ShipId[][] {
  const seeded = c.seed.trim() !== '';
  const dealt = seatFleets(c, seeded ? seedFrom(c.seed) : 0);
  return c.seats.map((s, i) => (s.kind === 'bot' && s.policy === 'random' && !seeded ? outfit('everyday') : (dealt[i] ?? [])));
}

/** The estimated chance a first shot hits someone, on the board the lobby will deal. */
export function lobbyHitChance(c: LobbyConfig): number {
  const rules = rulesForLobby(c);
  const { rows, cols } = lobbyBoard(c);
  return hitChance(previewFleets(c).map((f) => fleetSquares(rules, f)), rows * cols);
}

function autoSizeFor(rules: Rules, fleets: readonly (readonly ShipId[])[]): AutoSize {
  const key = `${String(rules.allowTouching)}|${fleets.map((f) => f.join(',')).join(';')}`;
  let size = autoCache.get(key);
  if (!size) {
    size = autoBoardSize(rules, fleets);
    if (autoCache.size > 64) autoCache.clear();
    autoCache.set(key, size);
  }
  return size;
}

/** The board the lobby will deal: the auto size, or the rows and columns typed in. */
export function lobbyBoard(c: LobbyConfig): BoardSize {
  if (!isAuto(c)) return { rows: c.rows, cols: c.cols };
  const { rows, cols } = lobbyAutoSize(c);
  return { rows, cols };
}

/** Validate the lobby, place every fleet, and go to the handout. Names come from the lobby (default "Player n"). */
export function deal(names: readonly string[], locale: string): boolean {
  const c = lobby.value;
  const seed = seedFrom(c.seed);
  const fleets = seatFleets(c, seed);
  const manual = rulesForLobby(c);
  const size = isAuto(c) ? autoSizeFor(manual, fleets) : manual;
  const rules: Rules = { ...manual, rows: size.rows, cols: size.cols };
  const seats: Seat[] = c.seats.map((s, i) => ({ id: s.key as PlayerId, kind: s.kind, fleet: fleets[i] ?? [] }));
  const created = newGame(rules, seats, seed);
  if (!created.ok) {
    notice.value = violationNotice(created.error);
    return false;
  }
  const labels = systemForRows(c.labels, rules.rows);
  const settings: TableSettings = {
    locale,
    labels,
    labels2: c.labels2 && c.labels2 !== labels ? systemForRows(c.labels2, rules.rows) : null,
    writingMode: c.writingMode,
    beatMs: Math.max(0, c.beatSeconds * 1000),
    speech: c.speech,
  };
  batch(() => {
    session.value = {
      rules,
      seed,
      seats,
      names,
      bots: c.seats.map((s) => s.bot),
      settings,
      botMs: Math.max(0, c.botSeconds * 1000),
    };
    game.value = created.value;
    stage.value = c.placement === 'phones' ? 'placement' : 'handout';
    ready.value = seats.filter((s) => s.kind === 'bot').map((s) => s.id);
    placedOnPhone.value = [];
    reveal.value = null;
    canUndo.value = false;
    notice.value = null;
  });
  return true;
}

/** M5: accept a fleet code from a phone (typed or scanned). Returns the seat it placed, if any. */
export function acceptFleetCode(input: string): PlayerId | null {
  const g = game.value;
  const s = session.value;
  if (!g || !s || g.phase !== 'setup') return null;
  const fleets = s.seats.map((seat) => seat.fleet.map((id) => s.rules.shipyard.findIndex((x) => x.id === id)));
  const r = decodeFleetCode({ gameCode: gameCode(s.seed), rules: s.rules, fleets }, input);
  if (!r.ok) {
    notice.value = { key: 'code.error', values: { code: r.error.replace('code.', '') }, tone: 'error' };
    return null;
  }
  const seat = s.seats[r.value.seat];
  if (!seat || seat.kind !== 'human') {
    notice.value = { key: 'code.error', values: { code: 'corrupt' }, tone: 'error' };
    return null;
  }
  const wanted = seat.fleet.map((id) => s.rules.shipyard.findIndex((x) => x.id === id)).sort((a, b) => a - b);
  const got = r.value.ships.map((x) => x.ship);
  if (wanted.join(',') !== got.join(',')) {
    notice.value = { key: 'code.error', values: { code: 'wrongFleet' }, tone: 'error' };
    return null;
  }
  const fleet = r.value.ships.map((x) => ({ ship: s.rules.shipyard[x.ship]?.id ?? seat.fleet[0] ?? ('' as ShipId), origin: x.origin, orientation: x.orientation }));
  const placed = reduce(g, { kind: 'place', player: seat.id, fleet });
  if (!placed.ok) {
    notice.value = { key: 'code.error', values: { code: 'badLayout' }, tone: 'error' };
    return null;
  }
  batch(() => {
    game.value = placed.value.state;
    if (!placedOnPhone.value.includes(seat.id)) placedOnPhone.value = [...placedOnPhone.value, seat.id];
    confirmReady(seat.id);
    notice.value = { key: 'placement.accepted', values: { name: s.names[r.value.seat] ?? '' }, tone: 'info' };
  });
  return seat.id;
}

/** M5: the placement page URL for the TV's QR code. */
export const inviteUrl = computed<string | null>(() => {
  const s = session.value;
  if (!s || stage.value !== 'placement') return null;
  const invite: PlacementInvite = {
    gameCode: gameCode(s.seed),
    rows: s.rules.rows,
    cols: s.rules.cols,
    allowTouching: s.rules.allowTouching,
    labels: s.settings.labels,
    labels2: s.settings.labels2,
    numbering: numberingSystemOf(s.settings.locale),
    dir: directionOf(s.settings.locale),
    writingMode: s.settings.writingMode,
    seats: s.seats.map((seat, i) => ({
      name: s.names[i] ?? '',
      human: seat.kind === 'human',
      fleet: seat.fleet.map((id) => s.rules.shipyard.findIndex((x) => x.id === id)).filter((k) => k >= 0),
    })),
  };
  return new URL(`place/#${encodeInvite(invite)}`, location.href).toString();
});

function apply(a: Action): boolean {
  const g = game.value;
  if (!g) return false;
  const r = reduce(g, a);
  if (!r.ok) {
    notice.value = violationNotice(r.error);
    return false;
  }
  game.value = r.value.state;
  return true;
}

export function reroll(p: PlayerId): void {
  apply({ kind: 'reroll', player: p });
}

export function confirmReady(p: PlayerId): void {
  if (!ready.value.includes(p)) ready.value = [...ready.value, p];
}

export function beginPlay(): void {
  if (apply({ kind: 'start' })) {
    stage.value = 'playing';
    const g = game.value;
    if (g) focusCell.value = { row: Math.floor(g.rules.rows / 2), col: Math.floor(g.rules.cols / 2) };
  }
}

// ---- Calls, the beat, and undo -----------------------------------------------------

let beatTimer: ReturnType<typeof setTimeout> | undefined;

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function revealing(): boolean {
  return reveal.value !== null && !reveal.value.revealed;
}

export function submitCall(at: Coord): boolean {
  const g = game.value;
  if (!g || g.phase !== 'playing' || revealing()) return false;
  const player = g.seats[g.current]?.id;
  if (!player || !apply({ kind: 'call', player, at })) return false;
  const after = game.value;
  if (!after) return false;
  notice.value = null;
  canUndo.value = true;
  reveal.value = { turn: after.turn, revealed: false };
  clearTimeout(beatTimer);
  const ms = reducedMotion() ? 0 : (session.value?.settings.beatMs ?? 0);
  const finish = (): void => {
    reveal.value = { turn: after.turn, revealed: true };
    if (after.phase === 'over') {
      stage.value = 'over';
      canUndo.value = false;
    }
  };
  if (ms === 0) finish();
  else beatTimer = setTimeout(finish, ms);
  return true;
}

/** With play-out: stop now, and the last fleet standing wins as if the game had ended there. */
export function endHere(): void {
  const g = game.value;
  if (!g?.standing || g.phase !== 'playing' || revealing()) return;
  if (apply({ kind: 'endGame' })) {
    batch(() => {
      stage.value = 'over';
      canUndo.value = false;
      notice.value = null;
    });
  }
}

export function undo(): void {
  const g = game.value;
  if (!g || !canUndo.value || g.phase !== 'playing' || revealing()) return;
  const r = undoLastCall(g);
  if (!r.ok) return;
  batch(() => {
    game.value = r.value;
    canUndo.value = false;
    reveal.value = r.value.turn > 0 ? { turn: r.value.turn, revealed: true } : null;
    notice.value = { key: 'play.undone', tone: 'info' };
  });
}

export function replaySameSeed(): void {
  const s = session.value;
  if (!s) return;
  const created = newGame(s.rules, s.seats, s.seed);
  if (!created.ok) return;
  batch(() => {
    game.value = created.value;
    stage.value = 'handout';
    ready.value = s.seats.filter((x) => x.kind === 'bot').map((x) => x.id);
    reveal.value = null;
    canUndo.value = false;
  });
}

export function backToLobby(): void {
  clearTimeout(beatTimer);
  batch(() => {
    session.value = null;
    game.value = null;
    stage.value = 'lobby';
    ready.value = [];
    reveal.value = null;
    canUndo.value = false;
    notice.value = null;
  });
  clearSave();
}

// ---- Bots -----------------------------------------------------------------------------

let botTimer: ReturnType<typeof setTimeout> | undefined;

/** Bots call after a short "choosing…" delay, shown and spoken like anyone else's call. */
export function startBotDriver(): () => void {
  return effect(() => {
    const g = game.value;
    const s = session.value;
    const r = reveal.value;
    clearTimeout(botTimer);
    if (!g || !s || stage.value !== 'playing' || g.phase !== 'playing' || (r && !r.revealed)) {
      choosing.value = null;
      return;
    }
    const seat = g.seats[g.current];
    if (seat?.kind !== 'bot') {
      choosing.value = null;
      return;
    }
    choosing.value = seat.id;
    const kind = s.bots[g.current] ?? 'density';
    botTimer = setTimeout(() => {
      const legal = legalCalls(g, seat.id);
      const at = chooseCall(kind, viewFor(g, seat.id), legal, callSeed(s.seed, g.turn, g.current));
      choosing.value = null;
      submitCall(at);
    }, s.botMs);
  });
}

// ---- The public projection ---------------------------------------------------------------

export const publicTable = computed<PublicTable | null>(() => {
  const t = translator.value;
  if (!t) return null;
  const s = session.value;
  const g = game.value;
  const c = lobby.value;
  const seats: PublicSeat[] = s
    ? s.seats.map((seat, i) => ({ id: seat.id, name: s.names[i] ?? '', identity: i, kind: seat.kind }))
    : c.seats.map((seat, i) => ({ id: seat.key as PlayerId, name: seat.name, identity: i, kind: seat.kind }));
  const settings: TableSettings = s?.settings ?? {
    locale: t.locale,
    labels: systemForRows(c.labels, lobbyBoard(c).rows),
    labels2: c.labels2,
    writingMode: c.writingMode,
    beatMs: c.beatSeconds * 1000,
    speech: c.speech,
  };
  return {
    stage: stage.value,
    settings,
    seats,
    gameCode: s ? gameCode(s.seed) : '',
    view: g && stage.value !== 'handout' && stage.value !== 'placement' ? viewFor(g, 'spectator') : null,
    ready: ready.value,
    reveal: reveal.value,
    choosing: choosing.value,
    stats: g?.phase === 'over' ? gameStats(g) : null,
    invite: inviteUrl.value,
  };
});

// ---- Autosave ------------------------------------------------------------------------------

const SAVE_KEY = 'battlestrip.save.v1';

interface SaveFile {
  readonly v: 1;
  readonly lobby: LobbyConfig;
  readonly session: Session;
  readonly actions: readonly Action[];
  readonly ready: readonly PlayerId[];
  readonly placedOnPhone?: readonly PlayerId[];
}

export function startAutosave(): () => void {
  return effect(() => {
    const s = session.value;
    const g = game.value;
    if (!s || !g) return;
    const file: SaveFile = { v: 1, lobby: lobby.value, session: s, actions: g.actions, ready: ready.value, placedOnPhone: placedOnPhone.value };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(file));
    } catch {
      // Private mode or full storage: autosave is a convenience.
    }
  });
}

export function readSave(): SaveFile | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const file = JSON.parse(raw) as SaveFile;
    return file.v === 1 && Array.isArray(file.actions) ? file : null;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

export function resume(file: SaveFile): boolean {
  const r = replay(file.session.rules, file.session.seats, file.session.seed, file.actions);
  if (!r.ok) return false;
  const g = r.value;
  batch(() => {
    lobby.value = file.lobby;
    session.value = file.session;
    game.value = g;
    ready.value = file.ready;
    placedOnPhone.value = file.placedOnPhone ?? [];
    stage.value = g.phase === 'over' ? 'over' : g.phase === 'playing' ? 'playing' : file.lobby.placement === 'phones' ? 'placement' : 'handout';
    reveal.value = g.turn > 0 ? { turn: g.turn, revealed: true } : null;
    canUndo.value = false;
  });
  return true;
}
