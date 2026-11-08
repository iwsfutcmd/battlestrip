import { describe, expect, it } from 'vitest';
import { pickVoice } from './voice.ts';

const voices = [
  { lang: 'en-US', name: 'US' },
  { lang: 'en-GB', name: 'GB', localService: true },
  { lang: 'ar-SA', name: 'Arabic' },
  { lang: 'zh-CN', name: 'Mandarin (Simplified)' },
  { lang: 'zh-TW', name: 'Mandarin (Taiwan)' },
  { lang: 'yue_HK', name: 'Cantonese' },
];

describe('pickVoice', () => {
  it('prefers the same region', () => {
    expect(pickVoice(voices, 'en-GB')?.name).toBe('GB');
    expect(pickVoice(voices, 'en-US')?.name).toBe('US');
  });
  it('accepts another region of the same language and script', () => {
    expect(pickVoice(voices, 'ar-EG')?.name).toBe('Arabic');
    expect(pickVoice(voices, 'en-AU')?.name).toBe('GB');
  });
  it('matches script: zh-Hant gets the Taiwan voice, never the Simplified one', () => {
    expect(pickVoice(voices, 'zh-Hant')?.name).toBe('Mandarin (Taiwan)');
    expect(pickVoice([{ lang: 'zh-CN', name: 'Simplified' }], 'zh-Hant')).toBeUndefined();
  });
  it('never reads with a voice for another language', () => {
    expect(pickVoice(voices, 'he')).toBeUndefined();
    expect(pickVoice(voices, 'en-XA')?.lang).toMatch(/^en/u);
    expect(pickVoice(voices, 'ar-XB')?.name).toBe('Arabic');
  });
});
