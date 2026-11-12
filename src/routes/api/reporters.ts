import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";

import { sampleData } from "@/services/sample-data";
import {
  createReporterToken,
  getPriceRuntime,
  hashToken,
  matchesSecret,
  readJsonBody,
} from "@/services/market-prices";

const createReporterSchema = z.object({
  phone: z.string().regex(/^\+91[6-9]\d{9}$/),
  display_name: z.string().trim().min(2).max(80),
  role: z.enum(["trader", "shopkeeper"]),
  verified: z.boolean(),
});

const createMarketSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    district: z.string().trim().min(2).max(120),
    state: z.string().trim().min(2).max(120),
    lat: z.number().finite().min(-90).max(90).optional(),
    lng: z.number().finite().min(-180).max(180).optional(),
  })
  .refine((market) => (market.lat === undefined) === (market.lng === undefined), {
    message: "Latitude and longitude must be supplied together.",
  });

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export const Route = createFileRoute("/api/reporters")({
  server: {
    handlers: {
      POST: async ({ request, context }) => {
        const runtime = getPriceRuntime(context);
        if (!runtime) return jsonResponse({ error: "Price database is not configured." }, 503);
        if (!runtime.priceAdminSecret) {
          return jsonResponse({ error: "Reporter administration is not configured." }, 503);
        }

        const match = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i);
        if (!match || !matchesSecret(match[1]!, runtime.priceAdminSecret)) {
          return jsonResponse({ error: "Administrator authorization is required." }, 401);
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

        if (
          typeof rawBody === "object" &&
          rawBody !== null &&
          "action" in rawBody &&
          rawBody.action === "seed_samples"
        ) {
          for (const reporter of sampleData.sampleReporters) {
            await runtime.db
              .prepare(
                `INSERT OR IGNORE INTO reporters
                   (id, phone, role, verified, display_name, is_sample, token_hash)
                 VALUES (?, ?, ?, 0, ?, 1, NULL)`,
              )
              .bind(reporter.id, reporter.phone, reporter.role, reporter.displayName)
              .run();
          }
          return jsonResponse({
            seeded: sampleData.sampleReporters.map(({ id, displayName, role }) => ({
              id,
              display_name: displayName,
              role,
              label: "Sample data",
            })),
          });
        }

        if (
          typeof rawBody === "object" &&
          rawBody !== null &&
          "action" in rawBody &&
          rawBody.action === "create_market"
        ) {
          const parsedMarket = createMarketSchema.safeParse(rawBody);
          if (!parsedMarket.success) {
            return jsonResponse(
              { error: "Provide a market name, district, state, and optional coordinate pair." },
              400,
            );
          }

          const market = parsedMarket.data;
          const existingMarket = await runtime.db
            .prepare(
              "SELECT id FROM markets WHERE name = ? COLLATE NOCASE AND district = ? COLLATE NOCASE AND state = ? COLLATE NOCASE",
            )
            .bind(market.name, market.district, market.state)
            .first<{ id: string }>();
          if (existingMarket) {
            return jsonResponse(
              { error: "This market already exists in that district and state." },
              409,
            );
          }

          const id = crypto.randomUUID();
          await runtime.db
            .prepare(
              "INSERT INTO markets (id, name, district, state, lat, lng) VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(
              id,
              market.name,
              market.district,
              market.state,
              market.lat ?? null,
              market.lng ?? null,
            )
            .run();
          return jsonResponse({ id, ...market }, 201);
        }

        const parsed = createReporterSchema.safeParse(rawBody);
        if (!parsed.success) {
          return jsonResponse(
            {
              error:
                "Provide a valid Indian phone number, display_name, trader/shopkeeper role, and verified status.",
            },
            400,
          );
        }

        const existing = await runtime.db
          .prepare("SELECT id FROM reporters WHERE phone = ?")
          .bind(parsed.data.phone)
          .first<{ id: string }>();
        if (existing)
          return jsonResponse({ error: "A reporter with this phone already exists." }, 409);

        const id = crypto.randomUUID();
        const token = createReporterToken();
        await runtime.db
          .prepare(
            `INSERT INTO reporters
               (id, phone, role, verified, display_name, is_sample, token_hash)
             VALUES (?, ?, ?, ?, ?, 0, ?)`,
          )
          .bind(
            id,
            parsed.data.phone,
            parsed.data.role,
            Number(parsed.data.verified),
            parsed.data.display_name,
            await hashToken(token),
          )
          .run();

        return jsonResponse(
          {
            reporter: {
              id,
              phone: parsed.data.phone,
              display_name: parsed.data.display_name,
              role: parsed.data.role,
              verified: parsed.data.verified,
            },
            token,
            warning: "Save this token now. It cannot be retrieved after this response.",
          },
          201,
        );
      },
    },
  },
});
