import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Screen } from "@/components/Screen";
import { useI18n } from "@/lib/i18n";
import tomato from "@/assets/tomato.jpg";
import onion from "@/assets/onion.jpg";
import potato from "@/assets/potato.jpg";
import wheat from "@/assets/wheat.jpg";
import paddy from "@/assets/paddy.jpg";

const CROPS = [
  { key: "tomato", img: tomato },
  { key: "onion", img: onion },
  { key: "potato", img: potato },
  { key: "wheat", img: wheat },
  { key: "paddy", img: paddy },
] as const;

export const Route = createFileRoute("/crop")({
  head: () => ({
    meta: [
      { title: "KisanSaathi — Choose your crop" },
      {
        name: "description",
        content: "Pick the crop you want to sell: tomato, onion, potato, wheat or paddy.",
      },
      { property: "og:title", content: "KisanSaathi — Choose your crop" },
      { property: "og:description", content: "Pick the crop you want to sell." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CropPage,
});

function CropPage() {
  const { t, crop, setCrop } = useI18n();
  const navigate = useNavigate();
  return (
    <Screen step={2} title={t("chooseCrop")} helpKey="helpCrop">
      <div className="grid grid-cols-2 gap-4">
        {CROPS.map((c) => {
          const active = crop === c.key;
          return (
            <button
              key={c.key}
              aria-pressed={active}
              onClick={() => {
                setCrop(c.key);
                navigate({ to: "/quantity" });
              }}
              className="ks-card relative overflow-hidden p-0"
            >
              <img
                src={c.img}
                alt=""
                width={816}
                height={816}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
              <span className="flex min-h-[56px] items-center justify-center gap-2 px-2 text-2xl font-bold">
                {active && <Check className="size-6 text-primary" aria-label="selected" />}
                {t(c.key)}
              </span>
            </button>
          );
        })}
      </div>
    </Screen>
  );
}
