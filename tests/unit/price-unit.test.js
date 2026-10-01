import { describe, expect, it } from "vitest";
import { normalizeInstrument, normalizeAccount, createTrade, calculateTrade } from "../../src/domain/journal.js";
const base = { id: "i", name: "Acme", symbol: "ACME", preset: "equity", market: "Equities", model: "linear", quantityUnit: "shares", quantityIncrement: "1", priceIncrement: "0.01", pointValue: "1", currency: "USD" };
describe("optional quotation units", () => {
  it("trims display metadata without changing calculation", () => {
    const instrument = normalizeInstrument({ ...base, priceUnit: "  USD/share  " });
    expect(instrument.priceUnit).toBe("USD/share");
    const t = createTrade({ id: "t", account: normalizeAccount({ id: "a", name: "Main", currency: "USD" }), instruments: [{ instrument, direction: "long" }] });
    const before = calculateTrade(t);
    instrument.priceUnit = "Changed";
    expect(t.legs[0].snapshot.priceUnit).toBe("USD/share");
    expect(calculateTrade(t)).toEqual(before);
  });
  it("preserves absent metadata and accepts empty units", () => {
    expect(normalizeInstrument(base)).not.toHaveProperty("priceUnit");
    expect(normalizeInstrument({ ...base, priceUnit: "" }).priceUnit).toBe("");
  });
  it("rejects oversized and non-text units", () => {
    for (const priceUnit of ["x".repeat(81), 123, null, {}])
      expect(() => normalizeInstrument({ ...base, priceUnit })).toThrow(/unit/i);
  });
});
