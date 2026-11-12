import { describe, expect, it } from "vitest";
import { buildResults } from "./results";
import type { Sale } from "@/lib/i18n";

const sale: Sale = { qty: 10, place: "411001", cashBy: "in1week", owes: false, debt: 0 };
describe("ranked sample results", () => {
  it("shows three ranked options with the local trader today", () => {
    const options = buildResults("tomato", { ...sale, cashBy: "today" });
    expect(options).toHaveLength(3);
    expect(options[0]?.kind).toBe("trader");
    expect(options[0]?.youKeep).toBe(16200);
    expect(options.filter((o) => o.meetsDeadline).map((o) => o.kind)).toEqual(["trader"]);
  });
  it("ranks pooling highest when the cash date allows it", () => {
    const options = buildResults("tomato", sale);
    expect(options[0]?.kind).toBe("pool");
    expect(options[0]?.youKeep).toBe(18098.4);
  });
  it("shows trader repayment beside extra income without double deduction", () => {
    const pool = buildResults("tomato", { ...sale, owes: true, debt: 5000 }).find(
      (o) => o.kind === "pool",
    );
    expect(pool?.repayment).toBe(5000);
    expect(pool?.extraIncome).toBe(1898.4);
    expect(pool?.youKeep).toBe(13098.4);
  });
  it("does not mark cash available when debt consumes all proceeds", () => {
    expect(
      buildResults("tomato", { ...sale, owes: true, debt: 50000 }).every((o) => !o.meetsDeadline),
    ).toBe(true);
  });
  it("only includes warehouse storage for eligible sample grain crops", () => {
    expect(buildResults("tomato", sale).some((o) => o.kind === "warehouse")).toBe(false);
    expect(buildResults("wheat", sale).some((o) => o.kind === "warehouse")).toBe(true);
  });
  it("keeps receipt borrowing separate from eventual income and repayment", () => {
    const warehouse = buildResults("wheat", { ...sale, owes: true, debt: 5000 }).find(
      (o) => o.kind === "warehouse",
    );
    expect(warehouse?.receiptLoan).toBe(15600);
    expect(warehouse?.netIncome).toBe(26574);
    expect(warehouse?.youKeep).toBe(21574);
    expect(warehouse?.cashAvailable).toBe(10000);
    expect(warehouse?.meetsDeadline).toBe(true);
  });
  it("rejects incomplete entries rather than inventing farmer inputs", () => {
    expect(buildResults("tomato", { ...sale, cashBy: null })).toEqual([]);
    expect(buildResults("tomato", { ...sale, owes: true, debt: 0 })).toEqual([]);
    expect(buildResults("unknown", sale)).toEqual([]);
  });
});
