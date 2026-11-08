import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { nextInt, nextUint32, seedRng, type RngState } from './rng.ts';

/** The textbook closure form of sfc32, for cross-checking the immutable one. */
function referenceSfc32(s: RngState): () => number {
  let { a, b, c, d } = s;
  return () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
}

describe('sfc32', () => {
  it('matches the reference implementation', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), (seed) => {
        let s = seedRng(seed);
        const ref = referenceSfc32(s);
        for (let i = 0; i < 50; i++) {
          const [x, next] = nextUint32(s);
          expect(x).toBe(ref());
          s = next;
        }
      }),
    );
  });

  it('is deterministic and its state survives JSON', () => {
    const a = seedRng(42);
    const b = JSON.parse(JSON.stringify(a)) as RngState;
    expect(nextUint32(a)).toEqual(nextUint32(b));
    expect(seedRng(42)).toEqual(a);
    expect(seedRng(43)).not.toEqual(a);
  });

  it('nextInt stays in range and is roughly uniform', () => {
    let s = seedRng(7);
    const counts = Array.from({ length: 6 }, () => 0);
    const draws = 60_000;
    for (let i = 0; i < draws; i++) {
      const [x, next] = nextInt(s, 6);
      s = next;
      counts[x] = (counts[x] ?? 0) + 1;
    }
    const expected = draws / 6;
    const chiSquare = counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
    expect(chiSquare).toBeLessThan(20.5); // p ≈ 0.001 at 5 degrees of freedom
  });
});
