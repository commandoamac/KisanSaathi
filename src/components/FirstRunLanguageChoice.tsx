import { Volume2, Check } from "lucide-react";
import { useState } from "react";
import { LANGUAGES, type LangCode, type StringKey } from "@/i18n/translations";

const FIRST_RUN_LANGUAGES: readonly LangCode[] = ["hi", "bn", "as", "en"];

export function FirstRunLanguageChoice({
  selectedLanguage,
  t,
  onStart,
  onSelect,
}: {
  selectedLanguage: LangCode | null;
  t: (key: StringKey) => string;
  onStart: () => void;
  onSelect: (language: LangCode) => void;
}) {
  const [showMore, setShowMore] = useState(false);
  const primaryOptions = LANGUAGES.filter((language) =>
    FIRST_RUN_LANGUAGES.includes(language.code),
  );
  const additionalOptions = LANGUAGES.filter(
    (language) => !FIRST_RUN_LANGUAGES.includes(language.code),
  );
  const options = showMore ? [...primaryOptions, ...additionalOptions] : primaryOptions;

  return (
    <section aria-label={t("chooseLanguage")} className="space-y-4">
      <button type="button" className="ks-btn w-full" onClick={onStart}>
        <Volume2 className="size-7" aria-hidden />
        <span>{t("startLanguagePrompt")}</span>
      </button>
      <div className="grid grid-cols-2 gap-3">
        {options.map((language) => (
          <button
            key={language.code}
            type="button"
            data-testid={`language-choice-${language.code}`}
            aria-pressed={selectedLanguage === language.code}
            onClick={() => onSelect(language.code)}
            className="ks-card flex min-h-[88px] flex-col items-start justify-center px-4 py-3 text-start"
          >
            <span className="flex w-full items-center justify-between text-2xl font-bold">
              {language.native}
              {selectedLanguage === language.code && (
                <Check className="size-6 text-primary" aria-label="selected" />
              )}
            </span>
            <span className="text-lg text-muted-foreground">{language.english}</span>
          </button>
        ))}
      </div>
      {additionalOptions.length > 0 && (
        <button
          type="button"
          className="ks-chip w-full justify-center"
          aria-expanded={showMore}
          onClick={() => setShowMore((visible) => !visible)}
        >
          {t(showMore ? "fewerLanguages" : "moreLanguages")}
        </button>
      )}
    </section>
  );
}
