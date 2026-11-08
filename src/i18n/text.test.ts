import { describe, expect, it } from 'vitest';
import { cleanName, graphemes, sameName } from './text.ts';

describe('names', () => {
  it('counts a ZWJ emoji sequence as one grapheme', () => {
    expect(graphemes('👩🏽‍🚀 Ada')).toHaveLength(5);
  });
  it('normalises to NFC and caps at 24 graphemes', () => {
    expect(cleanName('Ngugẽ')).toBe('Ngugẽ'.normalize('NFC'));
    expect(graphemes(cleanName('👩🏽‍🚀'.repeat(30)))).toHaveLength(24);
  });
  it('spots duplicates at the base level', () => {
    expect(sameName('Ngũgĩ', 'ngugi', 'en')).toBe(true);
    expect(sameName('לינה', 'לינה ', 'he')).toBe(true);
    expect(sameName('Bo', 'Bob', 'en')).toBe(false);
  });
});
