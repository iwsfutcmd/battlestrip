import { describe, expect, it } from 'vitest';
import { htmlLang, negotiateLocale } from './negotiate.ts';

describe('negotiateLocale', () => {
  it.each([
    [['en'], 'en', 'en'],
    [['en-GB'], 'en', 'en-GB'],
    [['EN-gb'], 'en', 'en-GB'],
    [['ar'], 'ar', 'ar'],
    [['ar-EG'], 'ar', 'ar-EG'],
    [['zh-Hant'], 'zh-Hant', 'zh-Hant'],
    [['zh-TW'], 'zh-Hant', 'zh-Hant-TW'],
    [['zh-HK'], 'zh-Hant', 'zh-Hant-HK'],
    [['zh-Hant-MO'], 'zh-Hant', 'zh-Hant-MO'],
    [['fr', 'ar'], 'ar', 'ar'],
    [['fr'], 'en', 'en'],
    [[], 'en', 'en'],
    [['not a tag!!', 'ar'], 'ar', 'ar'],
    [['und', 'ar'], 'ar', 'ar'],
  ] as const)('%j → %s (%s)', (requested, catalog, locale) => {
    expect(negotiateLocale(requested)).toEqual({ catalog, locale });
  });

  it('keeps -u-nu- and -u-ca- extensions for formatting', () => {
    expect(negotiateLocale(['ar-u-nu-latn'])).toEqual({ catalog: 'ar', locale: 'ar-u-nu-latn' });
    expect(negotiateLocale(['zh-TW-u-nu-hanidec'])).toEqual({ catalog: 'zh-Hant', locale: 'zh-Hant-TW-u-nu-hanidec' });
    expect(negotiateLocale(['ar-SA-u-ca-islamic'])).toEqual({ catalog: 'ar', locale: 'ar-SA-u-ca-islamic' });
  });

  it('respects script: Simplified Chinese prefers a later exact match over Traditional', () => {
    expect(negotiateLocale(['zh-CN', 'en'])).toEqual({ catalog: 'en', locale: 'en' });
    expect(negotiateLocale(['zh-CN'])).toEqual({ catalog: 'zh-Hant', locale: 'zh-Hant-CN' });
  });

  it('matches pseudolocales only when asked for by region', () => {
    expect(negotiateLocale(['en-XA'])).toEqual({ catalog: 'en-XA', locale: 'en-XA' });
    expect(negotiateLocale(['ar-XB'])).toEqual({ catalog: 'ar-XB', locale: 'ar-XB' });
    expect(negotiateLocale(['en-US']).catalog).toBe('en');
    expect(negotiateLocale(['ar-SA']).catalog).toBe('ar');
  });
});

describe('htmlLang', () => {
  it('drops extensions but keeps script and region', () => {
    expect(htmlLang('ar-u-nu-latn')).toBe('ar');
    expect(htmlLang('zh-Hant-TW-u-nu-hanidec')).toBe('zh-Hant-TW');
  });
});
