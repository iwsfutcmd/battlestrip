import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LABEL_SYSTEMS, alphabetic, colLabel, defaultLabelSystem, fixed, rowLabel, systemForRows, type LabelSystemId } from './labels.ts';
import { digitValue, parseCoord } from './parse.ts';

const ALL = Object.keys(LABEL_SYSTEMS) as LabelSystemId[];

describe('label systems', () => {
  it('has the symbol counts from the spec', () => {
    const counts: Partial<Record<LabelSystemId, number>> = {
      arabicAbjad: 28,
      arabicAlphabetical: 28,
      persian: 32,
      hebrew: 22,
      greek: 24,
      morskoyBoy: 28,
      respublika: 10,
      heavenlyStems: 10,
      earthlyBranches: 12,
      hangul: 14,
      iroha: 47,
    };
    for (const [id, n] of Object.entries(counts)) expect(LABEL_SYSTEMS[id as LabelSystemId].symbols, id).toHaveLength(n);
  });

  it('every symbol is NFC and unique within its system', () => {
    for (const s of Object.values(LABEL_SYSTEMS)) {
      expect(new Set(s.symbols).size).toBe(s.symbols.length);
      for (const sym of s.symbols) expect(sym.normalize('NFC')).toBe(sym);
    }
  });

  it('writes Arabic heh with a tatweel (هـ), never bare', () => {
    expect(rowLabel('arabicAbjad', 'ar', 4)).toBe('هـ');
    for (const id of ['arabicAbjad', 'arabicAlphabetical', 'persian', 'persianAbjad'] as const) {
      expect(LABEL_SYSTEMS[id].symbols).not.toContain('ه');
    }
  });

  it('implements alphabetic and fixed', () => {
    const latin = LABEL_SYSTEMS.latin.symbols;
    expect([1, 2, 26, 27, 28, 52, 53, 702, 703].map((v) => alphabetic(v, latin))).toEqual([
      'A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA',
    ]);
    expect(fixed(1, LABEL_SYSTEMS.heavenlyStems.symbols)).toBe('甲');
    expect(fixed(11, LABEL_SYSTEMS.heavenlyStems.symbols)).toBeUndefined();
  });

  it('never mixes systems on an axis: 天干 → 地支 → numerals', () => {
    expect(systemForRows('heavenlyStems', 10)).toBe('heavenlyStems');
    expect(systemForRows('heavenlyStems', 12)).toBe('earthlyBranches');
    expect(systemForRows('heavenlyStems', 13)).toBe('numeric');
    expect(systemForRows('hebrew', 20)).toBe('hebrew');
    expect(systemForRows('latin', 20)).toBe('latin');
  });

  it('picks defaults by locale', () => {
    expect(defaultLabelSystem('ar-EG')).toBe('arabicAbjad');
    expect(defaultLabelSystem('zh-Hant-TW')).toBe('heavenlyStems');
    expect(defaultLabelSystem('ja')).toBe('latin');
    expect(defaultLabelSystem('ru')).toBe('morskoyBoy');
    expect(defaultLabelSystem('en-XA')).toBe('latin');
  });

  it('uses locale digits for columns', () => {
    expect(colLabel('ar-u-nu-arab', 6)).toBe('٧');
    expect(colLabel('zh-Hant-u-nu-hanidec', 9)).toBe('一〇');
    expect(colLabel('en', 19)).toBe('20');
  });
});

describe('parseCoord', () => {
  const ctx = (systems: LabelSystemId[], rows = 10, cols = 10) => ({ rows, cols, systems });

  it('reads any decimal digit', () => {
    expect(['0', '٧', '۷', '७', '৭', '𝟕', '𝟗', '７'].map(digitValue)).toEqual([0, 7, 7, 7, 7, 7, 9, 7]);
  });

  it.each([
    ['D4', ['latin'], 3, 3],
    ['d4', ['latin'], 3, 3],
    ['4D', ['latin'], 3, 3],
    [' d 10 ', ['latin'], 3, 9],
    ['Ｄ７', ['latin'], 3, 6],
    ['د٤', ['arabicAbjad'], 3, 3],
    ['٤د', ['arabicAbjad'], 3, 3],
    ['ه5', ['arabicAbjad'], 4, 4],
    ['ا1', ['arabicAbjad'], 0, 0],
    ['D4', ['arabicAbjad'], 3, 3],
    ['甲7', ['heavenlyStems'], 0, 6],
    ['癸一〇', ['heavenlyStems'], 9, 9],
    ['к10', ['morskoyBoy'], 9, 9],
    ['K10', ['morskoyBoy'], 9, 9],
    ['B2', ['morskoyBoy'], 2, 1],
    ['Β2', ['greek'], 1, 1],
    ['b2', ['greek'], 1, 1],
    ['4-7', ['numeric'], 3, 6],
    ['ב3', ['hebrew', 'latin'], 1, 2],
    ['C3', ['hebrew', 'latin'], 2, 2],
  ] as const)('%s with %j → (%i, %i)', (input, systems, row, col) => {
    expect(parseCoord(input, ctx([...systems]))).toEqual({ ok: true, value: { row, col } });
  });

  it.each([
    ['', 'parse.empty'],
    ['   ', 'parse.empty'],
    ['hello', 'parse.unrecognised'],
    ['K4', 'parse.outOfRange'],
    ['D11', 'parse.outOfRange'],
    ['D0', 'parse.outOfRange'],
    ['D4 5', 'parse.unrecognised'],
  ] as const)('%j → %s', (input, error) => {
    expect(parseCoord(input, ctx(['latin']))).toEqual({ ok: false, error });
  });

  it('asks for a separator when both axes are numeric', () => {
    expect(parseCoord('47', ctx(['numeric']))).toEqual({ ok: false, error: 'parse.ambiguous' });
  });

  it('round-trips parse(format(c)) for every system and coordinate', () => {
    const locales = ['en', 'ar', 'ar-u-nu-latn', 'fa', 'zh-Hant-u-nu-hanidec', 'hi-u-nu-deva', 'th-u-nu-thai'];
    fc.assert(
      fc.property(fc.constantFrom(...ALL), fc.constantFrom(...locales), fc.integer({ min: 5, max: 20 }), fc.integer({ min: 5, max: 20 }), (preferred, locale, rows, cols) => {
        const system = systemForRows(preferred, rows);
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const r = rowLabel(system, locale, row);
            const c = colLabel(locale, col);
            const text = system === 'numeric' ? `${r}-${c}` : r + c;
            expect(parseCoord(text, { rows, cols, systems: [system] }), text).toEqual({ ok: true, value: { row, col } });
          }
        }
      }),
      { numRuns: 150 },
    );
  });
});
