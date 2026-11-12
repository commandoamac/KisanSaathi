import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";

import {
  aggregateHistory,
  aggregateReports,
  buildMarketPrice,
  fetchOfficialPrices,
  getBearerToken,
  getPriceRuntime,
  hashToken,
  readJsonBody,
  type PriceReport,
} from "@/services/market-prices";

const requestSchema = z.object({
  crop: z.string().trim().min(1).max(64),
  market: z.string().trim().min(1).max(128),
  price_per_quintal: z.number().finite().positive().max(1_000_000),
});

type MarketRow = {
  id: string;
  name: string;
  district: string;
  state: string;
  lat: number | null;
  lng: number | null;
};

type CropRow = { id: string; name: string };
type ReporterRow = {
  id: string;
  role: "trader" | "shopkeeper";
  verified: number;
  is_sample: number;
};
type ReportRow = PriceReport & { market_id: string };

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function dateOffset(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export const Route = createFileRoute("/api/prices")({
  server: {
    handlers: {
      GET: async ({ request, context }) => {
        const runtime = getPriceRuntime(context);
        if (!runtime) return jsonResponse({ error: "Price database is not configured." }, 503);

        const url = new URL(request.url);
        const cropQuery = url.searchParams.get("crop")?.trim();
        const district = url.searchParams.get("district")?.trim();
        const rawDays = url.searchParams.get("days") ?? "7";
        const days = Number(rawDays);
        if (
          !cropQuery ||
          cropQuery.length > 64 ||
          !district ||
          district.length > 128 ||
          !/^\d{1,2}$/.test(rawDays) ||
          !Number.isInteger(days) ||
          days < 1 ||
          days > 30
        ) {
          return jsonResponse(
            { error: "Provide a crop, district, and days between 1 and 30." },
            400,
          );
        }

        const crop = await runtime.db
          .prepare("SELECT id, name FROM crops WHERE id = ? OR name = ? COLLATE NOCASE LIMIT 1")
          .bind(cropQuery, cropQuery)
          .first<CropRow>();
        if (!crop) return jsonResponse({ error: "Unknown crop." }, 404);

        const marketsResult = await runtime.db
          .prepare(
            "SELECT id, name, district, state, lat, lng FROM markets WHERE district = ? COLLATE NOCASE ORDER BY name",
          )
          .bind(district)
          .all<MarketRow>();
        const markets = marketsResult.results ?? [];
        if (markets.length === 0) {
          return jsonResponse({ crop: crop.id, district, days, prices: [] });
        }

        const reportRowsResult = await runtime.db
          .prepare(
            `SELECT p.market_id, p.price_per_quintal AS pricePerQuintal, p.created_at AS createdAt
             FROM price_reports p
             INNER JOIN markets m ON m.id = p.market_id
             INNER JOIN reporters r ON r.id = p.reporter_id
             WHERE p.crop_id = ? AND m.district = ? COLLATE NOCASE AND p.created_at >= ?
               AND r.verified = 1 AND r.is_sample = 0
             ORDER BY p.created_at`,
          )
          .bind(crop.id, district, dateOffset(days))
          .all<ReportRow>();
        const reportRows = reportRowsResult.results ?? [];
        const reportsByMarket = new Map<string, PriceReport[]>();
        for (const report of reportRows) {
          const reports = reportsByMarket.get(report.market_id) ?? [];
          reports.push({ pricePerQuintal: report.pricePerQuintal, createdAt: report.createdAt });
          reportsByMarket.set(report.market_id, reports);
        }

        const recentCutoff = dateOffset(1);
        const needsOfficial = markets.some((market) => {
          const recent = (reportsByMarket.get(market.id) ?? []).filter(
            (report) => report.createdAt >= recentCutoff,
          );
          return aggregateReports(recent) === null;
        });

        let officialByMarket = new Map();
        if (needsOfficial) {
          if (!runtime.dataGovInApiKey) {
            return jsonResponse(
              { error: "Official price fallback is not configured on the server." },
              503,
            );
          }
          try {
            officialByMarket = await fetchOfficialPrices(runtime, crop.name, district);
          } catch {
            return jsonResponse({ error: "Official price fallback is unavailable." }, 502);
          }
        }

        const prices = [];
        for (const market of markets) {
          const reports = reportsByMarket.get(market.id) ?? [];
          const recent = reports.filter((report) => report.createdAt >= recentCutoff);
          const official = officialByMarket.get(market.name.toLocaleLowerCase("en-IN")) ?? null;
          const price = buildMarketPrice(recent, official);
          if (!price) {
            return jsonResponse(
              {
                error: `No official price was available for ${market.name}, and fewer than three recent reports were received.`,
              },
              502,
            );
          }

          prices.push({
            market,
            price_per_quintal: price.pricePerQuintal,
            source: price.source,
            report_count: price.reportCount,
            last_updated: price.lastUpdated,
            ...(price.officialDate ? { official_date: price.officialDate } : {}),
            history: aggregateHistory(reports),
          });
        }

        return jsonResponse({ crop: crop.id, district, days, prices });
      },
      POST: async ({ request, context }) => {
        const runtime = getPriceRuntime(context);
        if (!runtime) return jsonResponse({ error: "Price database is not configured." }, 503);

        const token = getBearerToken(request.headers.get("authorization"));
        if (!token) return jsonResponse({ error: "A valid reporter token is required." }, 401);

        const reporter = await runtime.db
          .prepare(
            "SELECT id, role, verified, is_sample FROM reporters WHERE token_hash = ? LIMIT 1",
          )
          .bind(await hashToken(token))
          .first<ReporterRow>();
        if (!reporter || reporter.is_sample === 1) {
          return jsonResponse({ error: "Reporter token is invalid." }, 401);
        }
        if (reporter.role !== "trader" || reporter.verified !== 1) {
          return jsonResponse({ error: "Only verified traders can submit prices." }, 403);
        }

        const body = await readJsonBody(request);
        if (!body.ok) {
          return jsonResponse(
            {
              error:
                body.status === 413
                  ? "Request body is too large."
                  : "Request body must be valid JSON.",
            },
            body.status,
          );
        }
        const rawBody = body.value;
        const parsed = requestSchema.safeParse(rawBody);
        if (!parsed.success) {
          return jsonResponse({ error: "Invalid crop, market, or price_per_quintal." }, 400);
        }

        const { crop, market, price_per_quintal: price } = parsed.data;
        const knownCrop = await runtime.db
          .prepare("SELECT id FROM crops WHERE id = ?")
          .bind(crop)
          .first<{ id: string }>();
        if (!knownCrop) return jsonResponse({ error: "Unknown crop." }, 404);

        const knownMarket = await runtime.db
          .prepare("SELECT id FROM markets WHERE id = ?")
          .bind(market)
          .first<{ id: string }>();
        if (!knownMarket) return jsonResponse({ error: "Unknown market." }, 404);

        const inserted = await runtime.db
          .prepare(
            `INSERT INTO price_reports (id, crop_id, market_id, price_per_quintal, reporter_id)
             SELECT ?, ?, ?, ?, ?
             WHERE NOT EXISTS (
               SELECT 1 FROM price_reports
               WHERE reporter_id = ? AND crop_id = ? AND market_id = ?
                 AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')
             )
             RETURNING id, created_at AS createdAt`,
          )
          .bind(
            crypto.randomUUID(),
            knownCrop.id,
            knownMarket.id,
            price,
            reporter.id,
            reporter.id,
            knownCrop.id,
            knownMarket.id,
          )
          .first<{ id: string; createdAt: string }>();

        if (!inserted) {
          return jsonResponse(
            { error: "This trader already reported this crop and market within the last hour." },
            429,
          );
        }

        return jsonResponse(
          {
            id: inserted.id,
            crop: knownCrop.id,
            market: knownMarket.id,
            price_per_quintal: price,
            created_at: inserted.createdAt,
          },
          201,
        );
      },
    },
  },
});
