import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, MapPin, LocateFixed } from "lucide-react";
import { Screen } from "@/components/Screen";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/place")({
  head: () => ({
    meta: [
      { title: "KisanSaathi — Your village" },
      {
        name: "description",
        content: "Tell KisanSaathi your village or PIN code to find nearby markets.",
      },
      { property: "og:title", content: "KisanSaathi — Your village" },
      { property: "og:description", content: "Find markets near your village." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlacePage,
});

function PlacePage() {
  const { t, sale, updateSale } = useI18n();
  const navigate = useNavigate();
  const ok = sale.place.trim().length >= 2;

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) =>
        updateSale({ place: `${p.coords.latitude.toFixed(3)}, ${p.coords.longitude.toFixed(3)}` }),
      () => {},
    );
  };

  return (
    <Screen
      step={4}
      title={t("whereVillage")}
      helpKey="helpPlace"
      footer={
        <button
          className="ks-btn w-full"
          disabled={!ok}
          onClick={() => navigate({ to: "/cash-date" })}
        >
          <span>{t("next")}</span>
          <ArrowRight className="size-7 rtl:rotate-180" aria-hidden />
        </button>
      }
    >
      <label className="relative block">
        <MapPin
          className="pointer-events-none absolute start-4 top-1/2 size-7 -translate-y-1/2 text-primary"
          aria-hidden
        />
        <span className="sr-only">{t("villagePlaceholder")}</span>
        <input
          className="ks-input ps-14"
          value={sale.place}
          onChange={(e) => updateSale({ place: e.target.value })}
          placeholder={t("villagePlaceholder")}
          autoComplete="postal-code"
        />
      </label>
      <button onClick={locate} className="ks-chip mt-4 w-full justify-center py-3 text-xl">
        <LocateFixed className="size-7 text-primary" aria-hidden />
        <span>{t("useLocation")}</span>
      </button>
    </Screen>
  );
}
