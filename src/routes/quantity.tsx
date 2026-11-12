import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, ArrowRight, Scale } from "lucide-react";
import { Screen } from "@/components/Screen";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/quantity")({
  head: () => ({
    meta: [
      { title: "KisanSaathi — How much to sell" },
      { name: "description", content: "Tell KisanSaathi how many quintals you want to sell." },
      { property: "og:title", content: "KisanSaathi — How much to sell" },
      { property: "og:description", content: "Set your crop quantity in quintals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuantityPage,
});

function QuantityPage() {
  const { t, crop, sale, updateSale } = useI18n();
  const navigate = useNavigate();
  const qty = sale.qty;
  const setQty = (f: (q: number) => number) => updateSale({ qty: f(qty) });
  return (
    <Screen
      step={3}
      title={t("howMuch")}
      helpKey="helpQuantity"
      footer={
        <button
          className="ks-btn w-full"
          disabled={qty < 1}
          onClick={() => navigate({ to: "/place" })}
        >
          <span>{t("next")}</span>
          <ArrowRight className="size-7 rtl:rotate-180" aria-hidden />
        </button>
      }
    >
      {crop && <p className="mb-6 text-xl text-muted-foreground">{t(crop)}</p>}
      <div className="flex flex-col items-center gap-6 rounded-3xl border-2 border-border bg-card p-6">
        <Scale className="size-12 text-primary" aria-hidden />
        <div className="text-center" aria-live="polite">
          <div className="font-display text-7xl font-bold tabular-nums">{qty}</div>
          <div className="text-2xl font-semibold">{t("quintal")}</div>
        </div>
        <div className="grid w-full grid-cols-2 gap-4">
          <button
            onClick={() => setQty((q) => Math.max(0, q - 1))}
            disabled={qty === 0}
            className="ks-step"
            aria-label={t("less")}
          >
            <Minus className="size-10" aria-hidden />
            <span>{t("less")}</span>
          </button>
          <button
            onClick={() => setQty((q) => q + 1)}
            className="ks-step ks-step-plus"
            aria-label={t("more")}
          >
            <Plus className="size-10" aria-hidden />
            <span>{t("more")}</span>
          </button>
        </div>
      </div>
    </Screen>
  );
}
