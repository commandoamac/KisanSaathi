export type VoiceTask = "ASR" | "Translation" | "TTS";
export type VoiceProvider =
  "Bhashini" | "Static audio" | "Cached audio" | "Browser fallback" | "No provider";

export type VoiceProviderEvent = {
  task: VoiceTask;
  provider: VoiceProvider;
  reason?: string;
};

const EVENT_NAME = "ks-voice-provider";

export function reportVoiceProvider(event: VoiceProviderEvent) {
  const safeEvent = {
    task: event.task,
    provider: event.provider,
    ...(event.reason ? { reason: event.reason } : {}),
  };
  console.info("[voice-provider]", safeEvent);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<VoiceProviderEvent>(EVENT_NAME, { detail: safeEvent }));
  }
}

export function subscribeVoiceProvider(listener: (event: VoiceProviderEvent) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    listener((event as CustomEvent<VoiceProviderEvent>).detail);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
