export type Direction = 'ltr' | 'rtl';
export type WritingMode = 'horizontal-tb' | 'vertical-rl' | 'vertical-lr';

/**
 * Scripts whose characters are strongly right-to-left (Bidi_Class R or AL),
 * as ISO 15924 codes. Used only where `Intl.Locale#getTextInfo` is missing.
 */
export const RTL_SCRIPTS: readonly string[] = [
  'Adlm', 'Arab', 'Armi', 'Avst', 'Chrs', 'Cprt', 'Elym', 'Gara', 'Hatr',
  'Hebr', 'Hung', 'Khar', 'Lydi', 'Mand', 'Mani', 'Mend', 'Merc', 'Mero',
  'Narb', 'Nbat', 'Nkoo', 'Orkh', 'Ougr', 'Palm', 'Phli', 'Phlp', 'Phnx',
  'Prti', 'Rohg', 'Samr', 'Sarb', 'Sogd', 'Sogo', 'Syrc', 'Thaa', 'Yezi',
];

interface TextInfo {
  readonly direction?: string;
}
type LocaleWithTextInfo = Intl.Locale & {
  getTextInfo?: () => TextInfo;
  /** The getter from an earlier draft of the proposal (older V8). */
  readonly textInfo?: TextInfo;
};

/** The base direction of `locale`. Unknown or invalid tags are LTR. */
export function directionOf(locale: string | Intl.Locale): Direction {
  let loc: LocaleWithTextInfo;
  try {
    loc = typeof locale === 'string' ? new Intl.Locale(locale) : locale;
  } catch {
    return 'ltr';
  }
  const info = typeof loc.getTextInfo === 'function' ? loc.getTextInfo() : loc.textInfo;
  if (info?.direction === 'rtl' || info?.direction === 'ltr') return info.direction;
  return directionFromScript(loc);
}

/** The fallback when `getTextInfo` is unavailable: the maximised script decides. */
export function directionFromScript(locale: string | Intl.Locale): Direction {
  try {
    const script = (typeof locale === 'string' ? new Intl.Locale(locale) : locale).maximize().script;
    return script !== undefined && RTL_SCRIPTS.includes(script) ? 'rtl' : 'ltr';
  } catch {
    return 'ltr';
  }
}

/** The maximised script of `locale`, e.g. `Hant` for `zh-TW`. */
export function scriptOf(locale: string): string | undefined {
  try {
    return new Intl.Locale(locale).maximize().script;
  } catch {
    return undefined;
  }
}

export interface WritingModes {
  /** What a table in this locale gets unless someone changes it. */
  readonly default: WritingMode;
  /** Every mode the lobby offers for this locale; always includes `default`. */
  readonly options: readonly WritingMode[];
}

/**
 * Writing modes offered per locale (§7.8). Han-script and Japanese tables may
 * opt in to `vertical-rl`; Mongolian script is vertical-lr by default.
 */
export function writingModesFor(locale: string): WritingModes {
  switch (scriptOf(locale)) {
    case 'Hant':
    case 'Hans':
    case 'Jpan':
      return { default: 'horizontal-tb', options: ['horizontal-tb', 'vertical-rl'] };
    case 'Mong':
      return { default: 'vertical-lr', options: ['vertical-lr', 'horizontal-tb'] };
    default:
      return { default: 'horizontal-tb', options: ['horizontal-tb'] };
  }
}
