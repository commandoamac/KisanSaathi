import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, IndianRupee } from "lucide-react";
import { Screen } from "@/components/Screen";
import { useI18n } from "@/lib/i18n";

const QUICK = [1000, 5000, 10000];

export const Route = createFileRoute("/debt-amount")({
  head: () => ({
    meta: [
      { title: "KisanSaathi — Loan amount" },
      { name: "description", content: "Tell KisanSaathi how much you owe your trader." },
      { property: "og:title", content: "KisanSaathi — Loan amount" },
      { property: "og:description", content: "How much do you owe?" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DebtAmountPage,
});

function DebtAmountPage() {
  const { t, sale, updateSale } = useI18n();
  const navigate = useNavigate();
  return (
    <Screen
      step={6}
      title={t("howMuchOwe")}
      helpKey="helpOwe"
      footer={
        <button
          className="ks-btn w-full"
          disabled={sale.debt <= 0}
          onClick={() => navigate({ to: "/thinking" })}
        >
          <span>{t("next")}</span>
          <ArrowRight className="size-7 rtl:rotate-180" aria-hidden />
        </button>
      }
    >
      <label className="relative block">
        <IndianRupee
          className="pointer-events-none absolute start-4 top-1/2 size-8 -translate-y-1/2 text-primary"
          aria-hidden
        />
        <span className="sr-only">{t("howMuchOwe")}</span>
        <input
          className="ks-input ps-14 text-3xl tabular-nums"
          inputMode="numeric"
          value={sale.debt ? String(sale.debt) : ""}
          onChange={(e) => updateSale({ debt: Number(e.target.value.replace(/\D/g, "")) || 0 })}
          placeholder="0"
        />
      </label>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {QUICK.map((n) => (
          <button
            key={n}
            onClick={() => updateSale({ debt: sale.debt + n })}
            className="ks-chip justify-center text-xl"
          >
            +₹{n.toLocaleString("en-IN")}
          </button>
        ))}
      </div>
    </Screen>
  );
}
