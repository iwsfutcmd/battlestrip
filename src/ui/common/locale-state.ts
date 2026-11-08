import { signal } from '@preact/signals';
import {
  createTranslator,
  htmlLang,
  negotiateLocale,
  type MessageKey,
  type Translator,
} from '../../i18n/index.ts';
import { loadCatalog } from '../../i18n/load.ts';

/** The page's active translator; `null` until the first catalog has loaded. */
export const translator = signal<Translator | null>(null);

let generation = 0;

/**
 * Negotiate a catalog for `requested`, load it, and make it the page's
 * language: sets `lang` and `dir` on `<html>` and localises `document.title`.
 */
export async function activateLocale(requested: readonly string[], titleKey: MessageKey): Promise<Translator | undefined> {
  const mine = ++generation;
  const { catalog, locale } = negotiateLocale(requested);
  const messages = await loadCatalog(catalog);
  if (mine !== generation) return undefined; // a later switch won the race
  const t = createTranslator({ catalog, locale, messages });
  const root = document.documentElement;
  root.lang = htmlLang(locale);
  root.dir = t.dir;
  document.title = t.format(titleKey);
  translator.value = t;
  return t;
}

export function useTranslator(): Translator {
  const t = translator.value;
  if (!t) throw new Error('useTranslator() before a catalog loaded');
  return t;
}

/**
 * The requested locales for this page: an explicit `?lang=` first (used by the
 * control panel to hand the game language to the display, and by tests),
 * then the browser's preferences.
 */
export function requestedLocales(search: string, languages: readonly string[]): string[] {
  const override = new URLSearchParams(search).get('lang');
  return override ? [override, ...languages] : [...languages];
}
