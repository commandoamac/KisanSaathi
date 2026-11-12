import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const speech = vi.hoisted(() => ({
  speak: vi.fn(),
  reading: null as string | null,
  voiceAvailable: true,
  canUseBhashini: true,
  apiSupported: true,
  failed: false,
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    lang: "hi",
    crop: "tomato",
    sale: {
      qty: 10,
      place: "411001",
      cashBy: "in1week",
      owes: false,
      debt: 0,
      amountNeeded: 1000,
    },
  }),
}));

vi.mock("@/hooks/use-card-speech", () => ({
  useCardSpeech: () => speech,
}));

vi.mock("@/components/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { Results } from "./Results";

describe("spoken results", () => {
  beforeEach(() => {
    speech.speak.mockClear();
    speech.reading = null;
  });

  it("speaks the complete localized result through the shared speech service", () => {
    render(<Results />);

    fireEvent.click(screen.getByRole("button", { name: "readResult" }));

    expect(speech.speak).toHaveBeenCalledOnce();
    expect(speech.speak).toHaveBeenCalledWith(
      "all-results",
      expect.stringContaining("sampleDataNote"),
    );
    const narration = speech.speak.mock.calls[0]?.[1] as string;
    expect(narration).toContain("thankYou");
    expect(narration).toContain("resultsSummary");
    expect(narration).toContain("moneyGoal");
    expect(narration).toContain("rankedOption");
    expect(narration).toContain("sampleLocationNote");
  });
});
