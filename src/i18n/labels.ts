/**
 * Coordinate labels (§7.4). Rows get an enumerative label system; columns get
 * locale digits from 1. The CSS Counter Styles Level 3 `alphabetic` and
 * `fixed` algorithms are implemented here because the strings are needed in
 * JS (TV, phone, speech, parsing), where CSS counter() can't reach.
 */

export type LabelSystemId =
  | 'latin'
  | 'arabicAbjad'
  | 'arabicAlphabetical'
  | 'persian'
  | 'persianAbjad'
  | 'hebrew'
  | 'greek'
  | 'morskoyBoy'
  | 'respublika'
  | 'heavenlyStems'
  | 'earthlyBranches'
  | 'hangul'
  | 'iroha'
  | 'numeric';

export interface LabelSystem {
  readonly id: LabelSystemId;
  readonly algorithm: 'alphabetic' | 'fixed' | 'numeric';
  readonly symbols: readonly string[];
  /** Script, for homoglyph handling and fonts. */
  readonly script: 'Latn' | 'Arab' | 'Hebr' | 'Grek' | 'Cyrl' | 'Hani' | 'Hang' | 'Kana' | 'Zyyy';
}

const split = (s: string): string[] => s.split(' ');

/*
 * Arabic heh is written هـ (U+0647 U+0640, heh + tatweel) wherever it appears
 * in a sequence: the usual standalone form, and it can't be read as the
 * Arabic-Indic digit ٥.
 */
const HEH = 'هـ';

export const LABEL_SYSTEMS: Readonly<Record<LabelSystemId, LabelSystem>> = {
  latin: { id: 'latin', algorithm: 'alphabetic', symbols: split('A B C D E F G H I J K L M N O P Q R S T U V W X Y Z'), script: 'Latn' },
  arabicAbjad: {
    id: 'arabicAbjad',
    algorithm: 'fixed',
    symbols: split(`أ ب ج د ${HEH} و ز ح ط ي ك ل م ن س ع ف ص ق ر ش ت ث خ ذ ض ظ غ`),
    script: 'Arab',
  },
  arabicAlphabetical: {
    id: 'arabicAlphabetical',
    algorithm: 'fixed',
    symbols: split(`أ ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ${HEH} و ي`),
    script: 'Arab',
  },
  persian: {
    id: 'persian',
    algorithm: 'fixed',
    symbols: split(`الف ب پ ت ث ج چ ح خ د ذ ر ز ژ س ش ص ض ط ظ ع غ ف ق ک گ ل م ن و ${HEH} ی`),
    script: 'Arab',
  },
  persianAbjad: {
    id: 'persianAbjad',
    algorithm: 'fixed',
    symbols: split(`الف ب ج د ${HEH} و ز ح ط ی ک ل م ن س ع ف ص ق ر ش ت ث خ ذ ض ظ غ`),
    script: 'Arab',
  },
  hebrew: { id: 'hebrew', algorithm: 'fixed', symbols: split('א ב ג ד ה ו ז ח ט י כ ל מ נ ס ע פ צ ק ר ש ת'), script: 'Hebr' },
  greek: { id: 'greek', algorithm: 'fixed', symbols: split('Α Β Γ Δ Ε Ζ Η Θ Ι Κ Λ Μ Ν Ξ Ο Π Ρ Σ Τ Υ Φ Χ Ψ Ω'), script: 'Grek' },
  /** Russian alphabet minus Ё Й Ъ Ы Ь, as in Морской бой. */
  morskoyBoy: {
    id: 'morskoyBoy',
    algorithm: 'fixed',
    symbols: split('А Б В Г Д Е Ж З И К Л М Н О П Р С Т У Ф Х Ц Ч Ш Щ Э Ю Я'),
    script: 'Cyrl',
  },
  /** The ten distinct letters of РЕСПУБЛИКА. */
  respublika: { id: 'respublika', algorithm: 'fixed', symbols: split('Р Е С П У Б Л И К А'), script: 'Cyrl' },
  heavenlyStems: { id: 'heavenlyStems', algorithm: 'fixed', symbols: split('甲 乙 丙 丁 戊 己 庚 辛 壬 癸'), script: 'Hani' },
  earthlyBranches: { id: 'earthlyBranches', algorithm: 'fixed', symbols: split('子 丑 寅 卯 辰 巳 午 未 申 酉 戌 亥'), script: 'Hani' },
  hangul: { id: 'hangul', algorithm: 'fixed', symbols: split('가 나 다 라 마 바 사 아 자 차 카 타 파 하'), script: 'Hang' },
  iroha: {
    id: 'iroha',
    algorithm: 'fixed',
    symbols: split(
      'イ ロ ハ ニ ホ ヘ ト チ リ ヌ ル ヲ ワ カ ヨ タ レ ソ ツ ネ ナ ラ ム ウ ヰ ノ オ ク ヤ マ ケ フ コ エ テ ア サ キ ユ メ ミ シ ヱ ヒ モ セ ス',
    ),
    script: 'Kana',
  },
  numeric: { id: 'numeric', algorithm: 'numeric', symbols: [], script: 'Zyyy' },
};

/** CSS Counter Styles 3 `alphabetic`: A … Z, AA, AB, … (1-based). */
export function alphabetic(value: number, symbols: readonly string[]): string {
  const n = symbols.length;
  let v = value;
  let out = '';
  while (v > 0) {
    v -= 1;
    out = (symbols[v % n] ?? '') + out;
    v = Math.floor(v / n);
  }
  return out;
}

/** CSS Counter Styles 3 `fixed` (first symbol value 1): undefined past the last symbol. */
export function fixed(value: number, symbols: readonly string[]): string | undefined {
  return value >= 1 ? symbols[value - 1] : undefined;
}

/** Whether `system` can label `count` items without running out (alphabetic and numeric never do). */
export function fits(system: LabelSystemId, count: number): boolean {
  const s = LABEL_SYSTEMS[system];
  return s.algorithm !== 'fixed' || s.symbols.length >= count;
}

/** Fallbacks when a fixed system is too short (§7.4: 天干 → 地支, else the whole axis goes numeric). */
const NEXT: Partial<Record<LabelSystemId, LabelSystemId>> = {
  heavenlyStems: 'earthlyBranches',
  respublika: 'morskoyBoy',
};

/** The system to actually use for `rows` rows: never mixes systems within an axis. */
export function systemForRows(preferred: LabelSystemId, rows: number): LabelSystemId {
  let s: LabelSystemId | undefined = preferred;
  while (s) {
    if (fits(s, rows)) return s;
    s = NEXT[s];
  }
  return 'numeric';
}

/** Default row system per locale (by language). */
export function defaultLabelSystem(locale: string): LabelSystemId {
  let lang = 'en';
  try {
    lang = new Intl.Locale(locale).language;
  } catch {
    // keep the default
  }
  switch (lang) {
    case 'ar':
      return 'arabicAbjad';
    case 'fa':
      return 'persian';
    case 'he':
      return 'hebrew';
    case 'el':
      return 'greek';
    case 'ru':
      return 'morskoyBoy';
    case 'zh':
      return 'heavenlyStems';
    case 'ko':
      return 'hangul';
    default:
      return 'latin';
  }
}

/** Column (and numeric row) numbers in the locale's digits, from 1. */
export function formatNumber(locale: string, value: number): string {
  return new Intl.NumberFormat(locale, { useGrouping: false }).format(value);
}

/** The label of 0-based row `row`. */
export function rowLabel(system: LabelSystemId, locale: string, row: number): string {
  const s = LABEL_SYSTEMS[system];
  if (s.algorithm === 'numeric') return formatNumber(locale, row + 1);
  if (s.algorithm === 'alphabetic') return alphabetic(row + 1, s.symbols);
  return fixed(row + 1, s.symbols) ?? formatNumber(locale, row + 1);
}

export function colLabel(locale: string, col: number): string {
  return formatNumber(locale, col + 1);
}

/** The numbering system Intl uses for `locale` (e.g. "latn", "arab", "hanidec"). */
export function numberingSystemOf(locale: string): string {
  return new Intl.NumberFormat(locale).resolvedOptions().numberingSystem;
}
