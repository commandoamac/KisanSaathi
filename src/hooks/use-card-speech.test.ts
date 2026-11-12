import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LANGUAGES } from "@/i18n/translations";
import { subscribeVoiceProvider } from "@/lib/voice-provider-debug";
import { createTtsAudioCacheKey } from "@/services/tts-audio-cache";
import { findSpeechVoice, getSpeechLocale } from "./use-card-speech";
import { useCardSpeech } from "./use-card-speech";

class MockUtterance {
  lang = "";
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;
  onstart: (() => void) | null = null;

  constructor(readonly text: string) {}
}

class MockAudio {
  static instances: MockAudio[] = [];
  onplay: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly src: string) {
    MockAudio.instances.push(this);
  }

  async play() {
    this.onplay?.();
    this.onended?.();
  }

  pause() {}
}

describe("card speech language selection", () => {
  beforeEach(() => {
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [],
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        cancel: vi.fn(),
        speak: vi.fn((utterance: MockUtterance) => {
          utterance.onstart?.();
          utterance.onend?.();
        }),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses a locale tag for every offered language", () => {
    for (const { code } of LANGUAGES) {
      expect(getSpeechLocale(code)).toMatch(/^[a-z]{2,3}-[A-Z]{2}$/);
    }
  });

  it("selects only a voice matching the selected language", () => {
    const voices: SpeechSynthesisVoice[] = [
      {
        default: true,
        lang: "en-US",
        localService: true,
        name: "English",
        voiceURI: "english",
      },
      {
        default: false,
        lang: "hi-IN",
        localService: true,
        name: "Hindi",
        voiceURI: "hindi",
      },
    ];

    expect(findSpeechVoice(voices, "hi")?.lang).toBe("hi-IN");
    expect(findSpeechVoice(voices, "bn")).toBeUndefined();
  });

  it("uses browser speech with the requested language when no matching voice is installed", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ reason: "circuit breaker open" }), { status: 503 }),
        ),
    );
    const providerEvents: Array<{ provider: string; reason?: string }> = [];
    const unsubscribe = subscribeVoiceProvider((event) => providerEvents.push(event));
    const { result } = renderHook(() => useCardSpeech("bn"));

    await act(async () => {
      await result.current.speak("test", "পরীক্ষা");
    });

    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    const utterance = vi.mocked(window.speechSynthesis.speak).mock.calls[0]?.[0] as MockUtterance;
    expect(utterance.lang).toBe("bn-IN");
    expect(utterance.voice).toBeNull();
    expect(providerEvents.at(-1)).toMatchObject({
      provider: "Browser fallback",
      reason: expect.stringContaining("using browser default voice for bn"),
    });
    unsubscribe();
  });

  it("uses successful audio from cache for repeated language, voice, and text", async () => {
    vi.stubGlobal("Audio", MockAudio);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:cached-audio"),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    MockAudio.instances = [];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          result: [
            {
              taskType: "tts",
              audio: [{ audioContent: "AQID" }],
              config: { audioFormat: "wav" },
            },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCardSpeech("hi"));

    await act(async () => {
      await result.current.speak("first", "नमस्ते");
    });
    await act(async () => {
      await result.current.speak("second", "नमस्ते");
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(MockAudio.instances).toHaveLength(2);
  });

  it("hashes cache keys by language, voice, and text without storing the text", async () => {
    const key = await createTtsAudioCacheKey("hi", "bhashini-default-v1", "नमस्ते");

    expect(key).toMatch(/^v1:hi:bhashini-default-v1:[a-f0-9]{64}$/);
    await expect(createTtsAudioCacheKey("bn", "bhashini-default-v1", "नमस्ते")).resolves.not.toBe(
      key,
    );
    await expect(createTtsAudioCacheKey("hi", "another-voice", "नमस्ते")).resolves.not.toBe(key);
    await expect(createTtsAudioCacheKey("hi", "bhashini-default-v1", "नमस्कार")).resolves.not.toBe(
      key,
    );
    expect(key).not.toContain("नमस्ते");
  });
});
