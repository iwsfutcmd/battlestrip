import type { CatalogId } from './locales.ts';
import type { Catalog } from './messages.ts';

/**
 * Lazy catalog loaders, one chunk per catalog. Pseudolocales come from a
 * build-time Vite plugin, so they never drift from `en.json`.
 */
const LOADERS: Readonly<Record<CatalogId, () => Promise<Catalog>>> = {
  en: () => import('./catalogs/en.json').then((m) => m.default),
  ar: () => import('./catalogs/ar.json').then((m) => m.default),
  'zh-Hant': () => import('./catalogs/zh-Hant.json').then((m) => m.default),
  'en-XA': () => import('virtual:pseudo-catalog/en-XA').then((m) => m.default),
  'ar-XB': () => import('virtual:pseudo-catalog/ar-XB').then((m) => m.default),
};

export function loadCatalog(id: CatalogId): Promise<Catalog> {
  return LOADERS[id]();
}
