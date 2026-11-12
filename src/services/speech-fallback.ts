export type SpeechSource = "static" | "cache" | "bhashini" | "browser";

export async function playWithSpeechFallbacks<T>({
  getStatic,
  getCached,
  getBhashini,
  play,
  speakWithBrowserVoice,
  onSourceError,
}: {
  getStatic: () => Promise<T | null>;
  getCached: () => Promise<T | null>;
  getBhashini: () => Promise<T | null>;
  play: (audio: T, source: Exclude<SpeechSource, "browser">) => Promise<boolean>;
  speakWithBrowserVoice: () => void | Promise<void>;
  onSourceError: (source: Exclude<SpeechSource, "browser">, error: unknown) => void;
}): Promise<SpeechSource> {
  const sources = [
    ["static", getStatic],
    ["cache", getCached],
    ["bhashini", getBhashini],
  ] as const;

  for (const [source, getAudio] of sources) {
    let audio: T | null;
    try {
      audio = await getAudio();
    } catch (error) {
      onSourceError(source, error);
      continue;
    }
    if (audio === null) continue;

    try {
      if (await play(audio, source)) return source;
    } catch (error) {
      onSourceError(source, error);
    }
  }

  await speakWithBrowserVoice();
  return "browser";
}
