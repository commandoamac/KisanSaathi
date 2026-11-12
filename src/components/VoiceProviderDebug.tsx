import { useEffect, useState } from "react";
import {
  subscribeVoiceProvider,
  type VoiceProviderEvent,
  type VoiceTask,
} from "@/lib/voice-provider-debug";

const TASKS: VoiceTask[] = ["ASR", "Translation", "TTS"];

export function VoiceProviderDebug() {
  const [events, setEvents] = useState<Partial<Record<VoiceTask, VoiceProviderEvent>>>({});

  useEffect(
    () =>
      subscribeVoiceProvider((event) => {
        setEvents((current) => ({ ...current, [event.task]: event }));
      }),
    [],
  );

  return (
    <aside
      className="mx-4 mt-2 rounded-md border border-dashed border-muted-foreground/50 px-3 py-2 text-sm text-muted-foreground"
      aria-label="Voice provider debug"
      aria-live="polite"
    >
      <p className="font-semibold">Voice provider debug</p>
      <ul className="grid grid-cols-1 gap-x-3 sm:grid-cols-3">
        {TASKS.map((task) => {
          const event = events[task];
          return (
            <li key={task}>
              <span className="font-medium">{task}:</span>{" "}
              {event ? event.provider : "No call observed"}
              {event?.reason && <span> — {event.reason}</span>}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
