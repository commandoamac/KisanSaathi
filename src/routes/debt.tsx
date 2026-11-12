import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Screen } from "@/components/Screen";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/debt")({
  head: () => ({
    meta: [
      { title: "KisanSaathi — Trader loan" },
      { name: "description", content: "Tell KisanSaathi if you owe money to your trader." },
      { property: "og:title", content: "KisanSaathi — Trader loan" },
      { property: "og:description", content: "Do you owe money to your trader?" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DebtPage,
});

function DebtPage() {
  const { t, sale, updateSale } = useI18n();
  const navigate = useNavigate();
  return (
    <Screen step={6} title={t("owesTrader")} helpKey="helpDebt">
      <div className="grid gap-4">
        <button
          aria-pressed={sale.owes === true}
          onClick={() => {
            updateSale({ owes: true });
            navigate({ to: "/debt-amount" });
          }}
          className="ks-card flex min-h-[96px] items-center justify-center gap-3 text-3xl font-bold"
        >
          <ThumbsUp className="size-10 text-primary" aria-hidden />
          {t("yes")}
        </button>
        <button
          aria-pressed={sale.owes === false}
          onClick={() => {
            updateSale({ owes: false, debt: 0 });
            navigate({ to: "/thinking" });
          }}
          className="ks-card flex min-h-[96px] items-center justify-center gap-3 text-3xl font-bold"
        >
          <ThumbsDown className="size-10 text-muted-foreground" aria-hidden />
          {t("no")}
        </button>
      </div>
    </Screen>
  );
}
