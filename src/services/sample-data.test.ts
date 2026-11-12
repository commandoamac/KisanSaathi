import { describe, expect, it } from "vitest";
import { sampleData, forecastSchema } from "./sample-data";
import { STRINGS } from "@/i18n/translations";

describe("sample data rules", () => {
  it("has exactly the five requested crops", () => {
    expect(sampleData.crops.map((crop) => crop.id).sort()).toEqual([
      "onion",
      "paddy",
      "potato",
      "tomato",
      "wheat",
    ]);
  });
  it("has four mandis with distances", () => {
    expect(sampleData.mandis).toHaveLength(4);
    expect(sampleData.mandis.map((mandi) => mandi.distanceKm)).toEqual([12, 28, 45, 67]);
  });
  it("has three warehouses", () => {
    expect(sampleData.warehouses).toHaveLength(3);
  });
  it("has two FPOs", () => {
    expect(sampleData.fpos).toHaveLength(2);
  });
  it("keeps the demo reporters clearly labeled and token-free", () => {
    expect(sampleData.sampleReporters).toHaveLength(3);
    expect(
      sampleData.sampleReporters.every((reporter) => reporter.displayName.startsWith("SAMPLE ")),
    ).toBe(true);
  });
  it("labels the data as SAMPLE", () => {
    expect(sampleData.label).toBe("SAMPLE");
  });
  it("requires ordered low, expected, high ranges on every forecast", () => {
    for (const crop of sampleData.crops) {
      expect(crop.forecast.low).toBeLessThanOrEqual(crop.forecast.expected);
      expect(crop.forecast.expected).toBeLessThanOrEqual(crop.forecast.high);
    }
    const base = {
      daysAhead: 7,
      low: 100,
      expected: 200,
      high: 300,
      confidenceNoteKey: "sampleForecastConfidence",
    };
    expect(forecastSchema.safeParse({ ...base, low: 400 }).success).toBe(false);
    expect(forecastSchema.safeParse({ ...base, high: undefined }).success).toBe(false);
  });
  it("requires a one-line confidence note on every forecast", () => {
    for (const crop of sampleData.crops) {
      const note = STRINGS.en[crop.forecast.confidenceNoteKey];
      expect(note).toBeTruthy();
      expect(note).not.toMatch(/[\r\n]/);
      expect(
        forecastSchema.safeParse({ ...crop.forecast, confidenceNoteKey: undefined }).success,
      ).toBe(false);
    }
  });
});
