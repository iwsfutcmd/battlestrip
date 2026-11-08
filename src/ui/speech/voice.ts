/** The minimum of SpeechSynthesisVoice this module needs (so it can be tested without a browser). */
export interface VoiceLike {
  readonly lang: string;
  readonly name: string;
  readonly default?: boolean;
  readonly localService?: boolean;
}

function parse(tag: string): Intl.Locale | undefined {
  try {
    return new Intl.Locale(tag.replaceAll('_', '-'));
  } catch {
    return undefined;
  }
}

/**
 * The best voice for `locale`, by BCP 47 lookup. A voice must share the
 * maximised language *and script*; region is a preference. Never returns a
 * voice for another language: a wrong-language voice mangles every word.
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], locale: string): V | undefined {
  const want = parse(locale);
  if (!want) return undefined;
  const wantMax = want.maximize();
  let best: { voice: V; score: number } | undefined;
  for (const voice of voices) {
    const got = parse(voice.lang);
    if (!got) continue;
    const gotMax = got.maximize();
    if (gotMax.language !== wantMax.language || gotMax.script !== wantMax.script) continue;
    let score = 1;
    if (gotMax.region === wantMax.region) score += 4;
    if (voice.localService) score += 1;
    if (voice.default) score += 0.5;
    if (!best || score > best.score) best = { voice, score };
  }
  return best?.voice;
}
