import { MessageFormat, type MessagePart } from 'messageformat';
import { directionOf, type Direction } from './direction.ts';
import type { CatalogId } from './locales.ts';

/**
 * Catalogs are JSON objects mapping a key to an MF2 message. A message may be
 * one string or an array of lines (joined with "\n"), so that `.match`
 * messages stay readable.
 */
export type MessageSource = string | readonly string[];
export type Catalog = Readonly<Record<string, MessageSource>>;

/** Every key in the source catalog. Other catalogs must have exactly these. */
export type MessageKey = Extract<keyof typeof import('./catalogs/en.json'), string>;

export type MessageValues = Readonly<Record<string, unknown>>;
export type Part = MessagePart<string>;

export function messageSource(source: MessageSource): string {
  return typeof source === 'string' ? source : source.join('\n');
}

export interface Translator {
  readonly catalog: CatalogId;
  /** BCP 47 tag used for all formatting. */
  readonly locale: string;
  readonly dir: Direction;
  /** A plain string; placeholders are bidi-isolated with FSI/LRI/RLI…PDI. */
  format(key: MessageKey, values?: MessageValues): string;
  /** Parts, for rendering as markup (placeholders become `<bdi>`). */
  formatToParts(key: MessageKey, values?: MessageValues): readonly Part[];
}

export interface TranslatorOptions {
  readonly catalog: CatalogId;
  readonly locale: string;
  readonly messages: Catalog;
  /** Used for keys missing from `messages` (should not happen; parity is tested). */
  readonly fallback?: { readonly locale: string; readonly messages: Catalog };
  readonly onError?: (error: unknown) => void;
}

const defaultOnError = (error: unknown): void => {
  console.warn(error);
};

export function createTranslator(options: TranslatorOptions): Translator {
  const { catalog, locale, messages, fallback } = options;
  const onError = options.onError ?? defaultOnError;
  const dir = directionOf(locale);
  const cache: Partial<Record<string, MessageFormat<string>>> = {};

  const formatterFor = (key: string): MessageFormat<string> => {
    const hit = cache[key];
    if (hit) return hit;
    let mf: MessageFormat<string>;
    const own = messages[key];
    if (own !== undefined) {
      mf = new MessageFormat<string>([locale], messageSource(own), { bidiIsolation: 'default', dir });
    } else if (fallback?.messages[key] !== undefined) {
      onError(new Error(`Missing message "${key}" in ${catalog}`));
      const fb = fallback.messages[key];
      mf = new MessageFormat<string>([fallback.locale], messageSource(fb), {
        bidiIsolation: 'default',
        dir: directionOf(fallback.locale),
      });
    } else {
      onError(new Error(`Unknown message "${key}"`));
      // `{|…|}` is an MF2 literal: renders the key itself, isolated.
      mf = new MessageFormat<string>([locale], `{|${key.replaceAll(/[\\|]/gu, '\\$&')}|}`, {
        bidiIsolation: 'default',
        dir,
      });
    }
    cache[key] = mf;
    return mf;
  };

  return {
    catalog,
    locale,
    dir,
    format: (key, values) => formatterFor(key).format(values, onError),
    formatToParts: (key, values) => formatterFor(key).formatToParts(values, onError),
  };
}

/** A run of formatted text: either plain, or a bidi-isolated placeholder. */
export type Segment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'isolate'; readonly dir: 'auto' | 'ltr' | 'rtl'; readonly text: string };

/** The fields this module reads from any formatted part. */
interface LoosePart {
  readonly type: string;
  readonly value?: unknown;
  readonly source?: unknown;
  readonly parts?: readonly { readonly value?: unknown }[];
}

function scalarText(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint' ? String(v) : '';
}

function partText(part: LoosePart): string {
  switch (part.type) {
    case 'markup':
    case 'bidiIsolation':
      return '';
    case 'fallback':
      return typeof part.source === 'string' ? `{${part.source}}` : '\uFFFD';
    default:
      // text, string, number and custom parts: sub-parts win (numbers), else the value.
      return part.parts ? part.parts.map((p) => scalarText(p.value)).join('') : scalarText(part.value);
  }
}

const ISOLATE_DIR: Readonly<Record<string, 'auto' | 'ltr' | 'rtl'>> = {
  '\u2068': 'auto',
  '\u2066': 'ltr',
  '\u2067': 'rtl',
};

/**
 * Turn MF2 parts into segments for markup: the isolation control characters
 * are dropped and what they enclosed becomes an `isolate` segment, which the
 * UI renders as `<bdi>`.
 */
export function toSegments(parts: readonly Part[]): Segment[] {
  const out: Segment[] = [];
  let open: { dir: 'auto' | 'ltr' | 'rtl'; text: string } | undefined;
  const pushText = (text: string): void => {
    if (text === '') return;
    if (open) {
      open.text += text;
      return;
    }
    const last = out.at(-1);
    if (last?.kind === 'text') out[out.length - 1] = { kind: 'text', text: last.text + text };
    else out.push({ kind: 'text', text });
  };
  for (const part of parts as readonly LoosePart[]) {
    if (part.type === 'bidiIsolation') {
      const opening = typeof part.value === 'string' ? ISOLATE_DIR[part.value] : undefined;
      if (opening) {
        open = { dir: opening, text: '' };
      } else {
        if (open) out.push({ kind: 'isolate', dir: open.dir, text: open.text });
        open = undefined;
      }
      continue;
    }
    pushText(partText(part));
  }
  if (open) out.push({ kind: 'isolate', dir: open.dir, text: open.text });
  return out;
}
