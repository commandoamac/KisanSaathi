import { describe, expect, it } from "vitest";

import {
  confirmAnswer,
  createConversation,
  getConfirmation,
  getIntentOptions,
  getQuestion,
  RuleBasedSlotExtractor,
  submitTapAnswer,
  submitVoiceAnswer,
  type ConversationState,
  type FarmerIntent,
  type SlotValue,
} from "./farmer-conversation";
import type { LangCode } from "@/i18n/translations";

const extractor = new RuleBasedSlotExtractor();

function chooseIntent(intent: FarmerIntent): ConversationState {
  let state = createConversation();
  state = submitTapAnswer(state, intent);
  expect(state.stage).toBe("confirming");
  state = confirmAnswer(state, true);
  expect(state.intent).toBe(intent);
  expect(state.stage).toBe("asking");
  return state;
}

function answerByTap(state: ConversationState, value: SlotValue): ConversationState {
  state = submitTapAnswer(state, value);
  expect(state.stage).toBe("confirming");
  return confirmAnswer(state, true);
}

describe("farmer conversation state machine", () => {
  it("shows all four first-question options and localized intent text", () => {
    expect(getQuestion("intent", "en")).toBe("What would you like to do?");
    expect(getIntentOptions("en").map((option) => option.label)).toEqual([
      "Sell my crop",
      "I need money or a loan",
      "Just know today's market price",
      "Something else",
    ]);
    expect(getQuestion("intent", "hi")).toBe("आप क्या करना चाहते हैं?");
    expect(getQuestion("intent", "bn")).toBe("আপনি কী করতে চান?");
    expect(getQuestion("intent", "as")).toBe("আপুনি কি কৰিব বিচাৰে?");
  });

  it("completes the sell-crop path without trader debt", () => {
    let state = chooseIntent("sell");
    state = answerByTap(state, null);
    state = answerByTap(state, "Silchar");
    state = answerByTap(state, "tomato");
    state = answerByTap(state, 200);
    state = answerByTap(state, "today");
    state = answerByTap(state, false);

    expect(state.stage).toBe("complete");
    expect(state.answers).toEqual({
      name: null,
      place: "Silchar",
      crop: "tomato",
      quantity: 200,
      cashBy: "today",
      owes: false,
    });
  });

  it("asks the debt amount only when the farmer owes the trader", () => {
    let state = chooseIntent("sell");
    state = answerByTap(state, "Aman");
    state = answerByTap(state, "Silchar");
    state = answerByTap(state, "wheat");
    state = answerByTap(state, 12);
    state = answerByTap(state, "in1week");
    state = answerByTap(state, true);
    expect(state.slot).toBe("debt");
    state = answerByTap(state, 5000);

    expect(state.stage).toBe("complete");
    expect(state.answers.debt).toBe(5000);
  });

  it("completes the money-or-loan path with crop, quantity and deadline", () => {
    let state = chooseIntent("money");
    state = answerByTap(state, null);
    state = answerByTap(state, "123456");
    state = answerByTap(state, "onion");
    state = answerByTap(state, 4);
    state = answerByTap(state, 10000);
    state = answerByTap(state, "in3days");

    expect(state.stage).toBe("complete");
    expect(state.answers).toMatchObject({
      place: "123456",
      crop: "onion",
      quantity: 4,
      amountNeeded: 10000,
      neededBy: "in3days",
    });
  });

  it("completes the market-price path", () => {
    let state = chooseIntent("price");
    state = answerByTap(state, "Guwahati");
    state = answerByTap(state, "paddy");

    expect(state.stage).toBe("complete");
    expect(state.answers).toEqual({ place: "Guwahati", crop: "paddy" });
  });

  it("repeats Something else once, then returns to the four intent options", () => {
    let state = chooseIntent("other");
    state = answerByTap(state, "Help me with something");
    expect(state.stage).toBe("complete");

    state = chooseIntent("other");
    state = confirmAnswer(submitTapAnswer(state, "Need help"), false);
    expect(state.stage).toBe("asking");
    expect(state.slot).toBe("other");
    state = confirmAnswer(submitTapAnswer(state, "Need help"), false);
    expect(state.stage).toBe("fallback");
    expect(state.slot).toBe("intent");
    expect(getIntentOptions("en")).toHaveLength(4);
  });

  it("repeats a low-confidence spoken answer once and then requires tap input", () => {
    let state = chooseIntent("price");
    const unsureExtractor: RuleBasedSlotExtractor = {
      extract: () => ({ value: null, confidence: 0 }),
    };
    state = submitVoiceAnswer(state, "unclear words", "en", unsureExtractor);
    expect(state.stage).toBe("asking");
    expect(state.retryCount).toBe(1);
    state = submitVoiceAnswer(state, "still unclear", "en", unsureExtractor);
    expect(state.stage).toBe("fallback");
    expect(state.retryCount).toBe(2);
    expect(state.usedVoice).toBe(true);

    state = answerByTap(state, "Silchar");
    expect(state.answers.place).toBe("Silchar");
  });

  it.each([
    ["hi", "do sau quintal", 200],
    ["hi", "दो सौ क्विंटल", 200],
    ["bn", "দুই শত", 200],
    ["as", "দুই শত", 200],
    ["en", "two hundred", 200],
  ] as const)("extracts number words for %s", (language, spoken, expected) => {
    expect(extractor.extract("quantity", spoken, language as LangCode)).toMatchObject({
      value: expected,
      confidence: expect.any(Number),
    });
  });

  it.each([
    ["hi", "टमाटर", "tomato"],
    ["bn", "আলু", "potato"],
    ["as", "ধান", "paddy"],
    ["en", "onion", "onion"],
  ] as const)("extracts configured crop aliases for %s", (language, spoken, expected) => {
    expect(extractor.extract("crop", spoken, language as LangCode).value).toBe(expected);
  });

  it.each([
    ["hi", "हाँ", true],
    ["hi", "नहीं", false],
    ["bn", "হ্যাঁ", true],
    ["bn", "না", false],
    ["as", "হয়", true],
    ["as", "নহয়", false],
    ["en", "yes", true],
    ["en", "no", false],
  ] as const)("extracts localized yes/no for %s", (language, spoken, expected) => {
    expect(extractor.extract("owes", spoken, language as LangCode).value).toBe(expected);
  });

  it("extracts a PIN and confirms the recognized answer in the selected language", () => {
    const extracted = extractor.extract("place", "My village PIN is 788001", "en");
    expect(extracted.value).toBe("788001");
    expect(getConfirmation("place", extracted.value, "en")).toBe(
      "You said 788001. Is that correct?",
    );
  });
});
