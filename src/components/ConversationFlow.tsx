import { useEffect, useRef, useState, type FormEvent } from "react";
import { Screen } from "@/components/Screen";
import { useCardSpeech } from "@/hooks/use-card-speech";
import { useI18n } from "@/lib/i18n";
import { CROP_KEYS, type CropKey, type LangCode, type StringKey } from "@/i18n/translations";
import {
  confirmAnswer,
  createConversation,
  getConfirmation,
  getIntentOptions,
  getQuestion,
  submitTapAnswer,
  type ConversationState,
  type ExtractableSlot,
  type FarmerIntent,
  type SlotValue,
  type SlotAnswers,
} from "@/services/farmer-conversation";
import type { SpokenLineId } from "@/services/static-tts";

const DATE_OPTIONS = ["today", "in3days", "in1week", "in2weeks", "in1month", "noHurry"] as const;

const QUESTION_LINE_IDS: Record<ExtractableSlot, SpokenLineId> = {
  intent: "questionIntent",
  name: "questionName",
  place: "conversationQuestionPlace",
  crop: "conversationQuestionCrop",
  quantity: "conversationQuestionQuantity",
  cashBy: "conversationQuestionCashBy",
  owes: "conversationQuestionOwes",
  debt: "conversationQuestionDebt",
  amountNeeded: "questionAmountNeeded",
  neededBy: "questionNeededBy",
  other: "questionOther",
};

function getPrompt(
  state: ConversationState,
  language: LangCode,
  translate: (key: StringKey) => string,
): string {
  if (state.stage === "confirming") {
    return getConfirmation(state.slot, state.pendingValue, language);
  }
  if (state.stage === "complete" && state.intent === "other") {
    return `${translate("otherHelpAnswer")} ${translate("thankYou")}`;
  }
  return getQuestion(state.slot, language);
}

export function ConversationFlow({
  onFinish,
}: {
  onFinish: (intent: FarmerIntent, answers: SlotAnswers) => void;
}) {
  const { t, lang, setCrop, updateSale } = useI18n();
  const speech = useCardSpeech(lang);
  const speechRef = useRef(speech);
  speechRef.current = speech;
  const translateRef = useRef(t);
  translateRef.current = t;
  const welcomed = useRef(false);
  const [conversation, setConversation] = useState(createConversation);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const prompt = getPrompt(conversation, lang, t);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!welcomed.current) {
        welcomed.current = true;
        await speechRef.current.speak(
          "conversation-welcome",
          translateRef.current("welcome"),
          "welcome",
        );
        if (cancelled) return;
      }
      if (prompt) {
        const lineId =
          conversation.stage === "confirming" ? undefined : QUESTION_LINE_IDS[conversation.slot];
        await speechRef.current.speak("conversation-prompt", prompt, lineId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversation.slot, conversation.stage, lang, prompt]);

  function answer(value: SlotValue) {
    const next = submitTapAnswer(conversation, value);
    if (next === conversation) {
      setError(t("invalidAnswer"));
      return;
    }
    setConversation(next);
    setDraft("");
    setError("");
  }

  function confirm(accepted: boolean) {
    const next = confirmAnswer(conversation, accepted);
    setConversation(next);
    setDraft("");
    setError("");
    if (next.stage === "complete" && next.intent && next.intent !== "other") {
      const answers = next.answers;
      const crop = answers.crop as CropKey | undefined;
      if (crop) setCrop(crop);
      updateSale({
        qty: answers.quantity ?? 1,
        place: answers.place ?? "",
        cashBy: answers.cashBy ?? answers.neededBy ?? "today",
        owes: answers.owes ?? false,
        debt: answers.debt ?? 0,
        amountNeeded: answers.amountNeeded ?? null,
      });
      onFinish(next.intent, answers);
    }
  }

  function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const slot = conversation.slot;
    const value =
      slot === "quantity" || slot === "debt" || slot === "amountNeeded"
        ? Number(draft)
        : draft.trim();
    answer(value);
  }

  const showIntentOptions =
    conversation.slot === "intent" &&
    (conversation.stage === "intent" ||
      conversation.stage === "asking" ||
      conversation.stage === "fallback");
  const showAnswers = conversation.stage === "asking" || conversation.stage === "fallback";

  return (
    <Screen step={2} title={prompt || t("chooseIntent")} helpKey="helpConversation">
      <p className="mb-5 text-xl font-semibold">{t("welcome")}</p>
      <section aria-live="polite" className="space-y-4">
        <h2 className="text-2xl font-bold">{prompt || t("thankYou")}</h2>
        {conversation.stage === "confirming" && (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="ks-btn" onClick={() => confirm(true)}>
              {t("yes")}
            </button>
            <button
              type="button"
              className="ks-card min-h-[56px] font-bold"
              onClick={() => confirm(false)}
            >
              {t("no")}
            </button>
          </div>
        )}

        {showIntentOptions && (
          <div className="grid gap-3">
            {getIntentOptions(lang).map(({ intent, label }) => (
              <button
                key={intent}
                type="button"
                className="ks-card min-h-[72px] px-4 text-start text-xl font-bold"
                onClick={() => answer(intent)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {showAnswers && (
          <>
            {conversation.stage === "fallback" && (
              <p role="status" className="text-muted-foreground">
                {t("tapBelow")}
              </p>
            )}
            {conversation.slot === "crop" && (
              <div className="grid grid-cols-2 gap-3">
                {CROP_KEYS.map((crop) => (
                  <button
                    key={crop}
                    type="button"
                    className="ks-card min-h-[64px] text-xl font-bold"
                    onClick={() => answer(crop)}
                  >
                    {t(crop)}
                  </button>
                ))}
              </div>
            )}
            {(conversation.slot === "cashBy" || conversation.slot === "neededBy") && (
              <div className="grid grid-cols-2 gap-3">
                {DATE_OPTIONS.map((date) => (
                  <button
                    key={date}
                    type="button"
                    className="ks-card min-h-[64px] text-lg font-bold"
                    onClick={() => answer(date)}
                  >
                    {t(date)}
                  </button>
                ))}
              </div>
            )}
            {conversation.slot === "owes" && (
              <div className="grid grid-cols-2 gap-3">
                <button type="button" className="ks-btn" onClick={() => answer(true)}>
                  {t("yes")}
                </button>
                <button
                  type="button"
                  className="ks-card min-h-[56px] font-bold"
                  onClick={() => answer(false)}
                >
                  {t("no")}
                </button>
              </div>
            )}
            {conversation.slot === "name" && (
              <button type="button" className="ks-chip" onClick={() => answer(null)}>
                {t("skip")}
              </button>
            )}
            {conversation.slot !== "intent" &&
              conversation.slot !== "crop" &&
              conversation.slot !== "cashBy" &&
              conversation.slot !== "neededBy" &&
              conversation.slot !== "owes" && (
                <form className="space-y-3" onSubmit={submitDraft}>
                  <label className="sr-only" htmlFor="conversation-answer">
                    {t("answerPlaceholder")}
                  </label>
                  <input
                    id="conversation-answer"
                    className="ks-input"
                    type={
                      conversation.slot === "quantity" ||
                      conversation.slot === "debt" ||
                      conversation.slot === "amountNeeded"
                        ? "number"
                        : "text"
                    }
                    min={
                      conversation.slot === "quantity" ||
                      conversation.slot === "debt" ||
                      conversation.slot === "amountNeeded"
                        ? 1
                        : undefined
                    }
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={t("answerPlaceholder")}
                  />
                  <button className="ks-btn w-full" type="submit" disabled={!draft.trim()}>
                    {t("submitAnswer")}
                  </button>
                </form>
              )}
          </>
        )}

        {conversation.stage === "complete" && conversation.intent === "other" && (
          <div className="space-y-4">
            <p className="ks-card p-4 text-lg">{t("otherHelpAnswer")}</p>
            <p>{t("thankYou")}</p>
            <button
              type="button"
              className="ks-btn w-full"
              onClick={() => {
                setConversation(createConversation());
                setError("");
              }}
            >
              {t("startAgain")}
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </section>
    </Screen>
  );
}
