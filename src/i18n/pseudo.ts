import { stringifyMessage, type Model } from 'messageformat';
import { parseSource } from './catalog-tools.ts';
import type { Catalog, MessageSource } from './messages.ts';

/**
 * Pseudolocales, generated from the source catalog at build time
 * (see build/vite-plugin-pseudolocales.ts). Only the literal text of each
 * pattern changes; declarations, selectors, placeholders and markup are
 * untouched, so every pseudo message keeps the source's variables.
 *
 * - `accent` (en-XA): accented letters, bracketed, about 35% longer.
 *   Catches hard-coded strings, truncation and fixed widths.
 * - `bidi` (ar-XB): every word wrapped in RLM RLO … PDF RLM, so Latin text is
 *   drawn reversed in an RTL layout. Catches physical CSS and mirroring bugs.
 */
export type PseudoKind = 'accent' | 'bidi';

const ACCENTS: Readonly<Record<string, string>> = Object.fromEntries(
  [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'].map((c, i) => [
    c,
    [...'ÅƁÇÐÉƑĜĤÎĴĶĻṀÑÖÞǪŔŠŢÛṼŴẊÝŽåƀçðéƒĝĥîĵķļṁñöþǫŕšţûṽŵẋýž'][i] ?? c,
  ]),
);

const PADDING = 'ŏñé ţŵö ţĥŕéé ƒöûŕ ƒîṽé šîẋ šéṽéñ éîĝĥţ ñîñé ţéñ éļéṽéñ ţŵéļṽé ';
export const EXPANSION = 0.35;

function accentText(text: string): string {
  let out = '';
  for (const ch of text) out += ACCENTS[ch] ?? ch;
  return out;
}

const RLM = '\u200F';
const RLO = '\u202E';
const PDF = '\u202C';

function bidiText(text: string): string {
  return text.replaceAll(/\S+/gu, (word) => RLM + RLO + word + PDF + RLM);
}

function codePointCount(text: string): number {
  return Array.from(text).length;
}

function padding(extra: number): string {
  if (extra <= 0) return '';
  let pad = '';
  while (codePointCount(pad) < extra) pad += PADDING;
  return ' ' + [...pad].slice(0, extra).join('').trimEnd();
}

function transformPattern(pattern: Model.Pattern, kind: PseudoKind): Model.Pattern {
  if (kind === 'bidi') return pattern.map((el) => (typeof el === 'string' ? bidiText(el) : el));

  const textLength = pattern.reduce((n, el) => n + (typeof el === 'string' ? codePointCount(el) : 0), 0);
  const out: Model.Pattern = pattern.map((el) => (typeof el === 'string' ? accentText(el) : el));
  const pad = padding(Math.ceil(textLength * EXPANSION));
  const first = out[0];
  if (typeof first === 'string') out[0] = '[' + first;
  else out.unshift('[');
  const lastIndex = out.length - 1;
  const last = out[lastIndex];
  if (typeof last === 'string') out[lastIndex] = last + pad + ']';
  else out.push(pad + ']');
  return out;
}

export function pseudolocalizeMessage(source: MessageSource, kind: PseudoKind): string {
  const msg = parseSource(source);
  const transformed: Model.Message =
    msg.type === 'message'
      ? { ...msg, pattern: transformPattern(msg.pattern, kind) }
      : { ...msg, variants: msg.variants.map((v) => ({ ...v, value: transformPattern(v.value, kind) })) };
  return stringifyMessage(transformed);
}

export function pseudolocalizeCatalog(source: Catalog, kind: PseudoKind): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(source)) out[key] = pseudolocalizeMessage(message, kind);
  return out;
}
