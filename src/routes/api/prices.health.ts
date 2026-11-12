import { createFileRoute } from "@tanstack/react-router";

import { getPriceRuntime } from "@/services/market-prices";

const RESOURCE_ID = "35985678-0d79-46b4-9ed6-6f13308a1d24";
const REQUEST_TIMEOUT_MS = 10_000;

type PriceCountRow = { rowCount: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getBindings(context: unknown): Record<string, unknown> {
  if (!isRecord(context)) return {};
  return isRecord(context["env"]) ? context["env"] : context;
}

function getTodayInIndia(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return `${values["year"]}-${values["month"]}-${values["day"]}`;
}

async function checkDataGovApi(
  apiKey: string | undefined,
  resourceId: string,
): Promise<number | null> {
  if (!apiKey) return null;

  const url = new URL(`https://api.data.gov.in/resource/${encodeURIComponent(resourceId)}`);
  url.searchParams.set("api-key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("filters[State]", "West Bengal");
  url.searchParams.set("filters[Commodity]", "Potato");
  url.searchParams.set("filters[Arrival_Date]", getTodayInIndia().split("-").reverse().join("-"));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.status;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export const Route = createFileRoute("/api/prices/health")({
  server: {
    handlers: {
      GET: async ({ context }) => {
        const bindings = getBindings(context);
        const configuredKey = bindings["DATA_GOV_IN_API_KEY"];
        const apiKey =
          typeof configuredKey === "string" && configuredKey.trim() ? configuredKey : undefined;
        const configuredResource = bindings["AGMARKNET_RESOURCE_ID"];
        const resourceId =
          typeof configuredResource === "string" && configuredResource.trim()
            ? configuredResource
            : RESOURCE_ID;
        const runtime = getPriceRuntime(context);

        let databaseAvailable = false;
        let priceRowCount: number | null = null;
        if (runtime) {
          try {
            const result = await runtime.db
              .prepare("SELECT COUNT(*) AS rowCount FROM price_reports")
              .first<PriceCountRow>();
            if (result && Number.isFinite(result.rowCount)) {
              priceRowCount = result.rowCount;
              databaseAvailable = true;
            }
          } catch {
            databaseAvailable = false;
          }
        }

        const dataGovStatusCode = await checkDataGovApi(apiKey, resourceId);
        return Response.json({
          dataGovKeyConfigured: Boolean(apiKey),
          dataGovStatusCode,
          databaseAvailable,
          priceRowCount,
          latestArrivalDate: null,
        });
      },
    },
  },
});
