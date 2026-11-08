import { pickVoice } from './voice.ts';

export interface Speaker {
  /** True once a voice for the locale is known to exist. */
  readonly available: () => boolean;
  speak(lines: readonly string[]): void;
  cancel(): void;
}

/**
 * Spoken callouts with speechSynthesis. Picks a voice by BCP 47 lookup and
 * stays silent if none matches: it never reads text with a voice for another
 * language.
 */
export function createSpeaker(locale: string, onUnavailable: () => void): Speaker {
  const synth = typeof speechSynthesis === 'undefined' ? undefined : speechSynthesis;
  let voice: SpeechSynthesisVoice | undefined;
  let warned = false;
  const refresh = (): void => {
    voice = synth ? pickVoice(synth.getVoices(), locale) : undefined;
  };
  refresh();
  synth?.addEventListener('voiceschanged', refresh);
  return {
    available: () => voice !== undefined,
    speak(lines) {
      if (!synth) return;
      if (!voice) refresh();
      if (!voice) {
        if (!warned) onUnavailable();
        warned = true;
        return;
      }
      for (const text of lines) {
        const u = new SpeechSynthesisUtterance(text);
        u.voice = voice;
        u.lang = voice.lang;
        synth.speak(u);
      }
    },
    cancel() {
      synth?.cancel();
    },
  };
}
