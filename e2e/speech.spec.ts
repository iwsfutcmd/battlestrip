import { expect, test } from '@playwright/test';
import { deal, handOut } from './table.ts';

const strip = (s: string): string => s.replaceAll(/[\u2066-\u2069]/gu, '');

/** A stand-in speechSynthesis with one English voice, recording what it's asked to say. */
function fakeSpeech(): void {
  const spoken: string[] = [];
  (window as unknown as { spoken: string[] }).spoken = spoken;
  const voice = { lang: 'en-US', name: 'Fake', voiceURI: 'fake', localService: true, default: true };
  class Utterance {
    text: string;
    voice: unknown = null;
    lang = '';
    constructor(text: string) {
      this.text = text;
    }
  }
  (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = Utterance;
  Object.defineProperty(window, 'speechSynthesis', {
    value: { getVoices: () => [voice], speak: (u: Utterance) => spoken.push(u.text), cancel: () => undefined, addEventListener: () => undefined },
    configurable: true,
  });
}

for (const beat of [0, 1]) {
  test(`read aloud: the square, then its results (pause ${beat} s)`, async ({ page, browser }) => {
    await page.addInitScript(fakeSpeech);
    await deal(page, { lang: 'en', names: ['Amani', 'Bo'], speech: true, beat });
    await handOut(page, browser);
    await page.locator('.handout-done button.primary').click();
    await page.locator('.tv [data-cell="2-3"]').dblclick();
    await expect
      .poll(async () => (await page.evaluate(() => (window as unknown as { spoken: string[] }).spoken)).length, { timeout: 5000 })
      .toBeGreaterThanOrEqual(2);
    const spoken = (await page.evaluate(() => (window as unknown as { spoken: string[] }).spoken)).map(strip);
    expect(spoken[0]).toBe('C 4');
    expect(spoken.slice(1).join(' ')).toMatch(/No hits\.|Hit: /u);
  });
}
