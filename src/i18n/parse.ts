import { LABEL_SYSTEMS, alphabetic, type LabelSystemId } from './labels.ts';

/** Message keys for parse errors (never strings). */
export type ParseErrorKey = 'parse.empty' | 'parse.unrecognised' | 'parse.outOfRange' | 'parse.ambiguous';

export type ParseResult =
  | { readonly ok: true; readonly value: { readonly row: number; readonly col: number } }
  | { readonly ok: false; readonly error: ParseErrorKey };

export interface ParseContext {
  readonly rows: number;
  readonly cols: number;
  /** Active row systems, primary first (already fitted to the board with systemForRows). */
  readonly systems: readonly LabelSystemId[];
}

const ND = /\p{Nd}/u;

/**
 * The value of a decimal digit in any script. Unicode assigns decimal digits
 * only in contiguous ascending 0–9 runs, so a digit's value is its distance
 * from the start of its maximal \p{Nd} run, mod 10. (Mathematical digits come
 * in runs of 50; the mod handles that.)
 */
export function digitValue(ch: string): number | undefined {
  const cp = ch.codePointAt(0);
  if (cp === undefined || !ND.test(ch)) return undefined;
  let start = cp;
  while (start > 0 && ND.test(String.fromCodePoint(start - 1))) start--;
  return (cp - start) % 10;
}

/** Han positional digits (-u-nu-hanidec) are letters in Unicode, so map them explicitly. */
const HANIDEC = '〇一二三四五六七八九';

/** Latin letters that look like letters of the active script are read as those letters. */
const HOMOGLYPHS: Partial<Record<'Cyrl' | 'Grek', Readonly<Record<string, string>>>> = {
  Cyrl: { a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м', o: 'о', p: 'р', t: 'т', x: 'х', y: 'у' },
  Grek: { a: 'α', b: 'β', e: 'ε', h: 'η', i: 'ι', k: 'κ', m: 'μ', n: 'ν', o: 'ο', p: 'ρ', t: 'τ', x: 'χ', y: 'υ', z: 'ζ' },
};

/** Case-fold (Latin, Greek, Cyrillic) and smooth over keyboard variants of Arabic-script letters. */
function matchKey(s: string): string {
  return s
    .toLocaleLowerCase('und')
    .replaceAll('ـ', '') // tatweel
    .replaceAll(/[أإآٱ]/gu, 'ا')
    .replaceAll('ی', 'ي')
    .replaceAll('ک', 'ك')
    .replace(/^الف$/u, 'ا');
}

type Token = { readonly kind: 'letters'; readonly text: string } | { readonly kind: 'number'; readonly value: number };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let letters = '';
  let digits = '';
  const flush = (): void => {
    if (letters) tokens.push({ kind: 'letters', text: letters });
    if (digits) tokens.push({ kind: 'number', value: Number(digits) });
    letters = '';
    digits = '';
  };
  for (const ch of input) {
    const d = digitValue(ch) ?? (HANIDEC.includes(ch) ? HANIDEC.indexOf(ch) : undefined);
    if (d !== undefined) {
      if (letters) flush();
      digits += String(d);
    } else if (/[\p{L}\p{M}]/u.test(ch)) {
      if (digits) flush();
      letters += ch;
    } else {
      flush(); // spaces and punctuation separate tokens
    }
  }
  flush();
  return tokens;
}

/** 1-based value of `text` in `system`, or undefined. */
function rowValue(system: LabelSystemId, text: string): number | undefined {
  const s = LABEL_SYSTEMS[system];
  if (s.algorithm === 'numeric') return undefined;
  const key = matchKey(text);
  if (s.algorithm === 'fixed') {
    const i = s.symbols.findIndex((sym) => matchKey(sym) === key);
    return i >= 0 ? i + 1 : undefined;
  }
  // alphabetic: bijective base-n
  let value = 0;
  for (const ch of key) {
    const i = s.symbols.findIndex((sym) => matchKey(sym) === ch);
    if (i < 0) return undefined;
    value = value * s.symbols.length + i + 1;
  }
  return value > 0 && alphabetic(value, s.symbols) !== '' ? value : undefined;
}

function lookupRow(ctx: ParseContext, text: string): number | undefined {
  const scripts = ctx.systems.map((id) => LABEL_SYSTEMS[id].script);
  const homoglyphScript = scripts.find((sc): sc is 'Cyrl' | 'Grek' => sc === 'Cyrl' || sc === 'Grek');
  let candidate = text;
  if (homoglyphScript) {
    const map = HOMOGLYPHS[homoglyphScript] ?? {};
    candidate = [...text.toLocaleLowerCase('und')].map((ch) => map[ch] ?? ch).join('');
  }
  for (const id of ctx.systems) {
    const v = rowValue(id, candidate);
    if (v !== undefined) return v;
  }
  // Latin is always accepted as a fallback, except under Cyrillic or Greek,
  // where Latin letters are homoglyphs of the native ones (handled above).
  if (!homoglyphScript && !ctx.systems.includes('latin')) return rowValue('latin', text);
  return undefined;
}

/** Parse a typed call such as "D4", "4d", "Ｄ７", "د٤", "甲7", "к 10" or "4-7" (numeric rows). */
export function parseCoord(input: string, ctx: ParseContext): ParseResult {
  const text = input.normalize('NFKC').trim();
  if (text === '') return { ok: false, error: 'parse.empty' };
  const tokens = tokenize(text);
  const numericRows = ctx.systems.includes('numeric');
  let row: number | undefined;
  let col: number | undefined;

  const [a, b, extra] = tokens;
  if (extra || !a) return { ok: false, error: 'parse.unrecognised' };
  if (!b) {
    if (a.kind === 'number' && numericRows) return { ok: false, error: 'parse.ambiguous' };
    return { ok: false, error: 'parse.unrecognised' };
  }
  if (a.kind === 'letters' && b.kind === 'number') {
    row = lookupRow(ctx, a.text);
    col = b.value;
  } else if (a.kind === 'number' && b.kind === 'letters') {
    row = lookupRow(ctx, b.text);
    col = a.value;
  } else if (a.kind === 'number' && b.kind === 'number' && numericRows) {
    row = a.value;
    col = b.value;
  }
  if (row === undefined || col === undefined) return { ok: false, error: 'parse.unrecognised' };
  if (row < 1 || col < 1 || row > ctx.rows || col > ctx.cols) return { ok: false, error: 'parse.outOfRange' };
  return { ok: true, value: { row: row - 1, col: col - 1 } };
}
