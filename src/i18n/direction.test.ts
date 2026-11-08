import { describe, expect, it } from 'vitest';
import { directionFromScript, directionOf, RTL_SCRIPTS, writingModesFor } from './direction.ts';

describe('directionOf', () => {
  it.each([
    ['en', 'ltr'],
    ['en-XA', 'ltr'],
    ['zh-Hant', 'ltr'],
    ['mn-Mong', 'ltr'],
    ['ru', 'ltr'],
    ['ar', 'rtl'],
    ['ar-XB', 'rtl'],
    ['ar-u-nu-latn', 'rtl'],
    ['he', 'rtl'],
    ['fa', 'rtl'],
    ['ur', 'rtl'],
    ['syr', 'rtl'],
    ['dv', 'rtl'],
    ['nqo', 'rtl'],
    ['ff-Adlm', 'rtl'],
    ['ff-Latn', 'ltr'],
    ['az-Arab', 'rtl'],
    ['not a tag!!', 'ltr'],
  ] as const)('%s is %s', (tag, dir) => {
    expect(directionOf(tag)).toBe(dir);
    expect(directionFromScript(tag)).toBe(dir);
  });

  it('the script fallback knows every listed RTL script', () => {
    for (const script of RTL_SCRIPTS) expect(directionFromScript(`und-${script}`)).toBe('rtl');
    for (const script of ['Latn', 'Cyrl', 'Grek', 'Hani', 'Hant', 'Jpan', 'Kore', 'Mong', 'Deva', 'Ethi']) {
      expect(directionFromScript(`und-${script}`)).toBe('ltr');
    }
  });
});

describe('writingModesFor', () => {
  it('offers vertical-rl to Chinese and Japanese, but does not force it', () => {
    for (const tag of ['zh-Hant', 'zh-TW', 'ja']) {
      expect(writingModesFor(tag)).toEqual({ default: 'horizontal-tb', options: ['horizontal-tb', 'vertical-rl'] });
    }
  });
  it('makes Mongolian script vertical-lr by default, but not Cyrillic Mongolian', () => {
    expect(writingModesFor('mn-Mong').default).toBe('vertical-lr');
    expect(writingModesFor('mn').options).toEqual(['horizontal-tb']);
  });
  it('is horizontal-only elsewhere', () => {
    for (const tag of ['en', 'ar', 'he', 'ko']) expect(writingModesFor(tag).options).toEqual(['horizontal-tb']);
  });
});
