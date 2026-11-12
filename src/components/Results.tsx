import { Link } from "@tanstack/react-router";
import {
  HandCoins,
  Store,
  Users,
  Warehouse,
  CheckCircle2,
  XCircle,
  Volume2,
  Square,
  ArrowLeft,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/Screen";
import { useI18n } from "@/lib/i18n";
import { useCardSpeech } from "@/hooks/use-card-speech";
import { buildResults, type OptionKind } from "@/services/results";
import { sampleData } from "@/services/sample-data";
import type { StringKey } from "@/i18n/translations";

const DETAILS: Record<OptionKind, { icon: typeof Store; title: StringKey; reason: StringKey }> = {
  trader: { icon: HandCoins, title: "optionTrader", reason: "reasonTrader" },
  mandi: { icon: Store, title: "optionMandi", reason: "reasonMandi" },
  pool: { icon: Users, title: "optionPool", reason: "reasonPool" },
  warehouse: { icon: Warehouse, title: "optionWarehouse", reason: "reasonWarehouse" },
};

export function Results() {
  const { t, lang, crop, sale } = useI18n();
  const speech = useCardSpeech(lang);
  const options = crop ? buildResults(crop, sale) : [];
  const cropRecord = sampleData.crops.find((item) => item.id === crop);
  const money = (value: number) => value.toLocaleString(lang, { maximumFractionDigits: 0 });
  const text = (key: StringKey, values: Record<string, string | number> = {}) =>
    Object.entries(values).reduce(
      (value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)),
      t(key),
    );
  const summary = cropRecord
    ? text("resultsSummary", { crop: t(cropRecord.nameKey), quantity: sale.qty })
    : "";
  const cashDateKey = sale.cashBy as
    "today" | "in3days" | "in1week" | "in2weeks" | "in1month" | "noHurry" | null;
  const deadlineSummary = cashDateKey ? text("deadlineSummary", { date: t(cashDateKey) }) : "";
  const spokenOptions = options.map((option, index) => {
    const detail = DETAILS[option.kind];
    const range = [
      text("rangeLow", { amount: money(option.priceRange.low) }),
      text("rangeExpected", { amount: money(option.priceRange.expected) }),
      text("rangeHigh", { amount: money(option.priceRange.high) }),
    ];
    const cashTiming = text(option.cashDays === 0 ? "cashToday" : "cashTiming", {
      days: option.cashDays,
      amount: money(option.cashAvailable),
    });
    const loanCash = text("loanCash", { amount: money(option.receiptLoan) });
    const eventual = text("eventualMoney", {
      days: sampleData.sellingAssumptions.warehouseSaleDays,
    });
    return [
      text("rankedOption", { rank: index + 1 }),
      t(detail.title),
      text("keepMoney", { amount: money(option.youKeep) }),
      option.repayment > 0 ? t("afterTraderDebt") : "",
      t("priceRangeLabel"),
      ...range,
      t(option.priceRange.confidenceNoteKey),
      t(option.meetsDeadline ? "cashYes" : "cashNo"),
      cashTiming,
      t(detail.reason),
      option.kind === "warehouse" ? eventual : "",
      option.kind === "warehouse" ? loanCash : "",
      ...(option.kind !== "trader" && option.repayment > 0
        ? [
            text("extraIncome", { amount: money(option.extraIncome) }),
            text("traderRepayment", { amount: money(option.repayment) }),
            t("switchingUnknown"),
          ]
        : []),
    ]
      .filter(Boolean)
      .join(". ");
  });
  const fullResultSpeech = [
    t("thankYou"),
    t("sampleDataNote"),
    summary,
    deadlineSummary,
    typeof sale.amountNeeded === "number"
      ? text("moneyGoal", { amount: money(sale.amountNeeded) })
      : "",
    ...spokenOptions,
    t("youDecide"),
    t("sampleLocationNote"),
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <Screen step={7} title={t("resultsTitle")} helpKey="helpResults">
      {options.length === 0 ? (
        <div className="space-y-5">
          <p>{t("incompleteResults")}</p>
          <Button asChild className="min-h-14 w-full whitespace-normal text-lg">
            <Link to="/">
              <ArrowLeft aria-hidden />
              {t("startAgain")}
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-5 space-y-1">
            <p className="font-semibold">{t("thankYou")}</p>
            <p className="text-xl font-bold">{summary}</p>
            <p>{deadlineSummary}</p>
            {typeof sale.amountNeeded === "number" && (
              <p>{text("moneyGoal", { amount: money(sale.amountNeeded) })}</p>
            )}
            <p className="text-muted-foreground">{t("youDecide")}</p>
          </div>
          <Button
            variant="outline"
            className="mb-5 min-h-14 w-full whitespace-normal text-lg [&_svg]:size-6"
            aria-pressed={speech.reading === "all-results"}
            disabled={!speech.voiceAvailable && !speech.canUseBhashini}
            onClick={() => speech.speak("all-results", fullResultSpeech)}
          >
            {speech.reading === "all-results" ? <Square aria-hidden /> : <Volume2 aria-hidden />}
            {t(speech.reading === "all-results" ? "stopReading" : "readResult")}
          </Button>
          <ol className="grid gap-5">
            {options.map((option, index) => {
              const detail = DETAILS[option.kind];
              const Icon = detail.icon;
              const CashIcon = option.meetsDeadline ? CheckCircle2 : XCircle;
              const cashLabel = t(option.meetsDeadline ? "cashYes" : "cashNo");
              const keep = text("keepMoney", { amount: money(option.youKeep) });
              const range = [
                text("rangeLow", { amount: money(option.priceRange.low) }),
                text("rangeExpected", { amount: money(option.priceRange.expected) }),
                text("rangeHigh", { amount: money(option.priceRange.high) }),
              ];
              const cashTiming = text(option.cashDays === 0 ? "cashToday" : "cashTiming", {
                days: option.cashDays,
                amount: money(option.cashAvailable),
              });
              const extra = text("extraIncome", { amount: money(option.extraIncome) });
              const repayment = text("traderRepayment", { amount: money(option.repayment) });
              const loan = text("loanCash", { amount: money(option.receiptLoan) });
              const eventual = text("eventualMoney", {
                days: sampleData.sellingAssumptions.warehouseSaleDays,
              });
              const spoken = [
                t("sampleData"),
                t("sampleLocationNote"),
                summary,
                deadlineSummary,
                text("rankedOption", { rank: index + 1 }),
                t(detail.title),
                keep,
                option.repayment > 0 ? t("afterTraderDebt") : "",
                option.kind === "warehouse" ? eventual : "",
                t("priceRangeLabel"),
                ...range,
                t(option.priceRange.confidenceNoteKey),
                cashLabel,
                cashTiming,
                t(detail.reason),
                option.kind === "warehouse" ? loan : "",
                ...(option.kind !== "trader" && option.repayment > 0
                  ? [extra, repayment, t("switchingUnknown")]
                  : []),
              ]
                .filter(Boolean)
                .join(". ");
              return (
                <li key={option.kind}>
                  <article
                    className="rounded-lg border-2 border-border bg-card p-4 text-card-foreground"
                    aria-labelledby={`title-${option.kind}`}
                  >
                    <p className="mb-2 text-lg font-semibold text-muted-foreground">
                      {text("rankedOption", { rank: index + 1 })}
                    </p>
                    <h2
                      id={`title-${option.kind}`}
                      className="mb-4 flex items-start gap-3 font-display text-2xl font-bold leading-tight"
                    >
                      <Icon className="size-8 shrink-0 text-primary" aria-hidden />
                      {t(detail.title)}
                    </h2>
                    <p className="mb-1 break-words font-display text-4xl font-bold leading-tight text-primary">
                      {keep}
                    </p>
                    {option.repayment > 0 && (
                      <p className="text-muted-foreground">{t("afterTraderDebt")}</p>
                    )}
                    {option.kind === "warehouse" && (
                      <p className="text-muted-foreground">{eventual}</p>
                    )}
                    <div className="my-4 border-y border-border py-3">
                      <p className="mb-2 font-semibold">{t("priceRangeLabel")}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {range.map((value) => (
                          <span key={value}>{value}</span>
                        ))}
                      </div>
                      <p className="mt-2 text-muted-foreground">
                        {t(option.priceRange.confidenceNoteKey)}
                      </p>
                    </div>
                    <p className="flex items-center gap-2 font-bold">
                      <CashIcon
                        className={`size-7 shrink-0 ${option.meetsDeadline ? "text-primary" : "text-destructive"}`}
                        aria-hidden
                      />
                      {cashLabel}
                    </p>
                    <p className="mt-1">{cashTiming}</p>
                    <p className="my-3">{t(detail.reason)}</p>
                    {option.kind === "warehouse" && (
                      <p className="mb-3 flex gap-2 text-muted-foreground">
                        <Wallet className="size-6 shrink-0" aria-hidden />
                        {loan}
                      </p>
                    )}
                    {option.kind !== "trader" && option.repayment > 0 && (
                      <div className="mb-4 border-t border-border pt-3">
                        <p className="mb-2 font-semibold">{t("debtCompare")}</p>
                        <div className="grid grid-cols-2 gap-3">
                          <p className="font-bold">{extra}</p>
                          <p>{repayment}</p>
                        </div>
                        <p className="mt-2 text-muted-foreground">{t("switchingUnknown")}</p>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      className="min-h-14 w-full whitespace-normal text-lg [&_svg]:size-6"
                      aria-label={`${t(speech.reading === option.kind ? "stopReading" : "readCard")}: ${t(detail.title)}`}
                      aria-pressed={speech.reading === option.kind}
                      disabled={!speech.voiceAvailable && !speech.canUseBhashini}
                      onClick={() => speech.speak(option.kind, spoken)}
                    >
                      {speech.reading === option.kind ? (
                        <Square aria-hidden />
                      ) : (
                        <Volume2 aria-hidden />
                      )}
                      {t(speech.reading === option.kind ? "stopReading" : "readCard")}
                    </Button>
                  </article>
                </li>
              );
            })}
          </ol>
          {!speech.apiSupported && speech.failed && (
            <p className="mt-4" role="status">
              {t("speechUnavailable")}
            </p>
          )}
          {speech.failed && !speech.voiceAvailable && (
            <p className="mt-4" role="status">
              {t("speechLanguageUnavailable")}
            </p>
          )}
          {speech.failed && (
            <p className="mt-4" role="status">
              {t("speechFailed")}
            </p>
          )}
          <p className="mt-5 text-muted-foreground">{t("sampleLocationNote")}</p>
          {!["en", "hi", "bn", "as"].includes(lang) && (
            <p className="mt-3 text-sm text-muted-foreground">{t("translationReviewNote")}</p>
          )}
        </>
      )}
    </Screen>
  );
}
