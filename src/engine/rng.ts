/**
 * sfc32 (Chris Doty-Humphrey's Small Fast Counting generator), as immutable,
 * JSON-serialisable state, so the PRNG can live inside the game state.
 */
export interface RngState {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

/** Expand a 32-bit seed into sfc32 state with splitmix32, then warm up. */
export function seedRng(seed: number): RngState {
  let s = seed >>> 0;
  const split = (): number => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return (z ^ (z >>> 15)) >>> 0;
  };
  let state: RngState = { a: split(), b: split(), c: split(), d: split() };
  for (let i = 0; i < 12; i++) state = nextUint32(state)[1];
  return state;
}

export function nextUint32(state: RngState): readonly [number, RngState] {
  const { a, b, c, d } = state;
  const t = (((a + b) >>> 0) + d) >>> 0;
  const next: RngState = {
    a: (b ^ (b >>> 9)) >>> 0,
    b: (c + (c << 3)) >>> 0,
    c: ((((c << 21) | (c >>> 11)) >>> 0) + t) >>> 0,
    d: (d + 1) >>> 0,
  };
  return [t, next];
}

/** A uniform integer in [0, n), without modulo bias. `n` must be in 1..2^32. */
export function nextInt(state: RngState, n: number): readonly [number, RngState] {
  if (!Number.isInteger(n) || n < 1 || n > 2 ** 32) throw new RangeError(`nextInt: bad bound ${n}`);
  const limit = 2 ** 32 - (2 ** 32 % n);
  let s = state;
  for (;;) {
    const [x, s2] = nextUint32(s);
    s = s2;
    if (x < limit) return [x % n, s];
  }
}
