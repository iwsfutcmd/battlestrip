import type { LabelSystemId } from '../i18n/labels.ts';
import type { Direction, WritingMode } from '../i18n/direction.ts';
import { CROCKFORD, fromCrockford, toCrockford } from './codes.ts';

/**
 * The fleet image a phone draws, packed into the QR URL's fragment
 * (`…/fleet/#<payload>`). Browsers never send fragments to servers, so the
 * static host never sees a fleet. Pure: no DOM.
 */
export interface FleetImageShip {
  readonly number: number;
  readonly kind: string;
  /** Which copy of a repeated kind ("cruiser 2"), or null when the kind is unique. */
  readonly copy: number | null;
  readonly length: number;
  readonly origin: { readonly row: number; readonly col: number };
  readonly axis: 'alongRow' | 'alongCol';
}

export interface FleetImage {
  readonly gameCode: string;
  readonly fleetCheck: string;
  readonly rows: number;
  readonly cols: number;
  readonly labels: LabelSystemId;
  readonly labels2: LabelSystemId | null;
  /** Intl numbering system for column numbers ("latn", "arab", "hanidec", …), so they match the TV. */
  readonly numbering: string;
  readonly dir: Direction;
  readonly writingMode: WritingMode;
  /** NFC. Long names are cut at a grapheme boundary to keep the QR small (see MAX_NAME_BYTES). */
  readonly name: string;
  /** Seat index 0–7: picks the glyph and colour. */
  readonly identity: number;
  readonly ships: readonly FleetImageShip[];
}

/** 2: clothing kinds replaced ship kinds. */
export const PAYLOAD_VERSION = 2;
/** Keeps the worst-case URL under ~400 characters (24 emoji ZWJ sequences would be ~600 bytes). */
export const MAX_NAME_BYTES = 160;

/** Order matters: indices are on the wire. Append only. */
export const LABEL_SYSTEM_IDS: readonly LabelSystemId[] = [
  'latin', 'arabicAbjad', 'arabicAlphabetical', 'persian', 'persianAbjad', 'hebrew', 'greek', 'morskoyBoy',
  'respublika', 'heavenlyStems', 'earthlyBranches', 'hangul', 'iroha', 'numeric',
];
export const SHIP_KINDS: readonly string[] = ['pants', 'shirt', 'underwear', 'socks', 'shoes', 'coat', 'sweater', 'scarf', 'sock', 'glove', 'hat'];
const WRITING_MODES: readonly WritingMode[] = ['horizontal-tb', 'vertical-rl', 'vertical-lr'];

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function base64url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = Math.min(4, Math.ceil(((bytes.length - i) * 8) / 6));
    for (let k = 0; k < chars; k++) out += B64[(n >>> (18 - 6 * k)) & 63];
  }
  return out;
}

export function fromBase64url(text: string): Uint8Array | undefined {
  const values: number[] = [];
  for (const ch of text) {
    const v = B64.indexOf(ch);
    if (v < 0) return undefined;
    values.push(v);
  }
  if (values.length % 4 === 1) return undefined;
  const out: number[] = [];
  for (let i = 0; i < values.length; i += 4) {
    const chunk = values.slice(i, i + 4);
    const n = chunk.reduce((acc, v, k) => acc | (v << (18 - 6 * k)), 0);
    const bytes = Math.floor((chunk.length * 6) / 8);
    for (let k = 0; k < bytes; k++) out.push((n >>> (16 - 8 * k)) & 0xff);
  }
  return Uint8Array.from(out);
}

/** Cut `name` to at most `maxBytes` of UTF-8 at a grapheme boundary, marking the cut with an ellipsis. */
export function fitName(name: string, maxBytes = MAX_NAME_BYTES): string {
  const nfc = name.normalize('NFC');
  const enc = new TextEncoder();
  if (enc.encode(nfc).byteLength <= maxBytes) return nfc;
  const ellipsis = '…';
  const budget = maxBytes - enc.encode(ellipsis).byteLength;
  let out = '';
  for (const { segment } of new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(nfc)) {
    if (enc.encode(out + segment).byteLength > budget) break;
    out += segment;
  }
  return out + ellipsis;
}

export type DecodeError = 'payload.corrupt' | 'payload.version';

export function encodeFleetImage(image: FleetImage): string {
  const enc = new TextEncoder();
  const bytes: number[] = [PAYLOAD_VERSION];
  const code = fromCrockford(image.gameCode) ?? 0;
  bytes.push((code >>> 16) & 0xff, (code >>> 8) & 0xff, code & 0xff);
  const check = fromCrockford(image.fleetCheck) ?? 0;
  bytes.push((check >>> 8) & 0xff, check & 0xff);
  bytes.push(image.rows, image.cols);
  bytes.push(LABEL_SYSTEM_IDS.indexOf(image.labels), image.labels2 === null ? 255 : LABEL_SYSTEM_IDS.indexOf(image.labels2));
  bytes.push((image.dir === 'rtl' ? 1 : 0) | (WRITING_MODES.indexOf(image.writingMode) << 1));
  bytes.push(image.identity & 0xff);
  const nu = [...image.numbering].map((c) => c.charCodeAt(0) & 0x7f);
  bytes.push(nu.length, ...nu);
  const name = enc.encode(fitName(image.name));
  bytes.push(name.byteLength, ...name);
  bytes.push(image.ships.length);
  for (const s of image.ships) {
    const kind = SHIP_KINDS.indexOf(s.kind);
    bytes.push(s.number, ((kind < 0 ? 15 : kind) << 4) | ((s.copy ?? 0) & 15), s.length, s.origin.row, s.origin.col | (s.axis === 'alongCol' ? 128 : 0));
  }
  return base64url(Uint8Array.from(bytes));
}

export function decodeFleetImage(payload: string): { ok: true; value: FleetImage } | { ok: false; error: DecodeError } {
  const bytes = fromBase64url(payload.trim());
  if (!bytes || bytes.length < 14) return { ok: false, error: 'payload.corrupt' };
  if (bytes[0] !== PAYLOAD_VERSION) return { ok: false, error: 'payload.version' };
  let i = 1;
  const next = (): number => {
    const b = bytes[i++];
    if (b === undefined) throw new RangeError('truncated');
    return b;
  };
  try {
    const code = (next() << 16) | (next() << 8) | next();
    const check = (next() << 8) | next();
    const rows = next();
    const cols = next();
    const labels = LABEL_SYSTEM_IDS[next()];
    const l2 = next();
    const labels2 = l2 === 255 ? null : LABEL_SYSTEM_IDS[l2];
    const flags = next();
    const writingMode = WRITING_MODES[flags >> 1];
    const identity = next();
    const nuLen = next();
    let numbering = '';
    for (let k = 0; k < nuLen; k++) numbering += String.fromCharCode(next());
    const nameLen = next();
    if (i + nameLen > bytes.length) return { ok: false, error: 'payload.corrupt' };
    const name = new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(i, i + nameLen));
    i += nameLen;
    const count = next();
    const ships: FleetImageShip[] = [];
    for (let k = 0; k < count; k++) {
      const number = next();
      const kc = next();
      const length = next();
      const row = next();
      const colAxis = next();
      const kind = SHIP_KINDS[kc >> 4];
      if (!kind) return { ok: false, error: 'payload.corrupt' };
      ships.push({ number, kind, copy: kc & 15 ? kc & 15 : null, length, origin: { row, col: colAxis & 127 }, axis: colAxis & 128 ? 'alongCol' : 'alongRow' });
    }
    if (!labels || labels2 === undefined || !writingMode || rows < 1 || cols < 1 || !/^[a-z]+$/u.test(numbering)) {
      return { ok: false, error: 'payload.corrupt' };
    }
    return {
      ok: true,
      value: {
        gameCode: toCrockford(code, 4),
        fleetCheck: toCrockford(check, 3),
        rows,
        cols,
        labels,
        labels2,
        numbering,
        dir: flags & 1 ? 'rtl' : 'ltr',
        writingMode,
        name,
        identity,
        ships,
      },
    };
  } catch {
    return { ok: false, error: 'payload.corrupt' };
  }
}

export { CROCKFORD };
