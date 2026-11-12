import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConversationFlow } from "./ConversationFlow";

const testLanguage = vi.hoisted(() => ({ value: "en" }));

vi.mock("@/lib/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/i18n")>();
  const { STRINGS } = await import("@/i18n/translations");
  return {
    ...actual,
    useI18n: () => {
      const lang = testLanguage.value as keyof typeof STRINGS;
      return {
        lang,
        t: (key: keyof typeof STRINGS.en) => STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key,
        setCrop: vi.fn(),
        updateSale: vi.fn(),
      };
    },
  };
});

vi.mock("@/hooks/use-card-speech", () => ({
  useCardSpeech: () => ({ speak: vi.fn().mockResolvedValue(undefined) }),
}));

const localized = {
  en: {
    sell: "Sell my crop",
    yes: "Yes",
    no: "No",
    skip: "Skip",
    answer: "Type your answer",
    submit: "Send answer",
    tomato: "Tomato",
    today: "Today",
  },
  hi: {
    sell: "मेरी फसल बेचें",
    yes: "हाँ",
    no: "नहीं",
    skip: "छोड़ें",
    answer: "अपना जवाब लिखें",
    submit: "जवाब भेजें",
    tomato: "टमाटर",
    today: "आज",
  },
} as const;

describe("first-run guided conversation", () => {
  it.each(["en", "hi"] as const)(
    "collects and confirms the crop-sale answers in %s before producing a result",
    async (language) => {
      testLanguage.value = language;
      const onFinish = vi.fn();
      render(<ConversationFlow onFinish={onFinish} />);
      const words = localized[language];
      const choose = (label: string) => {
        fireEvent.click(screen.getByRole("button", { name: label }));
        fireEvent.click(screen.getByRole("button", { name: words.yes }));
      };

      fireEvent.click(await screen.findByRole("button", { name: words.sell }));
      fireEvent.click(screen.getByRole("button", { name: words.yes }));

      fireEvent.click(screen.getByRole("button", { name: words.skip }));
      fireEvent.click(screen.getByRole("button", { name: words.yes }));

      fireEvent.change(screen.getByLabelText(words.answer), { target: { value: "Silchar" } });
      fireEvent.click(screen.getByRole("button", { name: words.submit }));
      fireEvent.click(screen.getByRole("button", { name: words.yes }));

      choose(words.tomato);

      fireEvent.change(screen.getByLabelText(words.answer), { target: { value: "5" } });
      fireEvent.click(screen.getByRole("button", { name: words.submit }));
      fireEvent.click(screen.getByRole("button", { name: words.yes }));

      choose(words.today);

      fireEvent.click(screen.getByRole("button", { name: words.no }));
      fireEvent.click(screen.getByRole("button", { name: words.yes }));

      await waitFor(() => {
        expect(onFinish).toHaveBeenCalledWith(
          "sell",
          expect.objectContaining({
            name: null,
            place: "Silchar",
            crop: "tomato",
            quantity: 5,
            cashBy: "today",
            owes: false,
          }),
        );
      });
    },
  );
});
