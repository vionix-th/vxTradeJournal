import { describe, expect, it } from "vitest";
import { hasPlanValues, planningFeedback, nextConversionRate } from "../../src/ui/planning.js";
const snapshot = { id: "i", name: "Acme", symbol: "ACME", preset: "equity", market: "Equities", model: "linear", quantityUnit: "shares", quantityIncrement: "1", priceIncrement: "0.01", pointValue: "1", currency: "USD" };
const leg = (planning = {}, instrument = snapshot) => ({ snapshot: instrument, direction: "long", planning });
describe("optional planning presentation", () => {
  it("opens only meaningful saved plans", () => {
    expect(hasPlanValues(leg({ rate: "1" }), "USD")).toBe(false);
    expect(hasPlanValues(leg({ quantity: "2" }), "USD")).toBe(true);
    expect(hasPlanValues(leg({ rate: "0.8" }, { ...snapshot, currency: "EUR" }), "USD")).toBe(true);
  });
  it("distinguishes incomplete inputs from supplied invalid values", () => {
    expect(planningFeedback(leg(), "USD", 1).kind).toBe("guidance");
    expect(planningFeedback(leg({ riskBudget: "-1" }), "USD", 1)).toMatchObject({ kind: "error", message: "Risk budget must be positive" });
    expect(planningFeedback(leg({ entry: "10.001" }), "USD", 1).kind).toBe("error");
    expect(planningFeedback(leg({ entry: "10", stop: "8", riskBudget: "500" }), "USD", 1)).toMatchObject({ kind: "ready", result: { quantity: "250", plannedRisk: "500" } });
    expect(planningFeedback(leg({ entry: "10", stop: "12" }), "USD", 1).kind).toBe("error");
  });
  it("keeps manual and multi-leg sizing manual", () => {
    expect(planningFeedback(leg(), "USD", 2).message).toMatch(/combined risk manually/);
    expect(planningFeedback(leg({}, { ...snapshot, model: "manual", pointValue: null }), "USD", 1).message).toMatch(/manually/);
  });
  it("clears rates on currency-pair changes and uses automatic same-currency one", () => {
    expect(nextConversionRate("EUR/USD", "EUR/USD", "0.8")).toBe("0.8");
    expect(nextConversionRate("EUR/USD", "GBP/USD", "0.8")).toBe("");
    expect(nextConversionRate("EUR/USD", "EUR/EUR", "0.8")).toBe("1");
    expect(nextConversionRate("EUR/EUR", "EUR/USD", "1")).toBe("");
  });
});
