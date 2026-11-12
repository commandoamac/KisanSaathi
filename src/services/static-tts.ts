import { createTtsAudioCacheKey } from "@/services/tts-audio-cache";
import {
  LANGUAGE_LOCALES,
  SPOKEN_LINES,
  STRINGS,
  type LangCode,
  type StringKey,
} from "@/i18n/translations";
import { GENERATED_TRANSLATIONS } from "@/i18n/generated-translations";

export type SpokenLineId = keyof typeof SPOKEN_LINES;

export type StaticTtsManifestEntry = {
  language: LangCode;
  lineId: SpokenLineId;
  fileName: string;
  textHash: string;
};

export type StaticTtsManifest = {
  version: 1;
  voice: "female";
  entries: StaticTtsManifestEntry[];
};

let manifestPromise: Promise<StaticTtsManifest> | undefined;

export function getSpokenLineIdForText(language: LangCode, text: string): SpokenLineId | null {
  for (const [lineId, key] of Object.entries(SPOKEN_LINES) as [SpokenLineId, StringKey][]) {
    const translated =
      STRINGS[language]?.[key] ?? GENERATED_TRANSLATIONS[language]?.[key] ?? STRINGS.en[key];
    if (translated === text) return lineId;
  }
  return null;
}

export async function findStaticTtsEntry(
  manifest: StaticTtsManifest,
  language: LangCode,
  lineId: SpokenLineId,
  text: string,
): Promise<StaticTtsManifestEntry | null> {
  const cacheKey = await createTtsAudioCacheKey(language, "bhashini-female-v1", text);
  const textHash = cacheKey.slice(cacheKey.lastIndexOf(":") + 1);
  return (
    manifest.entries.find(
      (entry) =>
        entry.language === language && entry.lineId === lineId && entry.textHash === textHash,
    ) ?? null
  );
}

async function loadManifest(): Promise<StaticTtsManifest> {
  const response = await fetch("/audio/tts/manifest.json");
  if (!response.ok) throw new Error(`Static audio manifest request failed (${response.status}).`);
  const value: unknown = await response.json();
  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    value.version !== 1 ||
    !("voice" in value) ||
    value.voice !== "female" ||
    !("entries" in value) ||
    !Array.isArray(value.entries)
  ) {
    throw new Error("Static audio manifest is invalid.");
  }
  const entries = value.entries.filter(
    (entry): entry is StaticTtsManifestEntry =>
      typeof entry === "object" &&
      entry !== null &&
      "language" in entry &&
      typeof entry.language === "string" &&
      entry.language in LANGUAGE_LOCALES &&
      "lineId" in entry &&
      typeof entry.lineId === "string" &&
      entry.lineId in SPOKEN_LINES &&
      "fileName" in entry &&
      typeof entry.fileName === "string" &&
      /^\/audio\/tts\/[a-z]{2,3}\/[a-zA-Z0-9._-]+$/.test(entry.fileName) &&
      "textHash" in entry &&
      typeof entry.textHash === "string" &&
      /^[a-f0-9]{64}$/.test(entry.textHash),
  );
  return { version: 1, voice: "female", entries };
}

export async function findStaticTtsUrl(
  language: LangCode,
  lineId: SpokenLineId,
  text: string,
): Promise<string | null> {
  manifestPromise ??= loadManifest().catch((error: unknown) => {
    manifestPromise = undefined;
    throw error;
  });
  const manifest = await manifestPromise;
  const entry = await findStaticTtsEntry(manifest, language, lineId, text);
  if (!entry || !/^\/audio\/tts\/[a-z]{2,3}\/[a-zA-Z0-9._-]+$/.test(entry.fileName)) return null;
  return entry.fileName;
}

export function getSpokenLineIds(): SpokenLineId[] {
  return Object.keys(SPOKEN_LINES) as SpokenLineId[];
}
