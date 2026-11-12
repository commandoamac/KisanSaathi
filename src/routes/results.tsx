import { createFileRoute } from "@tanstack/react-router";
import { Results } from "@/components/Results";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "KisanSaathi — Compare selling options" },
      {
        name: "description",
        content:
          "Compare sample net money, price ranges, cash timing and trader repayment across crop selling options.",
      },
      { property: "og:title", content: "KisanSaathi — Compare selling options" },
      {
        property: "og:description",
        content:
          "Sample selling choices with net income, deadline checks and spoken summaries. The farmer decides.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Results,
});
