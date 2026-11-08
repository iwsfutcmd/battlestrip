import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { placementsFor, presetRules } from '../engine/index.ts';
import { CROCKFORD, gameCode } from './codes.ts';
import { codeLength, decodeFleetCode, encodeFleetCode, groupCode, normalizeCode, type FleetCodeContext, type FleetCodeContent } from './fleet-code.ts';

const contentArb = (ctx: FleetCodeContext): fc.Arbitrary<FleetCodeContent> =>
  fc.record({
    seat: fc.integer({ min: 0, max: 7 }),
    picks: fc.subarray(ctx.rules.shipyard.map((_, i) => i), { minLength: 1 }),
    seed: fc.array(fc.nat(), { minLength: ctx.rules.shipyard.length, maxLength: ctx.rules.shipyard.length }),
  }).map(({ seat, picks, seed }) => ({
    seat,
    ships: picks.map((k) => {
      const list = placementsFor(ctx.rules, ctx.rules.shipyard[k]?.length ?? 1);
      const p = list[(seed[k] ?? 0) % list.length];
      if (!p) throw new Error('no placements');
      return { ship: k, origin: p.origin, axis: p.axis };
    }),
  }));

const contexts: FleetCodeContext[] = [
  { gameCode: gameCode(1), rules: presetRules('classic') },
  { gameCode: gameCode(99), rules: presetRules('morskoyBoy') },
  { gameCode: gameCode(7), rules: presetRules('classic', { rows: 20, cols: 20 }) },
];

describe('fleet codes', () => {
  it('are about 13 characters for the classic fleet', () => {
    expect(codeLength(contexts[0] as FleetCodeContext) + 1).toBeLessThanOrEqual(13);
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
        if (!r.ok) rejected++;
      }),
      { numRuns: 300 },
    );
    expect(rejected).toBeGreaterThan(290);
  });

  it('reads what people type', () => {
    const ctx = contexts[0] as FleetCodeContext;
    const content: FleetCodeContent = { seat: 2, ships: [{ ship: 2, origin: { row: 3, col: 3 }, axis: 'alongRow' }] };
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
