import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fleetCheck, gameCode } from './codes.ts';
import { WARDROBE, placementsFor } from '../engine/index.ts';
import { LABEL_SYSTEM_IDS, base64url, decodeFleetImage, encodeFleetImage, fitName, fromBase64url, wardrobePiece, type FleetImage, type FleetImageShip } from './payload.ts';

const shipArb: fc.Arbitrary<FleetImageShip> = fc
  .record({ item: fc.integer({ min: 0, max: WARDROBE.length - 1 }), pick: fc.nat() })
  .map(({ item, pick }) => {
    const def = WARDROBE[item];
    if (!def) throw new Error('no piece');
    const list = placementsFor({ rows: 20, cols: 20 }, def);
    const p = list[pick % list.length];
    const piece = p && wardrobePiece(item, p.origin, p.orientation);
    if (!piece) throw new Error('no placement');
    return piece;
  });

const imageArb: fc.Arbitrary<FleetImage> = fc.record({
  gameCode: fc.integer({ min: 0, max: 0xfffff }).map((n) => gameCode(n)),
  fleetCheck: fc.integer({ min: 0, max: 99 }).map((n) => fleetCheck('ABCD', n, n, [])),
  rows: fc.integer({ min: 5, max: 20 }),
  cols: fc.integer({ min: 5, max: 20 }),
  labels: fc.constantFrom(...LABEL_SYSTEM_IDS),
  labels2: fc.option(fc.constantFrom(...LABEL_SYSTEM_IDS), { nil: null }),
  numbering: fc.constantFrom('latn', 'arab', 'arabext', 'hanidec', 'deva', 'thai'),
  dir: fc.constantFrom('ltr' as const, 'rtl' as const),
  writingMode: fc.constantFrom('horizontal-tb' as const, 'vertical-rl' as const, 'vertical-lr' as const),
  name: fc.string({ unit: 'grapheme', minLength: 1, maxLength: 24 }).map((s) => fitName(s)),
  identity: fc.integer({ min: 0, max: 7 }),
  ships: fc.array(shipArb, { minLength: 1, maxLength: 10 }),
});

describe('fleet-image payload', () => {
  it('decode(encode(x)) equals x', () => {
    fc.assert(
      fc.property(imageArb, (image) => {
        expect(decodeFleetImage(encodeFleetImage(image))).toEqual({ ok: true, value: image });
      }),
      { numRuns: 500 },
    );
  });

  it('base64url round-trips any bytes', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 300 }), (bytes) => {
        expect(fromBase64url(base64url(bytes))).toEqual(bytes);
      }),
    );
  });

  it('stays under ~400 URL characters in the worst case', () => {
    const worstNames = [
      '👨‍👩‍👧‍👦'.repeat(24), // 24 ZWJ family graphemes
      'क्षत्रिय'.repeat(6), // conjunct-heavy Devanagari
      'ᠮᠣᠩᠭᠣᠯ'.repeat(4),
      'ﷺ'.repeat(24),
    ];
    for (const name of worstNames) {
      const image: FleetImage = {
        gameCode: 'ZZZZ',
        fleetCheck: 'ZZZ',
        rows: 20,
        cols: 20,
        labels: 'arabicAlphabetical',
        labels2: 'earthlyBranches',
        numbering: 'hanidec',
        dir: 'rtl',
        writingMode: 'vertical-rl',
        name,
        identity: 7,
        ships: Array.from({ length: 10 }, (_, i) => {
          const piece = wardrobePiece(WARDROBE.length - 1 - i, { row: 15, col: 15 }, 7);
          if (!piece) throw new Error('no piece');
          return piece;
        }),
      };
      const url = `https://battlestrip.example.org/fleet/#${encodeFleetImage(image)}`;
      expect(Array.from(url).length, name).toBeLessThan(400);
      const decoded = decodeFleetImage(encodeFleetImage(image));
      expect(decoded.ok && decoded.value.name.startsWith(name.slice(0, 2))).toBe(true);
    }
  });

  it('cuts long names at grapheme boundaries', () => {
    const cut = fitName('👩🏽‍🚀'.repeat(30), 40);
    expect(new TextEncoder().encode(cut).byteLength).toBeLessThanOrEqual(40);
    expect(cut.endsWith('…')).toBe(true);
    const graphemes = [...new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(cut.replace('…', ''))];
    expect(graphemes.every((g) => g.segment === '👩🏽‍🚀')).toBe(true);
  });

  it('rejects garbage and unknown versions', () => {
    expect(decodeFleetImage('').ok).toBe(false);
    expect(decodeFleetImage('not base64!')).toEqual({ ok: false, error: 'payload.corrupt' });
    expect(decodeFleetImage(base64url(Uint8Array.from([9, ...new Array<number>(20).fill(0)])))).toEqual({ ok: false, error: 'payload.version' });
  });

  it('fleet checks change with the layout version', () => {
    const a = fleetCheck('AB12', 0, 0, [{ ship: 'cruiser', origin: { row: 1, col: 1 }, orientation: 0 }]);
    const b = fleetCheck('AB12', 0, 1, [{ ship: 'cruiser', origin: { row: 1, col: 1 }, orientation: 0 }]);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9A-HJKMNP-TV-Z]{3}$/u);
  });
});
