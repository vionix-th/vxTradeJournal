import { describe, expect, it } from "vitest";
import { createTrade, normalizeInstrument, calculateTrade } from "../../src/domain/journal.js";
import { prepareTrade } from "../../src/application/journal.js";
import { replaceLegs } from "../../src/application/operations.js";
const account = { id: "a", name: "Main", currency: "USD" };
const instrument = normalizeInstrument({ id: "i", name: "Acme", symbol: "ACME", market: "Equities", preset: "equity", model: "linear", quantityUnit: "shares", quantityIncrement: "1", priceIncrement: "0.01", pointValue: "1", currency: "USD" });
const data = { accounts: [account], instruments: [instrument], strategies: [] };
const trade = () => createTrade({ id: "t", account, instruments: Array.from({ length: 6 }, () => ({ instrument, direction: "long" })) });

describe("atomic journal leg capacity", () => {
  it("accepts six new legs and rejects expansion before persistence", () => {
    const source = trade();
    expect(prepareTrade(source, data).legs).toHaveLength(6);
    const larger = { ...source, legs: [...source.legs, { ...structuredClone(source.legs[0]), id: "seventh" }] };
    expect(() => prepareTrade(larger, data)).toThrow(/maximum 6 legs/i);
    expect(() => prepareTrade(larger, data, source)).toThrow(/maximum 6 legs/i);
    expect(() => replaceLegs(source, larger.legs, data)).toThrow(/maximum 6 legs/i);
    expect(() => createTrade({ id: "large", account, instruments: Array.from({ length: 7 }, () => ({ instrument, direction: "long" })) })).toThrow(/maximum 6 legs/i);
  });
  it("retains calculation and context edits for earlier larger records without allowing expansion", () => {
    const source = trade();
    const retained = { ...source, revision: 1, legs: [...source.legs, { ...structuredClone(source.legs[0]), id: "retained" }] };
    expect(calculateTrade(retained).legs).toHaveLength(7);
    expect(prepareTrade({ ...retained, review: "Retained history" }, data, retained).legs).toHaveLength(7);
    expect(replaceLegs(retained, retained.legs, data).legs).toHaveLength(7);
    const expanded = { ...retained, legs: [...retained.legs, { ...structuredClone(source.legs[0]), id: "extra" }] };
    expect(() => prepareTrade(expanded, data, retained)).toThrow(/maximum 6 legs/i);
  });
});
