import { describe, expect, it } from 'vitest';
import { FSI, formatList, PDI } from './isolate.ts';
import { createTranslator, toSegments } from './messages.ts';
import { strictTranslator, stripBidi } from './test-helpers.ts';

describe('translator', () => {
  it('formats English plurals', () => {
    const t = strictTranslator('en');
    expect(t.format('hello.playerCount', { count: 1 })).toBe('1 player');
    expect(t.format('hello.playerCount', { count: 6 })).toBe('6 players');
    expect(t.format('hello.playerCount', { count: 0 })).toBe('0 players');
  });

  it('isolates player names in plain strings (FSI…PDI)', () => {
    for (const catalog of ['en', 'ar', 'zh-Hant'] as const) {
      const out = strictTranslator(catalog).format('roster.calling', { name: 'لينا' });
      expect(out).toContain(FSI + 'لينا' + PDI);
    }
  });

  it('turns isolated placeholders into segments for <bdi>', () => {
    const t = strictTranslator('en');
    expect(toSegments(t.formatToParts('roster.calling', { name: 'יעל' }))).toEqual([
      { kind: 'isolate', dir: 'auto', text: 'יעל' },
      { kind: 'text', text: ' is calling' },
    ]);
  });

  it('isolates a name that starts with a digit inside an RTL message', () => {
    const t = strictTranslator('ar');
    const segments = toSegments(t.formatToParts('roster.calling', { name: '7 Seas' }));
    expect(segments).toContainEqual({ kind: 'isolate', dir: 'auto', text: '7 Seas' });
  });

  it('uses the locale’s default digits, and honours -u-nu-', () => {
    const arab = new Intl.NumberFormat('ar').format(3);
    expect(stripBidi(strictTranslator('ar').format('hello.seat', { seat: 3 }))).toBe(`المقعد ${arab}`);
    expect(stripBidi(strictTranslator('ar', 'ar-u-nu-latn').format('hello.seat', { seat: 3 }))).toBe('المقعد 3');
    expect(stripBidi(strictTranslator('zh-Hant', 'zh-Hant-TW-u-nu-hanidec').format('hello.seat', { seat: 3 }))).toBe(
      '三號座',
    );
  });

  it('Arabic exercises all six CLDR plural categories', () => {
    const t = strictTranslator('ar');
    const nf = new Intl.NumberFormat('ar');
    const pr = new Intl.PluralRules('ar');
    const cases = [
      [0, 'zero', 'لا لاعبين'],
      [1, 'one', 'لاعب واحد'],
      [2, 'two', 'لاعبان'],
      [3, 'few', `${nf.format(3)} لاعبين`],
      [11, 'many', `${nf.format(11)} لاعبًا`],
      [100, 'other', `${nf.format(100)} لاعب`],
    ] as const;
    for (const [n, category, text] of cases) {
      expect(pr.select(n)).toBe(category);
      expect(stripBidi(t.format('hello.playerCount', { count: n }))).toBe(text);
    }
  });

  it('falls back visibly for unknown keys instead of throwing', () => {
    const errors: unknown[] = [];
    const t = createTranslator({ catalog: 'en', locale: 'en', messages: {}, onError: (e) => errors.push(e) });
    expect(stripBidi(t.format('app.title'))).toBe('app.title');
    expect(errors).toHaveLength(1);
  });
});

describe('formatList', () => {
  it('joins with Intl.ListFormat and isolates every item', () => {
    expect(formatList('en', ['יעל', 'لينا', 'Ada'])).toBe(`${FSI}יעל${PDI}, ${FSI}لينا${PDI}, and ${FSI}Ada${PDI}`);
    expect(stripBidi(formatList('zh-Hant', ['甲', '乙', '丙']))).toBe('甲、乙和丙');
    expect(stripBidi(formatList('ar', ['أ', 'ب']))).toBe('أ وب');
  });
});
