import { describe, expect, it } from "vitest";
import { conversionState } from "../../src/ui/conversion-state.js";
describe("currency pair editing state", () => {
  it("retains only an unchanged foreign pair and makes matching currencies automatic", () => {
    expect(conversionState("EUR/USD", "EUR", "USD", "0.8")).toEqual({ pair: "EUR/USD", rate: "0.8", automatic: false });
    expect(conversionState("EUR/USD", "GBP", "USD", "0.8")).toEqual({ pair: "GBP/USD", rate: "", automatic: false });
    expect(conversionState("EUR/USD", "EUR", "EUR", "0.8")).toEqual({ pair: "EUR/EUR", rate: "1", automatic: true });
    expect(conversionState("EUR/EUR", "EUR", "USD", "1")).toEqual({ pair: "EUR/USD", rate: "", automatic: false });
    expect(conversionState("EUR/USD", "EUR", "USD", "").rate).toBe("");
  });
});
