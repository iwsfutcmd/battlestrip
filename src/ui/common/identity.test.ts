import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS } from '../../engine/index.ts';
import { identityColour, identityShape } from './identity.tsx';

describe('player identities', () => {
  it('give every seat its own colour and shape pair, well past the biggest table', () => {
    const pairs = Array.from({ length: 64 }, (_, i) => `${identityColour(i)} ${identityShape(i)}`);
    expect(new Set(pairs).size).toBe(64);
    expect(MAX_PLAYERS).toBeLessThanOrEqual(64);
  });

  it('keep the first eight as they were: one colour and one shape each', () => {
    expect(new Set(Array.from({ length: 8 }, (_, i) => identityColour(i))).size).toBe(8);
    expect(new Set(Array.from({ length: 8 }, (_, i) => identityShape(i))).size).toBe(8);
  });
});
