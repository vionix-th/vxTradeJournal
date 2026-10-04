import { describe, it, expect } from "vitest";
import { newTrade, editTrade, replaceLegs, editLeg, putExecution, putAdjustment, removeChild, correctSnapshot } from "../../src/application/operations.js";
import { normalizeInstrument, normalizeAccount, calculateTrade } from "../../src/domain/journal.js";
const account = normalizeAccount({ id: "a", name: "Main", currency: "USD" });
const instrument = normalizeInstrument({ id: "i", name: "Acme", symbol: "ACME", market: "Equities", preset: "equity", model: "linear", quantityUnit: "shares", quantityIncrement: "1", priceIncrement: "0.01", pointValue: "1", currency: "USD" });
const data = { accounts: [account], instruments: [instrument], strategies: [{ id: "s", name: "Rules", entryRules: "Original", archived: false }] };
const base = () => newTrade({ id: "t", accountId: "a", legs: [{ instrumentId: "i", direction: "long" }] }, data);
const entry = { id: "e", legId: "t-leg-1", kind: "entry", quantity: "2", price: "10", timestamp: "2026-01-01T07:00:00+07:00" };
describe("shared workflow operations", () => {
  it("enforces planned quantity increments on initial creation and leg edits", () => {
    expect(() => newTrade({ id: "invalid-plan", accountId: "a", legs: [
      { instrumentId: "i", direction: "long", planning: { quantity: "1.5" } },
    ] }, data)).toThrow(/quantity.*increment/i);
    const original = base();
    const before = structuredClone(original);
    expect(() => editLeg(original, "t-leg-1", { planning: { quantity: "1.5" } })).toThrow(/quantity.*increment/i);
    expect(original).toEqual(before);
  });

  it("rejects a snapshot increment correction invalidating its existing plan atomically", () => {
    const original = editLeg(base(), "t-leg-1", { planning: { quantity: "1" } });
    const before = structuredClone(original);
    expect(() => correctSnapshot(original, "t-leg-1", { quantityIncrement: "2" })).toThrow(/quantity.*increment/i);
    expect(original).toEqual(before);
  });

  it("rejects invalid initial direction before returning a source trade", () => {
    expect(() => newTrade({ id: "invalid", accountId: "a", legs: [{ instrumentId: "i", direction: "sideways" }] }, data)).toThrow(/direction/i);
  });

  it.each([
    ["tags", { tags: [42] }, /tags/i],
    ["risk budget", { riskBudget: "-1" }, /budget/i],
  ])("validates %s consistently when creating and editing context", (_label, patch, error) => {
    expect(() => newTrade({ id: "invalid", accountId: "a", legs: [{ instrumentId: "i", direction: "long" }], ...patch }, data)).toThrow(error);
    expect(() => editTrade(base(), patch, data)).toThrow(error);
  });

  const mutations = [
    ["context", (t) => editTrade(t, { review: "Changed" }, data)],
    ["leg replacement", (t) => replaceLegs(t, t.legs, data)],
    ["leg edit", (t) => editLeg(t, "t-leg-1", { planning: { stop: "8" } })],
    ["execution", (t) => putExecution(t, { ...entry, id: "later", timestamp: "2026-01-03T00:00:00Z" })],
    ["adjustment", (t) => putAdjustment(t, { id: "new-adjustment", amount: "1", currency: "USD", timestamp: "2026-01-03T00:00:00Z", reason: "Credit" })],
    ["removal", (t) => removeChild(t, "adjustments", "existing-adjustment")],
    ["snapshot correction", (t) => correctSnapshot(t, "t-leg-1", { pointValue: "2" })],
  ];
  const withRecords = () => ({
    ...putExecution(base(), entry),
    revision: 4, uid: "alice", createdAt: "2026-01-01T00:00:00.000Z", lastOperation: "previous-op",
    adjustments: [{ id: "existing-adjustment", amount: "0", currency: "USD", rate: "1", timestamp: "2026-01-02T00:00:00Z", reason: "Recorded" }],
  });

  it.each(mutations)("%s rejects invalid resulting execution history", (_label, mutate) => {
    const invalid = withRecords();
    invalid.executions.push({ ...entry, id: "over-exit", kind: "exit", quantity: "3", timestamp: "2026-01-02T00:00:00Z" });
    expect(() => mutate(invalid)).toThrow(/remaining/i);
  });

  it.each(mutations)("%s returns detached, valid source records without stale derived fields", (_label, mutate) => {
    const input = {
      ...withRecords(),
      summary: { complete: true, accountNet: "999" }, status: "closed",
      openedAt: "1999-01-01T00:00:00Z", instruments: [{ name: "Stale", symbol: "OLD", market: "Old" }],
    };
    const before = structuredClone(input);
    const next = mutate(input);

    for (const field of ["summary", "status", "openedAt", "instruments"]) expect(next).not.toHaveProperty(field);
    expect(next).toMatchObject({ revision: 4, uid: "alice", createdAt: "2026-01-01T00:00:00.000Z", lastOperation: "previous-op" });
    expect(next).not.toBe(input);
    expect(next.legs[0].snapshot).not.toBe(input.legs[0].snapshot);
    expect(calculateTrade(next).status).toBe("open");
    expect(input).toEqual(before);
  });

  it("normalizes initial and added leg snapshots identically while preserving detached historical legs", () => {
    const catalogue = {
      id: "raw", uid: "alice", revision: 3, schemaVersion: 1,
      name: "  Example  ", symbol: " EX ", market: " Equities ",
      preset: "equity", model: "linear", quantityUnit: " shares ",
      quantityIncrement: "1.0", priceIncrement: "0.010", pointValue: "01.00", currency: "USD",
      priceUnit: " USD/share ",
    };
    const records = { ...data, instruments: [catalogue] };
    const initial = newTrade({ id: "normalized", accountId: "a", legs: [
      { id: "historical-leg", instrumentId: "raw", direction: "long", planning: { entry: "10" } },
    ] }, records);
    const planning = { entry: "12", stop: "10" };
    const added = replaceLegs(initial, [...initial.legs, {
      id: "added-leg", instrumentId: "raw", direction: "short", planning,
    }], records);

    expect(added.legs.map((item) => item.id)).toEqual(["historical-leg", "added-leg"]);
    expect(added.legs[0]).toEqual(initial.legs[0]);
    expect(added.legs[1].snapshot).toEqual(initial.legs[0].snapshot);
    expect(added.legs[1].snapshot).toMatchObject({
      id: "raw", uid: "alice", revision: 3, schemaVersion: 1,
      name: "Example", symbol: "EX", market: "Equities", preset: "equity", model: "linear",
      quantityUnit: "shares", priceUnit: "USD/share", quantityIncrement: "1", priceIncrement: "0.01", pointValue: "1",
      venue: "", underlying: "", expiry: "", strike: null, optionType: "", draft: false, archived: false, lastUsedAt: null,
    });
    expect(added.legs[1].snapshot).not.toBe(catalogue);
    expect(added.legs[1].planning).not.toBe(planning);
    catalogue.pointValue = "100";
    planning.stop = "11";
    expect(initial.legs[0].snapshot.pointValue).toBe("1");
    expect(added.legs[1].snapshot.pointValue).toBe("1");
    expect(added.legs[1].planning.stop).toBe("10");
  });

  it("keeps absent quotation metadata absent for both initial and added legs", () => {
    const withoutQuotation = { ...instrument };
    delete withoutQuotation.priceUnit;
    const records = { ...data, instruments: [withoutQuotation] };
    const initial = newTrade({ id: "absent", accountId: "a", legs: [{ instrumentId: "i", direction: "long" }] }, records);
    const added = replaceLegs(initial, [...initial.legs, { id: "added", instrumentId: "i", direction: "short" }], records);

    expect(initial.legs[0].snapshot).not.toHaveProperty("priceUnit");
    expect(added.legs[1].snapshot).not.toHaveProperty("priceUnit");
    expect(added.legs[1].planning).toEqual({});
  });

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
  it("invalidates only corrected leg result and sizing rates, preserving independent fees", () => {
    let trade = newTrade({ id: "t", accountId: "a", legs: [
      { id: "first", instrumentId: "i", direction: "long", planning: { entry: "10", stop: "8", rate: "1" } },
      { id: "other", instrumentId: "i", direction: "long", planning: { rate: "1" } },
    ] }, data);
    trade = putExecution(trade, { ...entry, legId: "first", fees: "1" });
    trade = putExecution(trade, { ...entry, id: "exit", legId: "first", kind: "exit", price: "12", timestamp: "2026-01-02T00:00:00Z" });
    trade = putExecution(trade, { ...entry, id: "other-entry", legId: "other" });
    const corrected = correctSnapshot(trade, "first", { currency: "EUR" });
    expect(calculateTrade(corrected)).toMatchObject({ complete: false, accountNet: null, knownAccountNet: "-1", native: { EUR: "4", USD: "-1" } });
    expect(corrected.legs[0].planning.rate).toBeNull();
    expect(corrected.executions.filter((e) => e.legId === "first").map((e) => e.resultRate)).toEqual([null, null]);
    expect(corrected.executions[0]).toMatchObject({ feeCurrency: "USD", feeRate: "1" });
    expect(corrected.legs[1].planning.rate).toBe("1");
    expect(corrected.executions[2].resultRate).toBe("1");
    expect(trade.legs[0].snapshot.currency).toBe("USD");
    const restored = putExecution(corrected, { id: "exit", resultRate: "0.8" }, true);
    expect(calculateTrade(restored).accountNet).toBe("2.2");
  });
  it("clears foreign-to-foreign rates and automatically converts only matching currencies", () => {
    const foreign = correctSnapshot(base(), "t-leg-1", { currency: "EUR" });
    foreign.legs[0].planning.rate = "0.8";
    let trade = putExecution(foreign, { ...entry, feeCurrency: "EUR", fees: "1", feeRate: "0.8" });
    trade = putExecution(trade, { ...entry, id: "exit", kind: "exit", price: "12", resultRate: "0.8", timestamp: "2026-01-02T00:00:00Z" });
    const sterling = correctSnapshot(trade, "t-leg-1", { currency: "GBP" });
    expect(sterling.legs[0].planning.rate).toBeNull();
    expect(sterling.executions[1].resultRate).toBeNull();
    expect(sterling.executions[0]).toMatchObject({ feeCurrency: "EUR", feeRate: "0.8" });
    const dollar = correctSnapshot(sterling, "t-leg-1", { currency: "USD" });
    expect(dollar.legs[0].planning.rate).toBe("1");
    expect(dollar.executions.map((e) => e.resultRate)).toEqual(["1", "1"]);
    expect(calculateTrade(dollar).accountNet).toBe("3.2");
    expect(correctSnapshot(trade, "t-leg-1", { priceUnit: "EUR/share", pointValue: "2" }).executions[1].resultRate).toBe("0.8");
  });
});
