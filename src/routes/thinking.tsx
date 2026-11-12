import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { IndianRupee, Wallet, TrendingUp, Landmark, Check, Loader2 } from "lucide-react";
import { Screen } from "@/components/Screen";
import { useI18n } from "@/lib/i18n";
import type { StringKey } from "@/i18n/translations";

const STEPS: { icon: typeof Wallet; title: StringKey; desc: StringKey }[] = [
  { icon: IndianRupee, title: "stepPrice", desc: "stepPriceDesc" },
  { icon: Wallet, title: "stepNet", desc: "stepNetDesc" },
  { icon: TrendingUp, title: "stepForecast", desc: "stepForecastDesc" },
  { icon: Landmark, title: "stepLoan", desc: "stepLoanDesc" },
];

export const Route = createFileRoute("/thinking")({
  head: () => ({
    meta: [
      { title: "KisanSaathi — Working it out" },
      {
        name: "description",
        content: "KisanSaathi checks price, net money, forecast and loan for you.",
      },
      { property: "og:title", content: "KisanSaathi — Working it out" },
      { property: "og:description", content: "Price, net money, forecast and loan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThinkingPage,
});

function ThinkingPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (active >= STEPS.length) {
      const id = setTimeout(() => navigate({ to: "/results", replace: true }), 350);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setActive((a) => a + 1), 1200);
    return () => clearTimeout(id);
  }, [active, navigate]);

  return (
    <Screen step={7} title={t("thinking")} helpKey="helpThinking">
      <ol className="grid gap-3">
        {STEPS.map((s, i) => {
          const state = i < active ? "done" : i === active ? "current" : "todo";
          const Icon = s.icon;
          return (
            <li
              key={s.title}
              aria-pressed={state === "current"}
              className={`ks-card flex min-h-[88px] items-center gap-4 p-4 ${state === "todo" ? "opacity-50" : ""}`}
            >
              <span
                className={`flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-primary ${state === "current" ? "ks-pulse" : ""}`}
              >
                <Icon className="size-8" aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block text-2xl font-bold">
                  {i + 1}. {t(s.title)}
                </span>
                <span className="block text-lg text-muted-foreground">{t(s.desc)}</span>
              </span>
              {state === "done" && <Check className="size-8 text-primary" aria-label={t("done")} />}
              {state === "current" && (
                <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </Screen>
  );
}
