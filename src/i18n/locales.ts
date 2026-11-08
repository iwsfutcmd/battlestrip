/**
 * The catalogs this build ships.
 *
 * A *catalog id* names a message catalog. It is not necessarily the locale
 * used for formatting: a player on `zh-TW` reads the `zh-Hant` catalog but
 * gets Taiwanese formatting, and `ar-u-nu-latn` keeps its Latin digits.
 * See `negotiate.ts`.
 */
export const CATALOG_IDS = ['en', 'ar', 'zh-Hant', 'en-XA', 'ar-XB'] as const;
export type CatalogId = (typeof CATALOG_IDS)[number];

export interface CatalogInfo {
  readonly id: CatalogId;
  /** Pseudolocales are generated from `en` at build time and never negotiated fuzzily. */
  readonly pseudo: 'accent' | 'bidi' | false;
  /** True for drafts that a native speaker has not reviewed yet. */
  readonly needsNativeReview: boolean;
}

export const CATALOGS: readonly CatalogInfo[] = [
  { id: 'en', pseudo: false, needsNativeReview: false },
  { id: 'ar', pseudo: false, needsNativeReview: true },
  { id: 'zh-Hant', pseudo: false, needsNativeReview: true },
  { id: 'en-XA', pseudo: 'accent', needsNativeReview: false },
  { id: 'ar-XB', pseudo: 'bidi', needsNativeReview: false },
];

export const SOURCE_CATALOG: CatalogId = 'en';

export function isCatalogId(value: string): value is CatalogId {
  return (CATALOG_IDS as readonly string[]).includes(value);
}

export function catalogInfo(id: CatalogId): CatalogInfo {
  const info = CATALOGS.find((c) => c.id === id);
  if (!info) throw new Error(`Unknown catalog ${id}`);
  return info;
}
