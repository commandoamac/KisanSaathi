import { describe, expect, it, vi } from "vitest";

import { createTtsAudioCacheKey } from "./tts-audio-cache";
import { findStaticTtsEntry, getSpokenLineIdForText, type StaticTtsManifest } from "./static-tts";
import { STRINGS } from "@/i18n/translations";
import { playWithSpeechFallbacks } from "./speech-fallback";

describe("static spoken audio", () => {
  it("uses a manifest entry only when language, line id, and text hash all match", async () => {
    const text = "Welcome to KisanSaathi.";
    const key = await createTtsAudioCacheKey("hi", "bhashini-female-v1", text);
    const textHash = key.slice(key.lastIndexOf(":") + 1);
    const manifest: StaticTtsManifest = {
      version: 1,
      voice: "female",
      entries: [
        {
          language: "hi",
          lineId: "welcome",
          fileName: "/audio/tts/hi/welcome.wav",
          textHash,
        },
      ],
    };

    await expect(findStaticTtsEntry(manifest, "hi", "welcome", text)).resolves.toEqual(
      manifest.entries[0],
    );
    await expect(findStaticTtsEntry(manifest, "bn", "welcome", text)).resolves.toBeNull();
    await expect(
      findStaticTtsEntry(manifest, "hi", "welcome", "Welcome, farmer."),
    ).resolves.toBeNull();
    await expect(findStaticTtsEntry(manifest, "hi", "thankYou", text)).resolves.toBeNull();
  });

  it("maps fixed screen headings to their stable spoken line ids", () => {
    expect(getSpokenLineIdForText("hi", STRINGS.hi.chooseCrop!)).toBe("questionCrop");
    expect(getSpokenLineIdForText("hi", STRINGS.hi.questionCrop!)).toBe("conversationQuestionCrop");
    expect(getSpokenLineIdForText("en", STRINGS.en.welcome!)).toBe("welcome");
    expect(getSpokenLineIdForText("en", "Tomato · 3 quintal")).toBeNull();
  });

  it("tries static audio, cache, Bhashini, and browser voice in that order", async () => {
    const order: string[] = [];
    const source = new Blob(["audio"]);

    await expect(
      playWithSpeechFallbacks({
        getStatic: async () => {
          order.push("static");
          return source;
        },
        getCached: async () => {
          order.push("cache");
          return source;
        },
        getBhashini: async () => {
          order.push("bhashini");
          throw new Error("offline");
        },
        play: async (_audio, provider) => {
          order.push(`play:${provider}`);
          return false;
        },
        speakWithBrowserVoice: () => {
          order.push("browser");
        },
        onSourceError: vi.fn(),
      }),
    ).resolves.toBe("browser");

    expect(order).toEqual(["static", "play:static", "cache", "play:cache", "bhashini", "browser"]);
  });
});
