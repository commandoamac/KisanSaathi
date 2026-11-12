import { describe, expect, it } from "vitest";
import { net_money, type NetMoneyInput } from "./net-money";

const input: NetMoneyInput = {
  price: 2000,
  quantity: 10,
  transport: 1000,
  commission: 400,
  expectedSpoilageLoss: 600,
  waitingCost: 200,
};

describe("net_money", () => {
  it("subtracts all four costs from price times quantity", () => {
    expect(net_money(input)).toBe(17800);
  });
  it("returns gross money when all costs are zero", () => {
    expect(
      net_money({
        price: 2000,
        quantity: 10,
        transport: 0,
        commission: 0,
        expectedSpoilageLoss: 0,
        waitingCost: 0,
      }),
    ).toBe(20000);
  });
  it("keeps losses negative rather than hiding them", () => {
    expect(net_money({ ...input, price: 100, quantity: 1 })).toBe(-2100);
  });
  it("supports fractional quintals and rupees without hidden rounding", () => {
    expect(
      net_money({
        price: 1500.5,
        quantity: 1.5,
        transport: 100.25,
        commission: 25.5,
        expectedSpoilageLoss: 50,
        waitingCost: 10,
      }),
    ).toBe(2065);
  });
  it("handles zero quantity with incurred costs", () => {
    expect(net_money({ ...input, quantity: 0 })).toBe(-2200);
  });
  it.each(Object.keys(input) as (keyof NetMoneyInput)[])("rejects invalid %s", (key) => {
    for (const invalid of [-1, NaN, Infinity, -Infinity]) {
      expect(() => net_money({ ...input, [key]: invalid })).toThrow(RangeError);
    }
  });
});
