import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Screen } from "@/components/Screen";
import { useI18n } from "@/lib/i18n";
import { GENERATED_TRANSLATIONS } from "@/i18n/generated-translations";
import { STRINGS, type LangCode } from "@/i18n/translations";
import { FirstRunLanguageChoice } from "@/components/FirstRunLanguageChoice";
import { useCardSpeech } from "@/hooks/use-card-speech";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KisanSaathi — Choose your language" },
      {
        name: "description",
        content: "KisanSaathi helps small farmers decide where, when and how to sell crops.",
      },
      { property: "og:title", content: "KisanSaathi — Choose your language" },
      {
        property: "og:description",
        content: "Simple selling advice for farmers, in your own language.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LanguagePage,
});

function LanguagePage() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const speech = useCardSpeech(lang);
  const [selectedLanguage, setSelectedLanguage] = useState<LangCode | null>(null);
  const generation = useRef(0);
  const speechRef = useRef(speech);
  speechRef.current = speech;

  function getPrompt(language: LangCode): string {
    return (
      STRINGS[language].languageChoicePrompt ??
      GENERATED_TRANSLATIONS[language]?.languageChoicePrompt ??
      STRINGS.en.languageChoicePrompt!
    );
  }

  async function playLanguagePrompts() {
    const currentGeneration = ++generation.current;
    const languages: readonly LangCode[] = ["hi", "bn", "as", "en"];
    for (const language of languages) {
      if (generation.current !== currentGeneration) return;
      await speechRef.current.speak(
        `language-choice-${language}`,
        getPrompt(language),
        "languageChoicePrompt",
        language,
      );
    }
  }

  const replayPrompts = useRef(playLanguagePrompts);
  replayPrompts.current = playLanguagePrompts;
  useEffect(() => {
    void replayPrompts.current();
    return () => {
      generation.current += 1;
    };
  }, []);

  function selectLanguage(language: LangCode) {
    generation.current += 1;
    setSelectedLanguage(language);
    setLang(language);
    navigate({ to: "/conversation" });
  }

  return (
    <Screen step={1} title={t("chooseLanguage")} helpKey="helpLanguage">
      <FirstRunLanguageChoice
        selectedLanguage={selectedLanguage}
        t={t}
        onStart={() => void playLanguagePrompts()}
        onSelect={selectLanguage}
      />
    </Screen>
  );
}
