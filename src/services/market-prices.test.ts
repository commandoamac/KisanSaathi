import { describe, expect, it } from "vitest";

import {
  aggregateHistory,
  aggregateReports,
  buildMarketPrice,
  type PriceReport,
} from "./market-prices";

const reports = (prices: number[]): PriceReport[] =>
  prices.map((pricePerQuintal, index) => ({
    pricePerQuintal,
    createdAt: `2026-11-07T10:${String(index).padStart(2, "0")}:00.000Z`,
  }));

describe("market price aggregation", () => {
  it("uses the median of community reports", () => {
    expect(aggregateReports(reports([1800, 2100, 1900]))).toMatchObject({
      pricePerQuintal: 1900,
      reportCount: 3,
    });
  });

  it("rejects reports more than 2.5 median absolute deviations from the median", () => {
    expect(aggregateReports(reports([100, 101, 102, 103, 1000]))).toMatchObject({
      pricePerQuintal: 101.5,
      reportCount: 4,
    });
  });

  it("falls back when fewer than three inlier reports remain", () => {
    const official = { pricePerQuintal: 1750, date: "2026-11-06" };
    expect(buildMarketPrice(reports([100, 101, 10000]), official)).toEqual({
      pricePerQuintal: 1750,
      reportCount: 0,
      lastUpdated: "2026-11-06",
      officialDate: "2026-11-06",
      source: "official data",
    });
  });

  it("uses community reports instead of official data when at least three inliers remain", () => {
    expect(
      buildMarketPrice(reports([100, 101, 102]), {
        pricePerQuintal: 1750,
        date: "2026-11-06",
      }),
    ).toMatchObject({ pricePerQuintal: 101, reportCount: 3, source: "community reports" });
  });

  it("does not invent a price when reports and official data are both unavailable", () => {
    expect(buildMarketPrice(reports([100, 101]), null)).toBeNull();
  });

  it("builds chronological daily medians for the requested price history", () => {
    expect(
      aggregateHistory([
        { pricePerQuintal: 110, createdAt: "2026-11-06T10:00:00.000Z" },
        { pricePerQuintal: 100, createdAt: "2026-11-07T09:00:00.000Z" },
        { pricePerQuintal: 120, createdAt: "2026-11-07T10:00:00.000Z" },
      ]),
    ).toEqual([
      { date: "2026-11-06", pricePerQuintal: 110, reportCount: 1 },
      { date: "2026-11-07", pricePerQuintal: 110, reportCount: 2 },
    ]);
  });
});
