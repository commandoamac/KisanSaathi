import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarClock, Check } from "lucide-react";
import { Screen } from "@/components/Screen";
import { useI18n } from "@/lib/i18n";
import type { StringKey } from "@/i18n/translations";

const OPTIONS: { key: StringKey; days: number | null }[] = [
  { key: "today", days: 0 },
  { key: "in3days", days: 3 },
  { key: "in1week", days: 7 },
  { key: "in2weeks", days: 14 },
  { key: "in1month", days: 30 },
  { key: "noHurry", days: null },
];

export const Route = createFileRoute("/cash-date")({
  head: () => ({
    meta: [
      { title: "KisanSaathi — When you need cash" },
      { name: "description", content: "Tell KisanSaathi by when you need money from your crop." },
      { property: "og:title", content: "KisanSaathi — When you need cash" },
      { property: "og:description", content: "Pick the day you need money." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CashDatePage,
});

function CashDatePage() {
  const { t, lang, sale, updateSale } = useI18n();
  const navigate = useNavigate();

  return (
    <Screen step={5} title={t("cashBy")} helpKey="helpDate">
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map((o) => {
          const d = o.days === null ? null : new Date(Date.now() + o.days * 86400000);
          const active = sale.cashBy === o.key;
          return (
            <button
              key={o.key}
              aria-pressed={active}
              onClick={() => {
                updateSale({ cashBy: o.key });
                navigate({ to: "/debt" });
              }}
              className="ks-card flex min-h-[120px] flex-col items-center justify-center gap-1 p-3"
            >
              {d ? (
                <span className="flex flex-col items-center leading-none text-primary">
                  <span className="text-base font-semibold uppercase">
                    {d.toLocaleDateString(lang, { month: "short" })}
                  </span>
                  <span className="font-display text-4xl font-bold">{d.getDate()}</span>
                </span>
              ) : (
                <CalendarClock className="size-10 text-primary" aria-hidden />
              )}
              <span className="flex items-center gap-1 text-xl font-bold">
                {active && <Check className="size-5 text-primary" aria-label="selected" />}
                {t(o.key)}
              </span>
            </button>
          );
        })}
      </div>
    </Screen>
  );
}
