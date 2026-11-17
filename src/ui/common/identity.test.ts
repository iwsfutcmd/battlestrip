import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS } from '../../engine/index.ts';
import { firstFreeIdentity, identityColour, identityParts, identityShape, nextIdentity, PALETTE, SHAPES, COLOUR_IDS, SHAPE_IDS } from './identity.tsx';

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

describe('choosing a colour and shape', () => {
  it('steps to the next pair nobody else has, both ways, wrapping round', () => {
    expect(nextIdentity(0, [1, 2])).toBe(3);
    expect(nextIdentity(3, [1, 2], -1)).toBe(0);
    expect(nextIdentity(0, [], -1)).toBe(63);
    expect(nextIdentity(63, [0])).toBe(1);
  });
  it('stays put when every other pair is taken', () => {
    const taken = Array.from({ length: 64 }, (_, i) => i).filter((i) => i !== 9);
    expect(nextIdentity(9, taken)).toBe(9);
  });
  it('gives a new seat the first free pair', () => {
    expect(firstFreeIdentity([0, 1, 3])).toBe(2);
    expect(firstFreeIdentity([])).toBe(0);
  });
  it('names the colour and shape actually drawn', () => {
    for (let i = 0; i < 64; i++) {
      const { colour, shape } = identityParts(i);
      expect(PALETTE[COLOUR_IDS.indexOf(colour)]).toBe(identityColour(i));
      expect(SHAPES[SHAPE_IDS.indexOf(shape)]).toBe(identityShape(i));
    }
  });
});
