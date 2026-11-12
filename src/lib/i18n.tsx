import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  LANGUAGE_LOCALES,
  STRINGS,
  type CropKey,
  type LangCode,
  type StringKey,
} from "@/i18n/translations";
import { GENERATED_TRANSLATIONS } from "@/i18n/generated-translations";

type Ctx = {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  t: (k: StringKey) => string;
  crop: CropKey | null;
  setCrop: (c: CropKey) => void;
  sale: Sale;
  updateSale: (p: Partial<Sale>) => void;
};

export type Sale = {
  qty: number;
  place: string;
  cashBy: string | null;
  owes: boolean | null;
  debt: number;
  amountNeeded?: number | null;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("en");
  const [crop, setCrop] = useState<CropKey | null>(null);
  const [sale, setSale] = useState<Sale>({
    qty: 1,
    place: "",
    cashBy: null,
    owes: null,
    debt: 0,
    amountNeeded: null,
  });
  const updateSale = (p: Partial<Sale>) => setSale((s) => ({ ...s, ...p }));

  useEffect(() => {
    document.documentElement.lang = LANGUAGE_LOCALES[lang];
  }, [lang]);

  const setLang = (l: LangCode) => {
    setLangState(l);
  };

  const t = (k: StringKey): string =>
    STRINGS[lang]?.[k] ?? GENERATED_TRANSLATIONS[lang]?.[k] ?? STRINGS.en[k] ?? k;

  return (
    <I18nContext.Provider value={{ lang, setLang, t, crop, setCrop, sale, updateSale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const c = useContext(I18nContext);
  if (!c) throw new Error("useI18n outside provider");
  return c;
}
