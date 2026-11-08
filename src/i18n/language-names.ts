import { canonicalize } from './negotiate.ts';

/**
 * A language's name for itself ("العربية", "繁體中文"), for language pickers.
 * Never a flag: flags name countries, not languages.
 */
export function autonym(tag: string): string {
  const canonical = canonicalize(tag) ?? tag;
  try {
    return new Intl.DisplayNames([canonical], { type: 'language', fallback: 'code' }).of(canonical) ?? canonical;
  } catch {
    return canonical;
  }
}
