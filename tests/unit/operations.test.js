import { describe, it, expect } from "vitest";
import { newTrade, editTrade, editLeg, putExecution, putAdjustment, removeChild, correctSnapshot } from "../../src/application/operations.js";
import { normalizeInstrument, normalizeAccount, calculateTrade } from "../../src/domain/journal.js";
const account = normalizeAccount({ id: "a", name: "Main", currency: "USD" });
const instrument = normalizeInstrument({ id: "i", name: "Acme", symbol: "ACME", market: "Equities", preset: "equity", model: "linear", quantityUnit: "shares", quantityIncrement: "1", priceIncrement: "0.01", pointValue: "1", currency: "USD" });
const data = { accounts: [account], instruments: [instrument], strategies: [{ id: "s", name: "Rules", entryRules: "Original", archived: false }] };
const base = () => newTrade({ id: "t", accountId: "a", legs: [{ instrumentId: "i", direction: "long" }] }, data);
const entry = { id: "e", legId: "t-leg-1", kind: "entry", quantity: "2", price: "10", timestamp: "2026-01-01T07:00:00+07:00" };
describe("shared workflow operations", () => {
  it("constructs immutable snapshots and preserves them when context changes", () => {
    const t = base();
    expect(t.legs[0].snapshot).toEqual(instrument);
    expect(t.legs[0].snapshot).not.toBe(instrument);
    const linked = editTrade(t, { strategyId: "s", review: "review" }, data);
    expect(linked.strategySnapshot.entryRules).toBe("Original");
    const changed = { ...data, strategies: [{ ...data.strategies[0], entryRules: "Changed" }] };
    expect(editTrade(linked, { rationale: "notes" }, changed).strategySnapshot.entryRules).toBe("Original");
    expect(t.strategyId).toBeNull();
  });
  it("shares execution defaults, UTC normalization and deterministic sequence", () => {
    const t = putExecution(base(), entry);
    expect(t.executions[0]).toMatchObject({ fees: "0", feeCurrency: "USD", timestamp: "2026-01-01T00:00:00.000Z", sequence: 1 });
    const closed = putExecution(t, { ...entry, id: "exit", kind: "exit", price: "12", timestamp: "2026-01-02T00:00:00Z" });
    expect(calculateTrade(closed).accountNet).toBe("4");
    expect(() => putExecution(closed, { ...entry, quantity: "1" }, true)).toThrow(/remaining/);
    expect(t.executions).toHaveLength(1);
    expect(() => putExecution(t, entry)).toThrow(/exists|duplicate/i);
  });
  it("validates leg and record removal against subsequent history", () => {
    const t = putExecution(base(), entry);
    expect(() => removeChild(t, "legs", "t-leg-1")).toThrow(/leg|execution/i);
    expect(removeChild(t, "executions", "e").executions).toEqual([]);
    const adjusted = putAdjustment(t, { id: "x", amount: "-1", currency: "USD", timestamp: "2026-01-01T00:00:00Z", reason: "Cost" });
    expect(calculateTrade(adjusted).accountNet).toBe("-1");
    expect(editLeg(t, "t-leg-1", { planning: { stop: "8" } }).legs[0].snapshot).toEqual(instrument);
  });
  it("corrects one snapshot without modifying the catalogue or the original trade", () => {
    const t = putExecution(base(), entry);
    const changed = correctSnapshot(t, "t-leg-1", { pointValue: "2" });
    expect(changed.legs[0].snapshot.pointValue).toBe("2");
    expect(t.legs[0].snapshot.pointValue).toBe("1");
    expect(instrument.pointValue).toBe("1");
  });
  it("clears obsolete conversion rates when an editable currency pair changes", () => {
    const original = putAdjustment(base(), { id: "x", amount: "1", currency: "USD", timestamp: "2026-01-01T00:00:00Z", reason: "Credit" });
    const changed = putAdjustment(original, { id: "x", currency: "EUR" }, true);
    expect(changed.adjustments[0].rate).toBeNull();
    expect(calculateTrade(changed).complete).toBe(false);
    const filled = putExecution(base(), entry);
    const foreignFees = putExecution(filled, { id: "e", feeCurrency: "EUR", fees: "1" }, true);
    expect(foreignFees.executions[0].feeRate).toBeNull();
    expect(calculateTrade(foreignFees).complete).toBe(false);
  });
});
