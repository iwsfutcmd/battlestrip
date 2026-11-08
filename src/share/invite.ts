import type { Direction, WritingMode } from '../i18n/direction.ts';
import type { LabelSystemId } from '../i18n/labels.ts';
import { fromCrockford, toCrockford } from './codes.ts';
import { LABEL_SYSTEM_IDS, base64url, fitName, fromBase64url } from './payload.ts';

/**
 * The placement invite (M5): the TV shows one QR code that opens the phone
 * placement page. Everything in it is public: game parameters, seat names
 * and the fleets chosen in the lobby.
 */
export interface InviteSeat {
  readonly name: string;
  readonly human: boolean;
  /** Wardrobe indices. */
  readonly fleet: readonly number[];
}

export interface PlacementInvite {
  readonly gameCode: string;
  readonly rows: number;
  readonly cols: number;
  readonly allowTouching: boolean;
  readonly labels: LabelSystemId;
  readonly labels2: LabelSystemId | null;
  readonly numbering: string;
  readonly dir: Direction;
  readonly writingMode: WritingMode;
  readonly seats: readonly InviteSeat[];
}

/** 2: dresses from the whole wardrobe; outfits as lists of wardrobe indices. 3: wardrobe renumbered (socks). */
const VERSION = 3;
const NAME_BYTES = 48;
const MODES: readonly WritingMode[] = ['horizontal-tb', 'vertical-rl', 'vertical-lr'];

export function encodeInvite(inv: PlacementInvite): string {
  const enc = new TextEncoder();
  const code = fromCrockford(inv.gameCode) ?? 0;
  const b: number[] = [VERSION, (code >>> 16) & 0xff, (code >>> 8) & 0xff, code & 0xff];
  b.push(inv.rows, inv.cols);
  b.push((inv.allowTouching ? 1 : 0) | (inv.dir === 'rtl' ? 2 : 0) | (MODES.indexOf(inv.writingMode) << 2));
  b.push(LABEL_SYSTEM_IDS.indexOf(inv.labels), inv.labels2 === null ? 255 : LABEL_SYSTEM_IDS.indexOf(inv.labels2));
  const nu = [...inv.numbering].map((c) => c.charCodeAt(0) & 0x7f);
  b.push(nu.length, ...nu, inv.seats.length);
  for (const s of inv.seats) {
    const name = enc.encode(fitName(s.name, NAME_BYTES));
    b.push(s.human ? 1 : 0, s.fleet.length, ...s.fleet, name.byteLength, ...name);
  }
  return base64url(Uint8Array.from(b));
}

export function decodeInvite(text: string): PlacementInvite | null {
  const bytes = fromBase64url(text.trim());
  if (!bytes || bytes[0] !== VERSION) return null;
  let i = 1;
  const next = (): number => {
    const v = bytes[i++];
    if (v === undefined) throw new RangeError('truncated');
    return v;
  };
  try {
    const code = (next() << 16) | (next() << 8) | next();
    const rows = next();
    const cols = next();
    const flags = next();
    const labels = LABEL_SYSTEM_IDS[next()];
    const l2 = next();
    const labels2 = l2 === 255 ? null : LABEL_SYSTEM_IDS[l2];
    let numbering = '';
    for (let n = next(); n > 0; n--) numbering += String.fromCharCode(next());
    const seats: InviteSeat[] = [];
    for (let n = next(); n > 0; n--) {
      const human = next() === 1;
      const fleet: number[] = [];
      for (let f = next(); f > 0; f--) fleet.push(next());
      const len = next();
      const name = new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(i, i + len));
      i += len;
      seats.push({ name, human, fleet });
    }
    const writingMode = MODES[flags >> 2];
    if (!labels || labels2 === undefined || !writingMode || !/^[a-z]+$/u.test(numbering)) return null;
    return {
      gameCode: toCrockford(code, 4),
      rows,
      cols,
      allowTouching: (flags & 1) === 1,
      labels,
      labels2,
      numbering,
      dir: flags & 2 ? 'rtl' : 'ltr',
      writingMode,
      seats,
    };
  } catch {
    return null;
  }
}
