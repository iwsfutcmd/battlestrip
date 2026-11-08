/**
 * Short human-checkable codes: the game code and the fleet check. Crockford
 * Base32 (no I, L, O, U), so they read unambiguously aloud and on screen.
 * Codes are Latin by design; UIs show them in an LTR isolate.
 */
export const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** FNV-1a, 32-bit. Not cryptographic: it only has to make accidental mismatches obvious. */
export function fnv1a(bytes: Iterable<number>, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (const b of bytes) {
    h ^= b & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function toCrockford(value: number, length: number): string {
  let out = '';
  let v = value >>> 0;
  for (let i = 0; i < length; i++) {
    out = (CROCKFORD[v & 31] ?? '0') + out;
    v >>>= 5;
  }
  return out;
}

export function fromCrockford(code: string): number | undefined {
  let v = 0;
  for (const ch of code) {
    const i = CROCKFORD.indexOf(ch);
    if (i < 0) return undefined;
    v = v * 32 + i;
  }
  return v;
}

function intBytes(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

/** Four characters naming the game, from its seed. Shown on the TV, the handout and every phone. */
export function gameCode(seed: number): string {
  return toCrockford(fnv1a(intBytes(seed)) & 0xfffff, 4);
}

export interface LayoutForCheck {
  readonly ship: string;
  readonly origin: { readonly row: number; readonly col: number };
  readonly axis: 'alongRow' | 'alongCol';
}

/** Three characters that change with every reroll; the phone and the laptop preview must match. */
export function fleetCheck(code: string, seat: number, layoutVersion: number, layout: readonly LayoutForCheck[]): string {
  const bytes: number[] = [...code].map((c) => c.charCodeAt(0) & 0xff);
  bytes.push(seat & 0xff, ...intBytes(layoutVersion));
  for (const p of layout) {
    for (const c of p.ship) bytes.push(c.charCodeAt(0) & 0xff);
    bytes.push(p.origin.row, p.origin.col, p.axis === 'alongRow' ? 0 : 1);
  }
  return toCrockford(fnv1a(bytes) & 0x7fff, 3);
}
