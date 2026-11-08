import ar from './catalogs/ar.json' with { type: 'json' };
import en from './catalogs/en.json' with { type: 'json' };
import zhHant from './catalogs/zh-Hant.json' with { type: 'json' };
import type { CatalogId } from './locales.ts';
import { createTranslator, type Catalog, type Translator } from './messages.ts';
import { pseudolocalizeCatalog } from './pseudo.ts';

/** Every catalog, loaded synchronously for tests (pseudolocales generated the same way the build does). */
export const TEST_CATALOGS: Readonly<Record<CatalogId, Catalog>> = {
  en,
  ar,
  'zh-Hant': zhHant,
  'en-XA': pseudolocalizeCatalog(en, 'accent'),
  'ar-XB': pseudolocalizeCatalog(en, 'bidi'),
};

/** A translator that throws on any formatting error. */
export function strictTranslator(catalog: CatalogId, locale: string = catalog): Translator {
  return createTranslator({
    catalog,
    locale,
    messages: TEST_CATALOGS[catalog],
    onError: (e) => {
      throw e instanceof Error ? e : new Error(String(e));
    },
  });
}

/** Strip bidi isolation and override controls, for comparing visible text. */
export function stripBidi(text: string): string {
  return text.replaceAll(/[\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/gu, '');
}
