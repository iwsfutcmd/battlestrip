/**
 * Bidi isolation for plain strings (aria-live text, document.title, the
 * CLI). In markup, use `<bdi>` instead.
 */
export const FSI = '\u2068';
export const LRI = '\u2066';
export const RLI = '\u2067';
export const PDI = '\u2069';

/** First-strong isolate: for player names and anything of unknown direction. */
export function isolate(text: string): string {
  return FSI + text + PDI;
}

/** Left-to-right isolate: for Latin-by-design codes (game codes, fleet checks). */
export function isolateLtr(text: string): string {
  return LRI + text + PDI;
}

/**
 * Join items with `Intl.ListFormat` (conjunction), isolating each item so a
 * Hebrew name next to an Arabic one cannot reorder the separators.
 */
export function formatList(
  locale: string,
  items: readonly string[],
  type: Intl.ListFormatType = 'conjunction',
): string {
  return new Intl.ListFormat(locale, { type, style: 'long' }).format(items.map(isolate));
}

const RTL_LETTER =
  /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Adlam}\p{Script=Hanifi_Rohingya}\p{Script=Mandaic}\p{Script=Samaritan}]/u;

/** The direction of the first strong letter, as UAX #9's P2–P3 would find it (approximated by script). */
export function firstStrongDirection(text: string): 'ltr' | 'rtl' | null {
  for (const ch of text) {
    if (!/\p{L}/u.test(ch)) continue;
    return RTL_LETTER.test(ch) ? 'rtl' : 'ltr';
  }
  return null;
}
