import { CATALOGS, SOURCE_CATALOG, type CatalogId, type CatalogInfo } from './locales.ts';

export interface NegotiatedLocale {
  /** Which message catalog to load. */
  readonly catalog: CatalogId;
  /**
   * The BCP 47 tag for `Intl.*` and MessageFormat. Keeps the user's region and
   * `-u-` extensions (`-u-nu-`, `-u-ca-`, …) and always carries the catalog's
   * script when the catalog id names one (`zh-TW` → `zh-Hant-TW`).
   */
  readonly locale: string;
}

/** Canonicalise one tag, or `undefined` if it is not well-formed BCP 47. */
export function canonicalize(tag: string): string | undefined {
  try {
    return Intl.getCanonicalLocales(tag)[0];
  } catch {
    return undefined;
  }
}

interface Parsed {
  readonly tag: string;
  readonly loc: Intl.Locale;
  readonly max: Intl.Locale;
}

function parse(tag: string): Parsed | undefined {
  const canonical = canonicalize(tag);
  if (canonical === undefined) return undefined;
  const loc = new Intl.Locale(canonical);
  // Newer engines report `und` as an undefined language.
  if (!loc.language || loc.language === 'und') return undefined;
  return { tag: canonical, loc, max: loc.maximize() };
}

/** Pseudolocales match only when asked for by region (en-XA, ar-XB). */
function pseudoMatches(req: Parsed, cat: Parsed): boolean {
  return req.loc.language === cat.loc.language && req.loc.region === cat.loc.region;
}

function withCatalogScript(req: Parsed, cat: Parsed): string {
  // Only add a script if the catalog id spells one out (zh-Hant, mn-Mong).
  const script = cat.loc.script;
  if (script === undefined) return req.tag;
  return new Intl.Locale(req.tag, { script }).toString();
}

/**
 * Pick a catalog for an ordered list of requested tags (e.g.
 * `navigator.languages`, with an explicit choice first).
 *
 * 1. The first requested tag whose maximised language *and script* match a
 *    catalog wins. Script matters: zh-Hans and zh-Hant are different writing
 *    systems, so `[zh-CN, en]` gives `en`.
 * 2. Otherwise, the first requested tag whose language alone matches
 *    (`[zh-CN]` alone gives `zh-Hant`, formatted as `zh-Hant-CN`).
 * 3. Otherwise the source catalog.
 *
 * Pseudolocales are only ever matched by language and region.
 */
export function negotiateLocale(
  requested: readonly string[],
  catalogs: readonly CatalogInfo[] = CATALOGS,
  fallback: CatalogId = SOURCE_CATALOG,
): NegotiatedLocale {
  const reqs = requested.map(parse).filter((p): p is Parsed => p !== undefined);
  const cats = catalogs.map((c) => ({ info: c, parsed: parse(c.id) }));

  for (const req of reqs) {
    // A pseudolocale request (en-XA) would otherwise match its base language.
    for (const { info, parsed } of cats) {
      if (parsed && info.pseudo !== false && pseudoMatches(req, parsed)) return { catalog: info.id, locale: req.tag };
    }
    for (const { info, parsed } of cats) {
      if (!parsed || info.pseudo !== false) continue;
      if (req.max.language === parsed.max.language && req.max.script === parsed.max.script) {
        return { catalog: info.id, locale: withCatalogScript(req, parsed) };
      }
    }
  }

  for (const req of reqs) {
    for (const { info, parsed } of cats) {
      if (!parsed || info.pseudo !== false) continue;
      if (req.max.language === parsed.max.language) {
        const script = parsed.max.script;
        const locale =
          script === undefined ? req.tag : new Intl.Locale(req.tag, { script }).toString();
        return { catalog: info.id, locale };
      }
    }
  }

  return { catalog: fallback, locale: fallback };
}

/** The tag for an HTML `lang` attribute: the base name, without `-u-` extensions. */
export function htmlLang(locale: string): string {
  try {
    return new Intl.Locale(locale).baseName;
  } catch {
    return locale;
  }
}
