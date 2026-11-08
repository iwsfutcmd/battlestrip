import { describe, expect, it } from 'vitest';
import { CATALOG_IDS } from './locales.ts';
import { loadCatalog } from './load.ts';
import en from './catalogs/en.json' with { type: 'json' };

describe('loadCatalog (through the Vite plugin)', () => {
  it.each(CATALOG_IDS)('%s has every source key', async (id) => {
    const catalog = await loadCatalog(id);
    expect(Object.keys(catalog).sort()).toEqual(Object.keys(en).sort());
  });
});
