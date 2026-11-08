import { nextInt, placementsFor, seedRng, type Axis, type Coord, type Rules } from '../engine/index.ts';
import { digitValue } from '../i18n/parse.ts';
import { CROCKFORD, fnv1a } from './codes.ts';

/**
 * Fleet codes (M5): a player places their ships on their phone, which shows
 * a short code the laptop scans or the player types in.
 *
 * The code packs, in mixed radix, low digits first: a 10-bit game check, the
 * seat, the fleet subset (a bitmask of shipyard ships), and each chosen
 * ship's index into placementsFor(rules, length). The base-32 digits are
 * lightly obfuscated with a keystream keyed by the game code, then written in
 * Crockford Base32 with Crockford's mod-37 check symbol. Because 37 is prime
 * and larger than 32, any single substitution and any adjacent transposition
 * changes the value mod 37, so it is caught.
 */

const CHECK_SYMBOLS = `${CROCKFORD}*~$=U`;
const GAME_CHECK_RADIX = 1024n;
const MAX_SEATS = 8n;

export interface FleetCodeContext {
  readonly gameCode: string;
  readonly rules: Pick<Rules, 'rows' | 'cols' | 'shipyard'>;
}

export interface PlacedByIndex {
  /** Index into rules.shipyard. */
  readonly ship: number;
  readonly origin: Coord;
  readonly axis: Axis;
}

export interface FleetCodeContent {
  readonly seat: number;
  readonly ships: readonly PlacedByIndex[];
}

export type FleetCodeError = 'code.empty' | 'code.badCharacter' | 'code.length' | 'code.checksum' | 'code.otherGame' | 'code.corrupt';

const gameCheck = (gameCode: string): bigint => BigInt(fnv1a([...gameCode].map((c) => c.charCodeAt(0))) % 1024);

function placementLists(ctx: FleetCodeContext) {
  const cache: Record<number, ReturnType<typeof placementsFor>> = {};
  return ctx.rules.shipyard.map((s) => (cache[s.length] ??= placementsFor(ctx.rules, s.length)));
}

/** The number of data characters every code in this game has. */
export function codeLength(ctx: FleetCodeContext): number {
  let capacity = GAME_CHECK_RADIX * MAX_SEATS * (1n << BigInt(ctx.rules.shipyard.length));
  for (const list of placementLists(ctx)) capacity *= BigInt(list.length);
  let chars = 0;
  for (let c = capacity - 1n; c > 0n; c >>= 5n) chars++;
  return Math.max(chars, 1);
}

function keystream(gameCode: string, length: number): number[] {
  let rng = seedRng(fnv1a([...gameCode].map((c) => c.charCodeAt(0)), 0x2545f491));
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    const [k, next] = nextInt(rng, 32);
    out.push(k);
    rng = next;
  }
  return out;
}

function checkSymbol(digits: readonly number[]): string {
  let mod = 0;
  for (const d of digits) mod = (mod * 32 + d) % 37;
  return CHECK_SYMBOLS[mod] ?? '0';
}

/** Encode, returning the bare characters (data then check), e.g. "7K2MQR9AXXXC". */
export function encodeFleetCode(ctx: FleetCodeContext, content: FleetCodeContent): string {
  const lists = placementLists(ctx);
  const sorted = [...content.ships].sort((a, b) => a.ship - b.ship);
  // Build from the innermost (last ship) outwards so decoding can read low digits first.
  let v = 0n;
  for (let k = sorted.length - 1; k >= 0; k--) {
    const s = sorted[k];
    const list = s ? lists[s.ship] : undefined;
    if (!s || !list) throw new Error('encodeFleetCode: bad ship');
    const i = list.findIndex((p) => p.axis === (ctx.rules.shipyard[s.ship]?.length === 1 ? 'alongRow' : s.axis) && p.origin.row === s.origin.row && p.origin.col === s.origin.col);
    if (i < 0) throw new Error('encodeFleetCode: placement not on the board');
    v = v * BigInt(list.length) + BigInt(i);
  }
  const subset = sorted.reduce((m, s) => m | (1n << BigInt(s.ship)), 0n);
  v = v * (1n << BigInt(ctx.rules.shipyard.length)) + subset;
  v = v * MAX_SEATS + BigInt(content.seat);
  v = v * GAME_CHECK_RADIX + gameCheck(ctx.gameCode);

  const n = codeLength(ctx);
  const digits: number[] = [];
  for (let i = 0; i < n; i++) {
    digits.unshift(Number(v & 31n));
    v >>= 5n;
  }
  const keys = keystream(ctx.gameCode, n);
  const shown = digits.map((d, i) => (d + (keys[i] ?? 0)) % 32);
  return shown.map((d) => CROCKFORD[d] ?? '0').join('') + checkSymbol(shown);
}

/** Group for display: 4-4-4-…, then the check symbol on its own ("7K2M-QR9A-XXX-C"). */
export function groupCode(code: string): string {
  const data = code.slice(0, -1);
  const groups = data.match(/.{1,4}/gu) ?? [];
  return [...groups, code.slice(-1)].join('-');
}

/**
 * Read a typed or scanned code: NFKC, any decimal digit, case-insensitive,
 * I/L → 1, O → 0, hyphens and spaces ignored.
 */
export function normalizeCode(input: string): string {
  let out = '';
  for (const ch of input.normalize('NFKC').toLocaleUpperCase('und')) {
    const d = digitValue(ch);
    if (d !== undefined) out += String(d);
    else if (ch === 'I' || ch === 'L') out += '1';
    else if (ch === 'O') out += '0';
    else if (/[\s\-‐-―]/u.test(ch)) continue;
    else out += ch;
  }
  return out;
}

export function decodeFleetCode(ctx: FleetCodeContext, input: string): { ok: true; value: FleetCodeContent } | { ok: false; error: FleetCodeError } {
  const code = normalizeCode(input);
  if (code === '') return { ok: false, error: 'code.empty' };
  const n = codeLength(ctx);
  const chars = [...code];
  if (chars.length !== n + 1) return { ok: false, error: 'code.length' };
  const shown: number[] = [];
  for (const ch of chars.slice(0, -1)) {
    const d = CROCKFORD.indexOf(ch);
    if (d < 0) return { ok: false, error: 'code.badCharacter' };
    shown.push(d);
  }
  const check = chars.at(-1) ?? '';
  if (!CHECK_SYMBOLS.includes(check)) return { ok: false, error: 'code.badCharacter' };
  if (checkSymbol(shown) !== check) return { ok: false, error: 'code.checksum' };

  const keys = keystream(ctx.gameCode, n);
  let v = 0n;
  shown.forEach((d, i) => {
    v = (v << 5n) | BigInt((d - (keys[i] ?? 0) + 32) % 32);
  });
  if (v % GAME_CHECK_RADIX !== gameCheck(ctx.gameCode)) return { ok: false, error: 'code.otherGame' };
  v /= GAME_CHECK_RADIX;
  const seat = Number(v % MAX_SEATS);
  v /= MAX_SEATS;
  const shipyardSize = BigInt(ctx.rules.shipyard.length);
  const subset = v % (1n << shipyardSize);
  v /= 1n << shipyardSize;
  const lists = placementLists(ctx);
  const ships: PlacedByIndex[] = [];
  for (let k = 0; k < ctx.rules.shipyard.length; k++) {
    if (!((subset >> BigInt(k)) & 1n)) continue;
    const list = lists[k];
    if (!list) return { ok: false, error: 'code.corrupt' };
    const p = list[Number(v % BigInt(list.length))];
    v /= BigInt(list.length);
    if (!p) return { ok: false, error: 'code.corrupt' };
    ships.push({ ship: k, origin: p.origin, axis: p.axis });
  }
  if (v !== 0n || ships.length === 0) return { ok: false, error: 'code.corrupt' };
  return { ok: true, value: { seat, ships } };
}
