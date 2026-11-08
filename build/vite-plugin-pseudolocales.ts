import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { pseudolocalizeCatalog, type PseudoKind } from '../src/i18n/pseudo.ts';
import type { Catalog } from '../src/i18n/messages.ts';

const PREFIX = 'virtual:pseudo-catalog/';
const RESOLVED = '\0' + PREFIX;
const KINDS: Readonly<Record<string, PseudoKind>> = { 'en-XA': 'accent', 'ar-XB': 'bidi' };
const SOURCE = fileURLToPath(new URL('../src/i18n/catalogs/en.json', import.meta.url));

/**
 * Serves `virtual:pseudo-catalog/en-XA` and `virtual:pseudo-catalog/ar-XB`,
 * generated from en.json on every build (and on every change in dev).
 */
export function pseudolocales(): Plugin {
  return {
    name: 'battlestrip:pseudolocales',
    resolveId(id) {
      return id.startsWith(PREFIX) ? RESOLVED + id.slice(PREFIX.length) : undefined;
    },
    async load(id) {
      if (!id.startsWith(RESOLVED)) return undefined;
      const tag = id.slice(RESOLVED.length);
      const kind = KINDS[tag];
      if (kind === undefined) {
        this.error(`No pseudolocale "${tag}"`);
      }
      this.addWatchFile(SOURCE);
      const source = JSON.parse(await readFile(SOURCE, 'utf8')) as Catalog;
      return `export default ${JSON.stringify(pseudolocalizeCatalog(source, kind))};`;
    },
  };
}
