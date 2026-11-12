import { useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { ArrowLeft, HelpCircle, X, Sprout, FlaskConical, Square, Volume2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { RTL_LANGS, type StringKey } from "@/i18n/translations";
import { sampleData } from "@/services/sample-data";
import { VoiceProviderDebug } from "@/components/VoiceProviderDebug";
import { useCardSpeech } from "@/hooks/use-card-speech";
import { getSpokenLineIdForText } from "@/services/static-tts";

export function Screen({
  title,
  helpKey,
  children,
  footer,
  step,
}: {
  step: number;
  title: string;
  helpKey: StringKey;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { t, lang } = useI18n();
  const speech = useCardSpeech(lang);
  const titleLineId = getSpokenLineIdForText(lang, title);
  const router = useRouter();
  const [help, setHelp] = useState(false);

  return (
    <div
      dir={RTL_LANGS.includes(lang) ? "rtl" : "ltr"}
      className="mx-auto flex min-h-screen max-w-md flex-col bg-background text-lg"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b-2 border-border bg-background/95 px-3 py-2 backdrop-blur">
        <button onClick={() => router.history.back()} className="ks-chip" aria-label={t("back")}>
          <ArrowLeft className="size-7 rtl:rotate-180" aria-hidden />
          <span>{t("back")}</span>
        </button>
        <div className="flex items-center gap-1 font-display text-xl font-bold text-primary">
          <Sprout className="size-6" aria-hidden />
          <span>{t("appName")}</span>
        </div>
        <button onClick={() => setHelp(true)} className="ks-chip" aria-label={t("help")}>
          <HelpCircle className="size-7" aria-hidden />
          <span>{t("help")}</span>
        </button>
      </header>

      {sampleData.label === "SAMPLE" && (
        <aside
          className="mx-4 mt-3 border-l-4 border-secondary bg-muted px-3 py-2"
          aria-label={t("sampleData")}
        >
          <span className="flex items-center gap-2 font-bold">
            <FlaskConical className="size-6 shrink-0" aria-hidden />
            {t("sampleData")}
          </span>
          <p className="text-lg text-muted-foreground">{t("sampleDataNote")}</p>
        </aside>
      )}
      <ProgressDots step={step} />
      <VoiceProviderDebug />
      <main className="flex-1 px-4 pb-6 pt-2">
        <div className="mb-5 flex items-start gap-2">
          <h1 className="flex-1 font-display text-[1.75rem] font-bold leading-tight text-foreground">
            {title}
          </h1>
          {titleLineId && (
            <button
              type="button"
              className="ks-chip shrink-0"
              aria-label={t(speech.reading === "screen-title" ? "stopReading" : "readCard")}
              aria-pressed={speech.reading === "screen-title"}
              onClick={() => speech.speak("screen-title", title, titleLineId)}
            >
              {speech.reading === "screen-title" ? (
                <Square className="size-6" aria-hidden />
              ) : (
                <Volume2 className="size-6" aria-hidden />
              )}
              <span>{t(speech.reading === "screen-title" ? "stopReading" : "readCard")}</span>
            </button>
          )}
        </div>
        {children}
      </main>

      {footer && (
        <div className="sticky bottom-0 border-t-2 border-border bg-background p-4">{footer}</div>
      )}

      {help && (
        <div
          role="dialog"
          aria-modal
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-4"
          onClick={() => setHelp(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3 text-primary">
              <HelpCircle className="size-10" aria-hidden />
              <span className="font-display text-2xl font-bold">{t("help")}</span>
            </div>
            <p className="mb-3 text-xl leading-relaxed">{t(helpKey)}</p>
            <p className="mb-6 text-lg text-muted-foreground">{t("youDecide")}</p>
            <button onClick={() => setHelp(false)} className="ks-btn w-full">
              <X className="size-7" aria-hidden />
              <span>{t("close")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const TOTAL_STEPS = 7;

function ProgressDots({ step }: { step: number }) {
  return (
    <div
      className="flex items-center justify-center gap-2 pt-4"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={TOTAL_STEPS}
      aria-valuenow={step}
    >
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const n = i + 1;
        const state = n < step ? "done" : n === step ? "current" : "todo";
        return <span key={n} data-state={state} className="ks-dot" />;
      })}
      <span className="ms-2 text-lg font-semibold text-muted-foreground tabular-nums">
        {step}/{TOTAL_STEPS}
      </span>
    </div>
  );
}
