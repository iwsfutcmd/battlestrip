import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { outfit, placementsFor, presetRules, wardrobeRules } from '../engine/index.ts';
import { CROCKFORD, gameCode } from './codes.ts';
import { codeLength, decodeFleetCode, encodeFleetCode, groupCode, normalizeCode, type FleetCodeContext, type FleetCodeContent } from './fleet-code.ts';

const contentArb = (ctx: FleetCodeContext): fc.Arbitrary<FleetCodeContent> =>
  fc
    .record({
      seat: fc.integer({ min: 0, max: ctx.fleets.length - 1 }),
      seed: fc.array(fc.nat(), { minLength: ctx.rules.shipyard.length, maxLength: ctx.rules.shipyard.length }),
    })
    .map(({ seat, seed }) => ({
      seat,
      ships: [...(ctx.fleets[seat] ?? [])]
        .sort((a, b) => a - b)
        .map((k) => {
          const def = ctx.rules.shipyard[k];
          if (!def) throw new Error('no such piece');
          const list = placementsFor(ctx.rules, def);
          const p = list[(seed[k] ?? 0) % list.length];
          if (!p) throw new Error('no placements');
          return { ship: k, origin: p.origin, orientation: p.orientation };
        }),
    }));

const idx = (rules: { shipyard: readonly { id: string }[] }, ids: readonly string[]): number[] =>
  ids.map((id) => rules.shipyard.findIndex((s) => s.id === id));

const wardrobe = wardrobeRules();
const contexts: FleetCodeContext[] = [
  { gameCode: gameCode(1), rules: presetRules('classic'), fleets: [[0, 1, 2, 3, 4], [2], [0, 4]] },
  { gameCode: gameCode(99), rules: presetRules('morskoyBoy'), fleets: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [9]] },
  {
    gameCode: gameCode(7),
    rules: wardrobe,
    fleets: [idx(wardrobe, outfit('everyday')), idx(wardrobe, outfit('dressedUp')), idx(wardrobe, ['ring']), idx(wardrobe, outfit('bundledUp'))],
  },
  { gameCode: gameCode(8), rules: wardrobeRules({ rows: 20, cols: 20 }), fleets: [idx(wardrobe, outfit('bundledUp'))] },
];

describe('fleet codes', () => {
  it('are about 13 characters for a classic-sized outfit, and stay readable for big ones', () => {
    expect(codeLength(contexts[0] as FleetCodeContext) + 1).toBeLessThanOrEqual(13);
    expect(codeLength(contexts[2] as FleetCodeContext) + 1).toBeLessThanOrEqual(24);
  });

  it.each(contexts.map((c, i) => [i, c] as const))('round-trip (context %i)', (_i, ctx) => {
    fc.assert(
      fc.property(contentArb(ctx), (content) => {
        const code = encodeFleetCode(ctx, content);
        expect(decodeFleetCode(ctx, groupCode(code))).toEqual({ ok: true, value: content });
      }),
      { numRuns: 300 },
    );
  });

  it('catches every single substitution and every adjacent transposition', () => {
    const ctx = contexts[0] as FleetCodeContext;
    fc.assert(
      fc.property(contentArb(ctx), fc.nat(), fc.nat(), (content, pos, sym) => {
        const code = encodeFleetCode(ctx, content);
        const chars = [...code];
        const i = pos % chars.length;
        const alphabet = i === chars.length - 1 ? `${CROCKFORD}*~$=U` : CROCKFORD;
        // eslint-disable-next-line battlestrip/no-string-length -- ASCII alphabet by design
        const replacement = alphabet[sym % alphabet.length] ?? '0';
        if (replacement !== chars[i]) {
          const bad = [...chars];
          bad[i] = replacement;
          expect(decodeFleetCode(ctx, bad.join('')).ok).toBe(false);
        }
        const j = pos % (chars.length - 1);
        if (chars[j] !== chars[j + 1]) {
          const swapped = [...chars];
          [swapped[j], swapped[j + 1]] = [swapped[j + 1] ?? '', swapped[j] ?? ''];
          expect(decodeFleetCode(ctx, swapped.join('')).ok).toBe(false);
        }
      }),
      { numRuns: 2000 },
    );
  });

  it('rejects codes from another game', () => {
    const a = contexts[0] as FleetCodeContext;
    const b: FleetCodeContext = { ...a, gameCode: gameCode(2) };
    let rejected = 0;
    fc.assert(
      fc.property(contentArb(a), (content) => {
        const r = decodeFleetCode(b, encodeFleetCode(a, content));
        // (Codes for another game decode to a wrong game check almost always.)
        if (!r.ok) rejected++;
      }),
      { numRuns: 300 },
    );
    expect(rejected).toBeGreaterThan(290);
  });

  it('reads what people type', () => {
    const ctx = contexts[0] as FleetCodeContext;
    const content: FleetCodeContent = { seat: 1, ships: [{ ship: 2, origin: { row: 3, col: 3 }, orientation: 0 }] };
    const code = encodeFleetCode(ctx, content);
    const sloppy = groupCode(code)
      .toLocaleLowerCase('und')
      .replaceAll('1', 'l')
      .replaceAll('0', 'o')
      .replaceAll('5', '٥');
    expect(decodeFleetCode(ctx, ` ${sloppy} `)).toEqual({ ok: true, value: content });
    expect(normalizeCode('ab-cd ef')).toBe('ABCDEF');
    expect(decodeFleetCode(ctx, '')).toEqual({ ok: false, error: 'code.empty' });
    expect(decodeFleetCode(ctx, 'ABC')).toEqual({ ok: false, error: 'code.length' });
  });

  it('groups 4-4-4-1 for display', () => {
    expect(groupCode('ABCDEFGHJKMNP')).toBe('ABCD-EFGH-JKMN-P');
  });
});
