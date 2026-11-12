import { describe, expect, it } from "vitest";

import { CROP_KEYS, LANGUAGES, STRINGS } from "./translations";

describe("crop translations", () => {
  it("provides a localized label for every crop in every available language", () => {
    for (const { code } of LANGUAGES) {
      for (const key of CROP_KEYS) {
        expect(STRINGS[code][key], `${code}.${key}`).toBeTruthy();
      }
    }
  });

  it("provides the first-run language prompt in every offered language", () => {
    for (const language of ["hi", "bn", "as", "en"] as const) {
      expect(
        STRINGS[language].languageChoicePrompt,
        `${language}.languageChoicePrompt`,
      ).toBeTruthy();
      expect(STRINGS[language].startLanguagePrompt, `${language}.startLanguagePrompt`).toBeTruthy();
      expect(STRINGS[language].moreLanguages, `${language}.moreLanguages`).toBeTruthy();
      expect(STRINGS[language].fewerLanguages, `${language}.fewerLanguages`).toBeTruthy();
    }
  });

  it("provides the first-run conversation controls and answers in every offered language", () => {
    const flowKeys = [
      "welcome",
      "thankYou",
      "appName",
      "back",
      "help",
      "close",
      "chooseIntent",
      "helpConversation",
      "questionName",
      "questionPlace",
      "questionCrop",
      "questionQuantity",
      "questionCashBy",
      "questionOwes",
      "questionDebt",
      "questionAmountNeeded",
      "questionNeededBy",
      "questionOther",
      "intentSell",
      "intentMoney",
      "intentPrice",
      "intentOther",
      "confirmationTemplate",
      "oweYesLabel",
      "oweNoLabel",
      "answerPlaceholder",
      "submitAnswer",
      "skip",
      "invalidAnswer",
      "tapBelow",
      "otherHelpAnswer",
      "moneyGoal",
      "yes",
      "no",
      "today",
      "in3days",
      "in1week",
      "in2weeks",
      "in1month",
      "noHurry",
      "sampleData",
      "sampleDataNote",
      "youDecide",
      "resultsTitle",
      "helpResults",
      "optionTrader",
      "optionMandi",
      "optionPool",
      "optionWarehouse",
      "keepMoney",
      "eventualMoney",
      "afterTraderDebt",
      "priceRangeLabel",
      "rangeLow",
      "rangeExpected",
      "rangeHigh",
      "cashYes",
      "cashNo",
      "cashTiming",
      "cashToday",
      "reasonTrader",
      "reasonMandi",
      "reasonPool",
      "reasonWarehouse",
      "debtCompare",
      "extraIncome",
      "traderRepayment",
      "switchingUnknown",
      "loanCash",
      "sampleLocationNote",
      "readCard",
      "readResult",
      "stopReading",
      "speechUnavailable",
      "speechFailed",
      "speechLanguageUnavailable",
      "incompleteResults",
      "startAgain",
      "resultsSummary",
      "rankedOption",
      "deadlineSummary",
      "sampleForecastConfidence",
      "translationReviewNote",
    ] as const;

    for (const language of ["hi", "bn", "as", "en"] as const) {
      for (const key of flowKeys) {
        expect(STRINGS[language][key], `${language}.${key}`).toBeTruthy();
      }
    }
  });
});
