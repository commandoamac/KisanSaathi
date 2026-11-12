import { STRINGS, type LangCode, type StringKey } from "@/i18n/translations";
import { sampleData } from "./sample-data";

export const FARMER_INTENTS = ["sell", "money", "price", "other"] as const;
export type FarmerIntent = (typeof FARMER_INTENTS)[number];
export type ConversationSlot =
  | "name"
  | "place"
  | "crop"
  | "quantity"
  | "cashBy"
  | "owes"
  | "debt"
  | "amountNeeded"
  | "neededBy"
  | "other";
export type ExtractableSlot = ConversationSlot | "intent";
export type SlotValue = string | number | boolean | null;
export type SlotAnswers = {
  name?: string | null;
  place?: string;
  crop?: string;
  quantity?: number;
  cashBy?: string;
  owes?: boolean;
  debt?: number;
  amountNeeded?: number;
  neededBy?: string;
  other?: string;
};

export type ConversationState = {
  stage: "intent" | "asking" | "confirming" | "fallback" | "complete";
  intent: FarmerIntent | null;
  slot: ExtractableSlot;
  answers: SlotAnswers;
  pendingValue: SlotValue;
  retryCount: number;
  usedVoice: boolean;
};

export type SlotExtraction = { value: SlotValue; confidence: number };

export interface SlotExtractor {
  extract(slot: ExtractableSlot, utterance: string, language: LangCode): SlotExtraction;
}

const CROP_ALIASES: Record<string, readonly string[]> = {
  tomato: ["tomato", "tomatoes", "tamatar", "tamaatar", "टमाटर", "টমেটো", "বিলাহী"],
  onion: ["onion", "onions", "pyaz", "pyaaz", "পেঁয়াজ", "পিঁয়াজ", "পিয়াঁজ"],
  potato: ["potato", "potatoes", "aloo", "alu", "आलू", "আলু"],
  wheat: ["wheat", "gehun", "gehu", "गेहूँ", "গম", "ঘেঁহু"],
  paddy: ["paddy", "rice", "dhan", "धान", "ধান"],
};

const ENGLISH_INTENT_ALIASES: Record<FarmerIntent, readonly string[]> = {
  sell: ["sell my crop", "sell crop", "sell"],
  money: ["i need money or a loan", "need money", "loan"],
  price: ["just know today's market price", "today's market price", "market price"],
  other: ["something else", "other"],
};

const LOCAL_INTENT_ALIASES: Partial<Record<LangCode, Record<FarmerIntent, readonly string[]>>> = {
  hi: {
    sell: ["फसल बेचना", "मेरी फसल बेचनी है"],
    money: ["पैसे या कर्ज़ चाहिए", "मुझे पैसे चाहिए", "ऋण चाहिए"],
    price: ["आज का बाजार भाव", "आज का भाव"],
    other: ["कुछ और"],
  },
  bn: {
    sell: ["আমার ফসল বিক্রি", "ফসল বিক্রি"],
    money: ["আমার টাকা বা ঋণ দরকার", "ঋণ দরকার"],
    price: ["আজকের বাজারদর"],
    other: ["অন্য কিছু"],
  },
  as: {
    sell: ["মোৰ শস্য বিক্ৰী", "শস্য বিক্ৰী"],
    money: ["মোক টকা বা ঋণ লাগে", "ঋণ লাগে"],
    price: ["আজিৰ বজাৰ মূল্য"],
    other: ["আন কিবা"],
  },
};

const NUMBER_WORDS: Partial<Record<LangCode, Record<string, number>>> = {
  en: {
    zero: 0,
    oh: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
    hundred: 100,
    thousand: 1000,
    lakh: 100000,
  },
  hi: {
    शून्य: 0,
    एक: 1,
    दो: 2,
    दू: 2,
    तीन: 3,
    चार: 4,
    पाँच: 5,
    पांच: 5,
    छः: 6,
    छह: 6,
    सात: 7,
    आठ: 8,
    नौ: 9,
    दस: 10,
    ग्यारह: 11,
    बारह: 12,
    तेरह: 13,
    चौदह: 14,
    पंद्रह: 15,
    सोलह: 16,
    सत्रह: 17,
    अठारह: 18,
    उन्नीस: 19,
    बीस: 20,
    तीस: 30,
    चालीस: 40,
    पचास: 50,
    साठ: 60,
    सत्तर: 70,
    अस्सी: 80,
    नब्बे: 90,
    सौ: 100,
    हजार: 1000,
    हज़ार: 1000,
    लाख: 100000,
    ek: 1,
    do: 2,
    dō: 2,
    dui: 2,
    teen: 3,
    char: 4,
    paanch: 5,
    panch: 5,
    chhe: 6,
    saat: 7,
    aath: 8,
    nau: 9,
    das: 10,
    bees: 20,
    sau: 100,
    so: 100,
    sho: 100,
    hazaar: 1000,
    hajar: 1000,
    lakh: 100000,
  },
  bn: {
    শূন্য: 0,
    এক: 1,
    দুই: 2,
    দু: 2,
    তিন: 3,
    চার: 4,
    পাঁচ: 5,
    ছয়: 6,
    ছয়: 6,
    সাত: 7,
    আট: 8,
    নয়: 9,
    নয়: 9,
    দশ: 10,
    এগারো: 11,
    বারো: 12,
    তেরো: 13,
    চৌদ্দ: 14,
    পনেরো: 15,
    ষোলো: 16,
    সতেরো: 17,
    আঠারো: 18,
    উনিশ: 19,
    কুড়ি: 20,
    কুড়ি: 20,
    ত্রিশ: 30,
    চল্লিশ: 40,
    পঞ্চাশ: 50,
    ষাট: 60,
    সত্তর: 70,
    আশি: 80,
    নব্বই: 90,
    শত: 100,
    শো: 100,
    হাজার: 1000,
    লাখ: 100000,
    ek: 1,
    dui: 2,
    du: 2,
    tin: 3,
    char: 4,
    pach: 5,
    choy: 6,
    sat: 7,
    aat: 8,
    noy: 9,
    dosh: 10,
    kuri: 20,
    sho: 100,
    shoto: 100,
    hajar: 1000,
    lakh: 100000,
  },
  as: {
    শূন্য: 0,
    এক: 1,
    দুই: 2,
    দু: 2,
    তিনি: 3,
    তিন: 3,
    চাৰি: 4,
    চাৰ: 4,
    পাঁচ: 5,
    ছয়: 6,
    ছয়: 6,
    সাত: 7,
    আঠ: 8,
    ন: 9,
    দহ: 10,
    এঘাৰ: 11,
    বাৰ: 12,
    তেৰ: 13,
    চৈধ্য: 14,
    পোন্ধৰ: 15,
    ষোল: 16,
    সোতৰ: 17,
    ওঠৰ: 18,
    ঊনৈশ: 19,
    কুৰি: 20,
    ত্ৰিশ: 30,
    চল্লিশ: 40,
    পঞ্চাশ: 50,
    ষাঠি: 60,
    সত্তৰ: 70,
    আশী: 80,
    নব্বৈ: 90,
    শত: 100,
    শ: 100,
    হাজাৰ: 1000,
    লাখ: 100000,
    ek: 1,
    dui: 2,
    du: 2,
    tin: 3,
    saari: 4,
    sari: 4,
    panch: 5,
    sat: 7,
    aath: 8,
    dah: 10,
    sho: 100,
    xho: 100,
    hajar: 1000,
    lakh: 100000,
  },
};

const YES_WORDS: Partial<Record<LangCode, readonly string[]>> = {
  en: ["yes", "yeah", "yep", "correct"],
  hi: ["yes", "haan", "han", "ha", "हाँ", "हां", "जी", "सही"],
  bn: ["yes", "হ্যাঁ", "হা", "জি", "ঠিক"],
  as: ["yes", "হয়", "হয়", "হাঁ", "হা", "ঠিক"],
};

const NO_WORDS: Partial<Record<LangCode, readonly string[]>> = {
  en: ["no", "nope", "wrong"],
  hi: ["no", "nahi", "nahin", "नहीं", "नही", "गलत"],
  bn: ["no", "না", "নয়", "নয়", "ভুল"],
  as: ["no", "নহয়", "নহয়", "নাই", "ভুল"],
};

const ENGLISH_DATES: Record<string, string> = {
  today: "today",
  "today itself": "today",
  "in three days": "in3days",
  "in 3 days": "in3days",
  "three days": "in3days",
  "in a week": "in1week",
  "in 1 week": "in1week",
  "one week": "in1week",
  "in two weeks": "in2weeks",
  "in 2 weeks": "in2weeks",
  "in a month": "in1month",
  "in 1 month": "in1month",
  "no hurry": "noHurry",
  "not in a hurry": "noHurry",
};

const LOCAL_DATES: Partial<Record<LangCode, Record<string, string>>> = {
  hi: {
    आज: "today",
    "आज ही": "today",
    "तीन दिन": "in3days",
    "3 दिन": "in3days",
    "तीन दिनों में": "in3days",
    "एक हफ़्ते में": "in1week",
    "एक हफ्ते में": "in1week",
    "एक सप्ताह": "in1week",
    "दो हफ़्ते में": "in2weeks",
    "दो हफ्ते में": "in2weeks",
    "एक महीने में": "in1month",
    "कोई जल्दी नहीं": "noHurry",
  },
  bn: {
    আজ: "today",
    আজই: "today",
    "তিন দিন": "in3days",
    "৩ দিন": "in3days",
    "এক সপ্তাহ": "in1week",
    "এক সপ্তাহে": "in1week",
    "দুই সপ্তাহ": "in2weeks",
    "এক মাস": "in1month",
    "তাড়া নেই": "noHurry",
    "তাড়া নেই": "noHurry",
  },
  as: {
    আজি: "today",
    "আজিৰ দিনা": "today",
    "তিনি দিন": "in3days",
    "৩ দিন": "in3days",
    "এটা সপ্তাহ": "in1week",
    "দুই সপ্তাহ": "in2weeks",
    এমাহ: "in1month",
    "জৰুৰী নহয়": "noHurry",
    "জৰুৰী নহয়": "noHurry",
  },
};

const SLOT_ORDER: Record<FarmerIntent, readonly ConversationSlot[]> = {
  sell: ["name", "place", "crop", "quantity", "cashBy", "owes", "debt"],
  money: ["name", "place", "crop", "quantity", "amountNeeded", "neededBy"],
  price: ["place", "crop"],
  other: ["other"],
};

const QUESTION_KEYS: Record<ExtractableSlot, StringKey> = {
  intent: "chooseIntent",
  name: "questionName",
  place: "questionPlace",
  crop: "questionCrop",
  quantity: "questionQuantity",
  cashBy: "questionCashBy",
  owes: "questionOwes",
  debt: "questionDebt",
  amountNeeded: "questionAmountNeeded",
  neededBy: "questionNeededBy",
  other: "questionOther",
};

const INTENT_LABEL_KEYS: Record<FarmerIntent, StringKey> = {
  sell: "intentSell",
  money: "intentMoney",
  price: "intentPrice",
  other: "intentOther",
};

function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFC")
    .replace(/[?!.,।،]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(utterance: string, language: LangCode): number | null {
  const text = normalize(utterance).replace(/[₹,]/g, " ");
  const digits = text.match(/(?:^|\s)(\d+(?:\.\d+)?)(?:\s|$)/)?.[1];
  if (digits) {
    const number = Number(digits);
    return Number.isFinite(number) ? number : null;
  }

  const localWords = NUMBER_WORDS[language] ?? {};
  const words = { ...NUMBER_WORDS.en, ...localWords };
  let total = 0;
  let current = 0;
  let found = false;
  for (const token of text.split(/[\s-]+/).filter(Boolean)) {
    if (["and", "और", "ও", "আৰু"].includes(token)) continue;
    const number = words[token];
    if (number === undefined) continue;
    found = true;
    if (number === 100) current = (current || 1) * 100;
    else if (number === 1000 || number === 100000) {
      total += (current || 1) * number;
      current = 0;
    } else current += number;
  }
  return found ? total + current : null;
}

function extractCrop(utterance: string): string | null {
  const text = normalize(utterance);
  for (const crop of sampleData.crops) {
    const aliases = CROP_ALIASES[crop.id] ?? [crop.id, crop.nameKey.toLocaleLowerCase()];
    if (aliases.some((alias) => text.includes(normalize(alias)))) return crop.id;
  }
  return null;
}

function extractIntent(utterance: string, language: LangCode): FarmerIntent | null {
  const text = normalize(utterance);
  const local = LOCAL_INTENT_ALIASES[language];
  for (const intent of FARMER_INTENTS) {
    const aliases = [...ENGLISH_INTENT_ALIASES[intent], ...(local?.[intent] ?? [])];
    if (aliases.some((alias) => normalize(alias) === text)) return intent;
  }
  return null;
}

function stripAnswerPrefix(value: string): string {
  return value
    .trim()
    .replace(
      /^(?:my name is|i am|i'm|from|village is|mera naam|मेरा नाम(?: है)?|আমি|মোৰ নাম|মই|আমার গ্রাম|আমাৰ গাঁও)\s*/i,
      "",
    )
    .trim();
}

function wordsFor(language: LangCode, kind: "yes" | "no"): readonly string[] {
  const common = kind === "yes" ? ["yes"] : ["no"];
  const localized = (kind === "yes" ? YES_WORDS : NO_WORDS)[language] ?? [];
  return [...common, ...localized];
}

export class RuleBasedSlotExtractor implements SlotExtractor {
  extract(slot: ExtractableSlot, utterance: string, language: LangCode): SlotExtraction {
    const text = utterance.trim();
    if (!text) return { value: null, confidence: 0 };

    if (slot === "intent") {
      const value = extractIntent(text, language);
      return { value, confidence: value ? 0.96 : 0 };
    }
    if (slot === "crop") {
      const value = extractCrop(text);
      return { value, confidence: value ? 0.96 : 0 };
    }
    if (slot === "owes") {
      const answer = normalize(text);
      const yes = wordsFor(language, "yes").some((word) => normalize(word) === answer);
      const no = wordsFor(language, "no").some((word) => normalize(word) === answer);
      return { value: yes ? true : no ? false : null, confidence: yes || no ? 0.97 : 0 };
    }
    if (slot === "quantity" || slot === "debt" || slot === "amountNeeded") {
      const value = parseNumber(text, language);
      return {
        value: value !== null && value > 0 ? value : null,
        confidence: value !== null && value > 0 ? 0.95 : 0,
      };
    }
    if (slot === "cashBy" || slot === "neededBy") {
      const answer = normalize(text);
      const value = LOCAL_DATES[language]?.[answer] ?? ENGLISH_DATES[answer] ?? null;
      return { value, confidence: value ? 0.9 : 0 };
    }
    if (
      slot === "name" &&
      /^(?:skip|prefer not to say|छोड़ें|নাম বলতে চাই না|নাম ক'ব নিবিচাৰোঁ)$/i.test(normalize(text))
    ) {
      return { value: null, confidence: 0.98 };
    }
    if (slot === "other") return { value: text, confidence: text.length >= 2 ? 0.85 : 0 };

    const value = stripAnswerPrefix(text);
    if (slot === "place") {
      const pin = value.match(/\b\d{6}\b/);
      if (pin) return { value: pin[0], confidence: 0.95 };
      return { value: value.length >= 2 ? value : null, confidence: value.length >= 2 ? 0.85 : 0 };
    }
    if (slot === "name") {
      return { value: value.length >= 2 ? value : null, confidence: value.length >= 2 ? 0.85 : 0 };
    }
    return { value: null, confidence: 0 };
  }
}

export function createConversation(usedVoice = false): ConversationState {
  return {
    stage: "intent",
    intent: null,
    slot: "intent",
    answers: {},
    pendingValue: null,
    retryCount: 0,
    usedVoice,
  };
}

export function getQuestion(slot: ExtractableSlot, language: LangCode): string {
  const key = QUESTION_KEYS[slot];
  return STRINGS[language]?.[key] ?? STRINGS.en[key] ?? key;
}

export function getIntentOptions(
  language: LangCode,
): Array<{ intent: FarmerIntent; label: string }> {
  return FARMER_INTENTS.map((intent) => {
    const key = INTENT_LABEL_KEYS[intent];
    return { intent, label: STRINGS[language]?.[key] ?? STRINGS.en[key] ?? key };
  });
}

function formatValue(slot: ExtractableSlot, value: SlotValue, language: LangCode): string {
  if (slot === "intent" && typeof value === "string" && isIntent(value)) {
    return getIntentOptions(language).find((option) => option.intent === value)!.label;
  }
  if (slot === "crop" && typeof value === "string") {
    const crop = sampleData.crops.find((item) => item.id === value);
    if (crop) return STRINGS[language]?.[crop.nameKey] ?? STRINGS.en[crop.nameKey] ?? crop.id;
    return value;
  }
  if (slot === "name" && value === null) {
    return STRINGS[language]?.skip ?? STRINGS.en.skip ?? "Skip";
  }
  if (slot === "cashBy" || slot === "neededBy") {
    const dateLabelKeys = {
      today: "today",
      in3days: "in3days",
      in1week: "in1week",
      in2weeks: "in2weeks",
      in1month: "in1month",
      noHurry: "noHurry",
    } as const satisfies Record<string, StringKey>;
    const key = dateLabelKeys[String(value) as keyof typeof dateLabelKeys];
    return (key && STRINGS[language]?.[key]) ?? (key && STRINGS.en[key]) ?? String(value ?? "");
  }
  if (slot === "owes" && typeof value === "boolean") {
    const key = value ? "oweYesLabel" : "oweNoLabel";
    return STRINGS[language]?.[key] ?? STRINGS.en[key] ?? (value ? "Yes" : "No");
  }
  return String(value ?? "");
}

export function getConfirmation(
  slot: ExtractableSlot,
  value: SlotValue,
  language: LangCode,
): string {
  const template =
    STRINGS[language]?.confirmationTemplate ??
    STRINGS.en.confirmationTemplate ??
    "You said {value}. Is that correct?";
  return template.replace("{value}", formatValue(slot, value, language));
}

function isIntent(value: unknown): value is FarmerIntent {
  return typeof value === "string" && FARMER_INTENTS.some((intent) => intent === value);
}

function isSlotValue(slot: ExtractableSlot, value: SlotValue): boolean {
  if (slot === "intent") return isIntent(value);
  if (slot === "name")
    return value === null || (typeof value === "string" && value.trim().length >= 2);
  if (slot === "place" || slot === "other")
    return typeof value === "string" && value.trim().length >= 2;
  if (slot === "crop")
    return typeof value === "string" && sampleData.crops.some((crop) => crop.id === value);
  if (slot === "owes") return typeof value === "boolean";
  if (slot === "quantity" || slot === "debt" || slot === "amountNeeded")
    return typeof value === "number" && Number.isFinite(value) && value > 0;
  if (slot === "cashBy" || slot === "neededBy")
    return (
      typeof value === "string" &&
      ["today", "in3days", "in1week", "in2weeks", "in1month", "noHurry"].includes(value)
    );
  return false;
}

function askAgainOrFallback(state: ConversationState, usedVoice: boolean): ConversationState {
  const retryCount = state.retryCount + 1;
  return {
    ...state,
    stage: retryCount >= 2 ? "fallback" : "asking",
    slot: retryCount >= 2 && state.slot === "other" ? "intent" : state.slot,
    pendingValue: null,
    retryCount,
    usedVoice: state.usedVoice || usedVoice,
  };
}

export function submitVoiceAnswer(
  state: ConversationState,
  utterance: string,
  language: LangCode,
  extractor: SlotExtractor,
): ConversationState {
  if (state.stage !== "intent" && state.stage !== "asking") return state;
  const extraction = extractor.extract(state.slot, utterance, language);
  if (
    !Number.isFinite(extraction.confidence) ||
    extraction.confidence < 0.8 ||
    !isSlotValue(state.slot, extraction.value)
  ) {
    return askAgainOrFallback(state, true);
  }
  return { ...state, stage: "confirming", pendingValue: extraction.value, usedVoice: true };
}

export function submitTapAnswer(state: ConversationState, value: SlotValue): ConversationState {
  if (
    (state.stage !== "intent" && state.stage !== "asking" && state.stage !== "fallback") ||
    !isSlotValue(state.slot, value)
  ) {
    return state;
  }
  return { ...state, stage: "confirming", pendingValue: value };
}

function saveAnswer(answers: SlotAnswers, slot: ConversationSlot, value: SlotValue): SlotAnswers {
  if (slot === "name" && (typeof value === "string" || value === null))
    return { ...answers, name: value };
  if ((slot === "place" || slot === "other") && typeof value === "string")
    return { ...answers, [slot]: value };
  if (slot === "crop" && typeof value === "string") return { ...answers, crop: value };
  if (slot === "quantity" && typeof value === "number") return { ...answers, quantity: value };
  if ((slot === "cashBy" || slot === "neededBy") && typeof value === "string")
    return { ...answers, [slot]: value };
  if (slot === "owes" && typeof value === "boolean") return { ...answers, owes: value };
  if (slot === "debt" && typeof value === "number") return { ...answers, debt: value };
  if (slot === "amountNeeded" && typeof value === "number")
    return { ...answers, amountNeeded: value };
  return answers;
}

function nextSlot(
  intent: FarmerIntent,
  current: ExtractableSlot,
  answers: SlotAnswers,
): ConversationSlot | null {
  if (current === "owes" && answers.owes === false) return null;
  const sequence = SLOT_ORDER[intent];
  const index = sequence.indexOf(current as ConversationSlot);
  return sequence[index + 1] ?? null;
}

export function confirmAnswer(state: ConversationState, accepted: boolean): ConversationState {
  if (state.stage !== "confirming" || !isSlotValue(state.slot, state.pendingValue)) return state;
  if (!accepted) return askAgainOrFallback(state, false);

  if (state.slot === "intent" && isIntent(state.pendingValue)) {
    const intent = state.pendingValue;
    return {
      ...state,
      stage: "asking",
      intent,
      slot: SLOT_ORDER[intent][0]!,
      pendingValue: null,
      retryCount: 0,
    };
  }
  if (!state.intent || state.slot === "intent") return state;

  const answers = saveAnswer(state.answers, state.slot, state.pendingValue);
  const following = nextSlot(state.intent, state.slot, answers);
  return {
    ...state,
    stage: following ? "asking" : "complete",
    slot: following ?? state.slot,
    answers,
    pendingValue: null,
    retryCount: 0,
  };
}
