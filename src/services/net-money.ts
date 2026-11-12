export type NetMoneyInput = {
  /** Rupees per quintal. */
  price: number;
  /** Quantity in quintals. */
  quantity: number;
  /** Total costs in rupees, not percentages or per-unit rates. */
  transport: number;
  commission: number;
  expectedSpoilageLoss: number;
  waitingCost: number;
};

/** No forecast, debt deduction, or rounding is hidden in this calculation. */
export function net_money(input: NetMoneyInput): number {
  for (const value of Object.values(input)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError("Money inputs must be finite, non-negative numbers.");
    }
  }
  return (
    input.price * input.quantity -
    input.transport -
    input.commission -
    input.expectedSpoilageLoss -
    input.waitingCost
  );
}
