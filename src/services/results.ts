import { net_money } from "./net-money";
import { sampleData, type ForecastRange } from "./sample-data";
import type { Sale } from "@/lib/i18n";

export type OptionKind = "trader" | "mandi" | "pool" | "warehouse";
export type SaleOption = {
  kind: OptionKind;
  netIncome: number;
  youKeep: number;
  priceRange: ForecastRange;
  cashDays: number;
  cashAvailable: number;
  meetsDeadline: boolean;
  repayment: number;
  extraIncome: number;
  receiptLoan: number;
};

const DEADLINE_DAYS: Record<string, number> = {
  today: 0,
  in3days: 3,
  in1week: 7,
  in2weeks: 14,
  in1month: 30,
  noHurry: Infinity,
};
const round = (value: number) => Math.round(value * 100) / 100;

/** Sample comparisons only: no geocoding, live prices or unverified switching fee estimates. */
export function buildResults(cropId: string, sale: Sale): SaleOption[] {
  const crop = sampleData.crops.find((item) => item.id === cropId);
  const deadline = sale.cashBy ? DEADLINE_DAYS[sale.cashBy] : undefined;
  if (
    !crop ||
    deadline === undefined ||
    sale.qty <= 0 ||
    sale.owes === null ||
    (sale.owes && sale.debt <= 0)
  )
    return [];
  const assumptions = sampleData.sellingAssumptions;
  const debt = sale.owes ? sale.debt : 0;
  const kinds: OptionKind[] = ["trader", "mandi", "pool"];
  if (assumptions.warehouseEligibleCrops.some((id) => id === cropId)) kinds.push("warehouse");

  const options = kinds.map((kind): SaleOption => {
    const terms = assumptions[kind];
    const price = round(crop.samplePricePerQuintal * terms.priceFactor);
    const gross = price * sale.qty;
    const receiptLoan =
      kind === "warehouse"
        ? round(crop.samplePricePerQuintal * sale.qty * assumptions.receiptLoanAdvanceRate)
        : 0;
    const netIncome = round(
      net_money({
        price,
        quantity: sale.qty,
        transport: terms.transportPerQuintal * sale.qty,
        commission: gross * terms.commissionRate,
        expectedSpoilageLoss: gross * terms.spoilageRate,
        waitingCost:
          terms.waitingPerQuintal * sale.qty + receiptLoan * assumptions.receiptLoanInterestRate,
      }),
    );
    // Principal is repaid once. Borrowed principal is not extra income.
    const youKeep = round(netIncome - debt);
    const cashAvailable =
      kind === "warehouse"
        ? round(receiptLoan - terms.transportPerQuintal * sale.qty - debt)
        : youKeep;
    return {
      kind,
      netIncome,
      youKeep,
      cashAvailable,
      receiptLoan,
      repayment: debt,
      extraIncome: 0,
      cashDays: terms.cashDays,
      meetsDeadline: terms.cashDays <= deadline && cashAvailable > 0,
      priceRange: {
        daysAhead:
          kind === "warehouse" ? assumptions.warehouseSaleDays : Math.max(1, terms.cashDays),
        low: round(crop.forecast.low * terms.priceFactor),
        expected: price,
        high: round(crop.forecast.high * terms.priceFactor),
        confidenceNoteKey: crop.forecast.confidenceNoteKey,
      },
    };
  });
  const trader = options.find((option) => option.kind === "trader");
  if (!trader) return [];
  for (const option of options) option.extraIncome = round(option.netIncome - trader.netIncome);
  return options
    .sort((a, b) => Number(b.meetsDeadline) - Number(a.meetsDeadline) || b.youKeep - a.youKeep)
    .slice(0, 3);
}
