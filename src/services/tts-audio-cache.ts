import type { LangCode } from "@/i18n/translations";

const DATABASE_NAME = "kisan-saathi-tts-audio";
const DATABASE_VERSION = 1;
const STORE_NAME = "audio";
const memoryCache = new Map<string, Blob>();

export async function createTtsAudioCacheKey(
  language: LangCode,
  voice: string,
  text: string,
): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const textHash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `v1:${language}:${encodeURIComponent(voice)}:${textHash}`;
}

function openDatabase(): Promise<IDBDatabase> {
  if (!("indexedDB" in globalThis)) {
    return Promise.reject(new Error("IndexedDB is unavailable."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the audio cache."));
    request.onblocked = () => reject(new Error("Opening the audio cache was blocked."));
  });
}

export async function getCachedTtsAudio(key: string): Promise<Blob | null> {
  const inMemory = memoryCache.get(key);
  if (inMemory) return inMemory;

  const database = await openDatabase();
  try {
    const audio = await new Promise<Blob | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      let result: Blob | null = null;
      request.onsuccess = () => {
        if (request.result instanceof Blob) result = request.result;
      };
      request.onerror = () => reject(request.error ?? new Error("Could not read the audio cache."));
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Could not read the audio cache."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Reading the audio cache was aborted."));
    });
    if (audio) memoryCache.set(key, audio);
    return audio;
  } finally {
    database.close();
  }
}

export async function cacheTtsAudio(key: string, audio: Blob): Promise<void> {
  memoryCache.set(key, audio);
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(audio, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Could not save the audio cache."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Saving the audio cache was aborted."));
    });
  } finally {
    database.close();
  }
}

export async function deleteCachedTtsAudio(key: string): Promise<void> {
  memoryCache.delete(key);
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Could not remove the audio cache."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Removing the audio cache was aborted."));
    });
  } finally {
    database.close();
  }
}
