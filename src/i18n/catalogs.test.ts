import { describe, expect, it } from 'vitest';
import { catalogProblems, messageVariables } from './catalog-tools.ts';
import { CATALOG_IDS } from './locales.ts';
import { TEST_CATALOGS, strictTranslator } from './test-helpers.ts';
import type { MessageKey } from './messages.ts';

const en = TEST_CATALOGS.en;
const BIDI_CONTROLS = /[\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/u;

describe.each(CATALOG_IDS)('catalog %s', (id) => {
  const catalog = TEST_CATALOGS[id];

  it('has exactly the source keys, every message parses, and uses the same variables as en', () => {
    expect(catalogProblems(en, catalog)).toEqual([]);
  });

  it('formats every message without errors', () => {
    const t = strictTranslator(id);
    for (const key of Object.keys(en) as MessageKey[]) {
      const values = Object.fromEntries(messageVariables(en[key] ?? '').map((v) => [v, 3]));
      expect(() => t.format(key, values)).not.toThrow();
    }
  });

  if (TEST_CATALOGS[id] !== TEST_CATALOGS['ar-XB']) {
    it('is NFC and has no literal bidi controls (isolation is the formatter’s job)', () => {
      for (const [key, message] of Object.entries(catalog)) {
        const text = typeof message === 'string' ? message : message.join('\n');
        expect(text.normalize('NFC'), key).toBe(text);
        expect(BIDI_CONTROLS.test(text), key).toBe(false);
      }
    });
  }
});

describe('messageVariables', () => {
  it('finds placeholders, selectors and option values, but not .local names', () => {
    expect(messageVariables('Hello {$name}')).toEqual(['name']);
    expect(messageVariables('.input {$n :number} .local $x = {$n :integer} .match $x one {{{$who}}} * {{{$x} {$n}}}')).toEqual([
      'n',
      'who',
    ]);
    expect(messageVariables('{$amount :number minimumFractionDigits=$digits}')).toEqual(['amount', 'digits']);
  });
});
