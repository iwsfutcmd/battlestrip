import { describe, expect, it } from 'vitest';
import { messageVariables } from './catalog-tools.ts';
import { messageSource } from './messages.ts';
import { EXPANSION, pseudolocalizeMessage } from './pseudo.ts';
import { TEST_CATALOGS, strictTranslator, stripBidi } from './test-helpers.ts';

describe('en-XA (accented, longer)', () => {
  it('brackets, accents and lengthens every message, keeping its variables', () => {
    for (const [key, source] of Object.entries(TEST_CATALOGS.en)) {
      const pseudo = pseudolocalizeMessage(source, 'accent');
      expect(messageVariables(pseudo), key).toEqual(messageVariables(source));
    }
    const t = strictTranslator('en-XA');
    const title = t.format('app.tagline');
    expect(title.startsWith('[')).toBe(true);
    expect(title.endsWith(']')).toBe(true);
    expect(title).not.toMatch(/[A-Za-z]/u);
    const sourceLength = Array.from(messageSource(TEST_CATALOGS.en['app.tagline'] ?? '')).length;
    expect(Array.from(title).length).toBeGreaterThanOrEqual(Math.ceil(sourceLength * (1 + EXPANSION)));
  });

  it('keeps plural selection working', () => {
    const t = strictTranslator('en-XA');
    expect(t.format('hello.playerCount', { count: 1 })).not.toBe(t.format('hello.playerCount', { count: 2 }));
    expect(t.format('hello.playerCount', { count: 1 })).toMatch(/^\[1 þļåýéŕ/u);
  });

  it('leaves placeholder values untouched', () => {
    expect(stripBidi(strictTranslator('en-XA').format('roster.calling', { name: 'Ada' }))).toMatch(/^\[Ada îš çåļļîñĝ/u);
  });

  it('only uses NFC, single-code-point accented letters', () => {
    const accented = pseudolocalizeMessage('ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz', 'accent');
    expect(accented.normalize('NFC')).toBe(accented);
    expect(accented).not.toMatch(/[A-Za-z]/u);
    expect(Array.from(accented.slice(1, 27))).toHaveLength(26);
  });
});

describe('ar-XB (force-reversed RTL)', () => {
  it('wraps every word in RLM RLO … PDF RLM and keeps placeholders outside the override', () => {
    const out = strictTranslator('ar-XB').format('roster.calling', { name: 'Ada' });
    expect(out).toContain('\u200F\u202Eis\u202C\u200F');
    expect(out).toContain('\u2068Ada\u2069');
    expect(strictTranslator('ar-XB').dir).toBe('rtl');
  });
});
