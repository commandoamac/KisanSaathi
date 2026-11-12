import { useEffect, useRef, useState } from "react";
import { LANGUAGE_LOCALES, type LangCode } from "@/i18n/translations";
import { reportVoiceProvider } from "@/lib/voice-provider-debug";
import {
  cacheTtsAudio,
  createTtsAudioCacheKey,
  deleteCachedTtsAudio,
  getCachedTtsAudio,
} from "@/services/tts-audio-cache";
import { findStaticTtsUrl, type SpokenLineId } from "@/services/static-tts";
import { playWithSpeechFallbacks } from "@/services/speech-fallback";

const BHASHINI_CACHE_VOICE = "bhashini-female-v1";

/** Browser speech only; no voice data leaves the device through this app. */
export function getSpeechLocale(lang: LangCode) {
  return LANGUAGE_LOCALES[lang];
}

export function findSpeechVoice(voices: SpeechSynthesisVoice[], lang: LangCode) {
  return voices.find((voice) => {
    const voiceLang = voice.lang.toLowerCase();
    return voiceLang === lang || voiceLang.startsWith(`${lang}-`);
  });
}

export function useCardSpeech(lang: LangCode) {
  const [apiSupported, setApiSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [reading, setReading] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const current = useRef<SpeechSynthesisUtterance | null>(null);
  const currentAudio = useRef<HTMLAudioElement | null>(null);
  const activeCall = useRef(0);
  const voice = findSpeechVoice(voices, lang);

  useEffect(() => {
    const available = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
    setApiSupported(available);
    if (!available) return;

    const synthesis = window.speechSynthesis;
    const updateVoices = () => setVoices(synthesis.getVoices());
    updateVoices();
    synthesis.addEventListener("voiceschanged", updateVoices);
    return () => {
      synthesis.removeEventListener("voiceschanged", updateVoices);
      current.current = null;
      currentAudio.current?.pause();
      synthesis.cancel();
    };
  }, []);

  useEffect(() => {
    current.current = null;
    currentAudio.current?.pause();
    currentAudio.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setReading(null);
  }, [lang]);

  function stopCurrentSpeech() {
    activeCall.current += 1;
    current.current = null;
    currentAudio.current?.pause();
    currentAudio.current = null;
    window.speechSynthesis.cancel();
    setReading(null);
  }

  function speakWithBrowser(
    id: string,
    text: string,
    reason: string,
    callId: number,
    speechLanguage: LangCode,
  ): Promise<void> {
    if (!apiSupported) {
      reportVoiceProvider({
        task: "TTS",
        provider: "No provider",
        reason: "browser speech synthesis unavailable",
      });
      setReading(null);
      setFailed(true);
      return Promise.resolve();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getSpeechLocale(speechLanguage);
    utterance.rate = 0.85;
    const speechVoice = findSpeechVoice(voices, speechLanguage);
    if (speechVoice) utterance.voice = speechVoice;
    utterance.onend = () => {
      if (current.current === utterance) setReading(null);
      resolveSpeech();
    };
    utterance.onerror = (event) => {
      if (activeCall.current === callId && current.current === utterance) {
        setReading(null);
        setFailed(true);
        current.current = null;
        reportVoiceProvider({
          task: "TTS",
          provider: "No provider",
          reason: `browser speech failed: ${event.error}`,
        });
      }
      resolveSpeech();
    };
    let resolveSpeech!: () => void;
    const speechComplete = new Promise<void>((resolve) => {
      resolveSpeech = resolve;
    });
    utterance.onstart = () => {
      if (activeCall.current === callId) {
        const voiceReason = speechVoice
          ? reason
          : `${reason}; using browser default voice for ${speechLanguage}`;
        reportVoiceProvider({ task: "TTS", provider: "Browser fallback", reason: voiceReason });
      }
    };
    current.current = utterance;
    setReading(id);
    window.speechSynthesis.speak(utterance);
    return speechComplete;
  }

  async function playAudio(
    blob: Blob,
    callId: number,
    cacheKey: string | null,
    fromCache: boolean,
    source: "static" | "cache" | "bhashini",
  ): Promise<boolean> {
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    currentAudio.current = audio;
    let resolvePlayback: ((played: boolean) => void) | undefined;
    const playback = new Promise<boolean>((resolve) => {
      resolvePlayback = resolve;
    });
    audio.onplay = () => {
      if (activeCall.current === callId) {
        reportVoiceProvider({
          task: "TTS",
          provider:
            source === "static" ? "Static audio" : source === "cache" ? "Cached audio" : "Bhashini",
        });
      }
    };
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      if (activeCall.current === callId) {
        currentAudio.current = null;
        setReading(null);
      }
      resolvePlayback?.(true);
    };
    audio.onpause = () => resolvePlayback?.(false);
    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      if (activeCall.current === callId) {
        currentAudio.current = null;
        if (fromCache && cacheKey) {
          void deleteCachedTtsAudio(cacheKey).catch(() => {
            console.warn("Could not remove invalid cached TTS audio.");
          });
        }
      }
      resolvePlayback?.(false);
    };
    try {
      await audio.play();
      if (activeCall.current !== callId) {
        URL.revokeObjectURL(audioUrl);
        return false;
      }
      if (cacheKey && !fromCache && activeCall.current === callId) {
        try {
          await cacheTtsAudio(cacheKey, blob);
        } catch {
          console.warn("Could not persist TTS audio; playback will continue.");
        }
      }
      return await playback;
    } catch {
      URL.revokeObjectURL(audioUrl);
      if (activeCall.current === callId) {
        currentAudio.current = null;
        if (fromCache && cacheKey) {
          void deleteCachedTtsAudio(cacheKey).catch(() => {
            console.warn("Could not remove invalid cached TTS audio.");
          });
        }
      }
      return false;
    }
  }

  async function speak(
    id: string,
    text: string,
    lineId?: SpokenLineId,
    speechLanguage: LangCode = lang,
  ) {
    if (reading === id) {
      stopCurrentSpeech();
      return;
    }

    stopCurrentSpeech();
    const callId = activeCall.current;
    setFailed(false);
    setReading(id);
    let cacheKey: string | null = null;
    let fallbackReason = "Bhashini audio playback failed";
    await playWithSpeechFallbacks<Blob>({
      getStatic: async () => {
        if (activeCall.current !== callId) return null;
        if (!lineId) return null;
        const url = await findStaticTtsUrl(speechLanguage, lineId, text);
        if (activeCall.current !== callId) return null;
        if (!url) return null;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Static audio request failed (${response.status}).`);
        return response.blob();
      },
      getCached: async () => {
        if (activeCall.current !== callId) return null;
        cacheKey = await createTtsAudioCacheKey(speechLanguage, BHASHINI_CACHE_VOICE, text);
        return getCachedTtsAudio(cacheKey);
      },
      getBhashini: async () => {
        if (activeCall.current !== callId) return null;
        const response = await fetch("/api/bhashini", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ task: "tts", lang: speechLanguage, text }),
          signal: AbortSignal.timeout(45_000),
        });
        if (!response.ok) {
          fallbackReason = `HTTP status ${response.status}`;
          throw new Error("Bhashini request failed.");
        }

        const result: unknown = await response.json();
        const taskResult =
          typeof result === "object" &&
          result !== null &&
          "result" in result &&
          Array.isArray(result.result)
            ? result.result.find(
                (item): item is Record<string, unknown> =>
                  typeof item === "object" &&
                  item !== null &&
                  "taskType" in item &&
                  item.taskType === "tts",
              )
            : undefined;
        const audioEntry =
          taskResult && Array.isArray(taskResult["audio"])
            ? taskResult["audio"].find(
                (item): item is Record<string, unknown> =>
                  typeof item === "object" && item !== null,
              )
            : undefined;
        const audioContent = audioEntry?.["audioContent"];
        if (typeof audioContent !== "string" || !audioContent) {
          fallbackReason = "empty TTS audio response";
          throw new Error("Bhashini returned no audio.");
        }

        const config = taskResult?.["config"];
        const audioFormat =
          typeof config === "object" &&
          config !== null &&
          "audioFormat" in config &&
          typeof config.audioFormat === "string"
            ? config.audioFormat.toLowerCase()
            : "wav";
        const mimeType =
          audioFormat === "flac"
            ? "audio/flac"
            : audioFormat === "mp3"
              ? "audio/mpeg"
              : audioFormat === "ogg"
                ? "audio/ogg"
                : "audio/wav";
        const binary = atob(audioContent);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        return new Blob([bytes], { type: mimeType });
      },
      play: async (audio, source) => {
        if (activeCall.current !== callId) return true;
        return playAudio(
          audio,
          callId,
          source === "bhashini" ? cacheKey : null,
          source === "cache",
          source,
        );
      },
      speakWithBrowserVoice: async () => {
        if (activeCall.current === callId) {
          await speakWithBrowser(id, text, fallbackReason, callId, speechLanguage);
        }
      },
      onSourceError: (source, error) => {
        const reason =
          error instanceof Error && error.name === "TimeoutError"
            ? "timeout"
            : `${source} audio unavailable`;
        fallbackReason = reason;
        console.warn(`Speech ${source} source failed: ${reason}.`);
      },
    });
  }

  return {
    apiSupported,
    voiceAvailable: Boolean(voice),
    canUseBhashini: true,
    reading,
    failed,
    speak,
  };
}
