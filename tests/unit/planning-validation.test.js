import { describe, expect, it } from "vitest";
import { validatePlanning, validateCombinedRiskBudget, createTrade, calculateTrade, normalizeInstrument } from "../../src/domain/journal.js";

const snapshot = normalizeInstrument({ id: "i", name: "Acme", symbol: "ACME", market: "Equities", preset: "equity", model: "linear", currency: "USD", quantityUnit: "shares", quantityIncrement: "1", priceIncrement: "0.01", pointValue: "1" });
const leg = (planning) => ({ id: "stable-leg", instrumentId: "i", snapshot, direction: "long", planning });
function caught(check) { try { check(); } catch (error) { return error; } throw new Error("Expected validation to fail"); }

describe("planning validation field paths", () => {
  it("identifies offending supplied leg values with stable leg IDs", () => {
    for (const [key, value] of Object.entries({ entry: "10.001", stop: "8.001", target: "12.001", quantity: "1.5", riskBudget: "-1", rate: "0" })) {
      const error = caught(() => validatePlanning(leg({ [key]: value })));
      expect(error.path).toEqual(["legs", "stable-leg", "planning", key]);
      expect(error.message).toMatch(/increment|positive/);
    }
  });
  it("identifies combined budget errors through standalone validation and complete replay", () => {
    const error = caught(() => validateCombinedRiskBudget("-1"));
    expect(error.path).toEqual(["riskBudget"]);
    expect(error.message).toBe("Combined risk budget must be positive");
    const trade = createTrade({ id: "t", account: { id: "a", name: "Main", currency: "USD" }, instruments: [{ instrument: snapshot, direction: "long" }] });
    trade.riskBudget = "-1";
    expect(caught(() => calculateTrade(trade)).path).toEqual(["riskBudget"]);
    expect(() => validateCombinedRiskBudget(null)).not.toThrow();
    expect(() => validateCombinedRiskBudget("500")).not.toThrow();
  });
});
