import { z } from "zod";
import rawSampleData from "./sample-data.json";

const amount = z.number().finite().nonnegative();

const sellingTermsSchema = z.object({
  priceFactor: amount,
  transportPerQuintal: amount,
  commissionRate: z.number().min(0).max(1),
  spoilageRate: z.number().min(0).max(1),
  waitingPerQuintal: amount,
  cashDays: z.number().int().nonnegative(),
});

/** Every forecast is a range with a one-line note, never a single prediction. */
export const forecastSchema = z
  .object({
    daysAhead: z.number().int().positive(),
    low: amount,
    expected: amount,
    high: amount,
    confidenceNoteKey: z.literal("sampleForecastConfidence"),
  })
  .refine(({ low, expected, high }) => low <= expected && expected <= high, {
    message: "Forecast must satisfy low <= expected <= high.",
  });

export type ForecastRange = z.infer<typeof forecastSchema>;

const facilitySchema = z.object({
  id: z.string().startsWith("sample-"),
  name: z.string().startsWith("SAMPLE "),
  distanceKm: amount,
});

const sampleDataSchema = z.object({
  label: z.literal("SAMPLE"),
  notice: z.string().min(1),
  units: z.object({
    money: z.literal("INR"),
    quantity: z.literal("quintal"),
    price: z.literal("INR per quintal"),
    distance: z.literal("km"),
  }),
  distanceBasis: z.string().min(1),
  sellingAssumptions: z.object({
    trader: sellingTermsSchema,
    mandi: sellingTermsSchema,
    pool: sellingTermsSchema,
    warehouse: sellingTermsSchema,
    warehouseEligibleCrops: z.array(z.enum(["wheat", "paddy"])),
    warehouseSaleDays: z.number().int().positive(),
    receiptLoanAdvanceRate: z.number().min(0).max(1),
    receiptLoanInterestRate: z.number().min(0).max(1),
    switchingFeesKnown: z.literal(false),
  }),
  crops: z
    .array(
      z.object({
        id: z.enum(["tomato", "onion", "potato", "wheat", "paddy"]),
        nameKey: z.enum(["tomato", "onion", "potato", "wheat", "paddy"]),
        samplePricePerQuintal: amount,
        forecast: forecastSchema,
      }),
    )
    .length(5),
  mandis: z.array(facilitySchema).length(4),
  warehouses: z.array(facilitySchema).length(3),
  fpos: z.array(facilitySchema).length(2),
  sampleReporters: z
    .array(
      z.object({
        id: z.string().startsWith("sample-reporter-"),
        phone: z.string().startsWith("+91"),
        role: z.enum(["trader", "shopkeeper"]),
        displayName: z.string().startsWith("SAMPLE "),
      }),
    )
    .length(3),
});

export const sampleData = sampleDataSchema.parse(rawSampleData);
