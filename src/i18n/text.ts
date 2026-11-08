/** User-text helpers: graphemes, never code units (§7.6, §8). */

const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });

export function graphemes(text: string): string[] {
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

export const MAX_NAME_GRAPHEMES = 24;

/** NFC, and at most `max` grapheme clusters ("👩🏽‍🚀" counts as one). */
export function cleanName(text: string, max = MAX_NAME_GRAPHEMES): string {
  return graphemes(text.normalize('NFC')).slice(0, max).join('');
}

/** Names equal at the base level for `locale` (warned about, never blocked). */
export function sameName(a: string, b: string, locale: string): boolean {
  return new Intl.Collator(locale, { sensitivity: 'base', usage: 'search' }).compare(a.trim(), b.trim()) === 0;
}
