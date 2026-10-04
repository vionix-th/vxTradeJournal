import { describe, expect, it } from "vitest";
import { recentInstruments } from "../../src/application/instruments.js";

describe("shared recent instrument ordering", () => {
  it("orders by newest linked trade activity with name as deterministic tie breaker", () => {
    const instruments = [{ id: "z", name: "Zulu" }, { id: "b", name: "Beta" }, { id: "a", name: "Alpha" }, { id: "unused", name: "Unused" }];
    const trades = [
      { updatedAt: "2026-01-01T00:00:00Z", legs: [{ instrumentId: "z" }] },
      { updatedAt: "2026-01-03T00:00:00Z", legs: [{ instrumentId: "b" }, { instrumentId: "a" }] },
      { updatedAt: "2026-01-02T00:00:00Z", legs: [{ instrumentId: "z" }, { instrumentId: "b" }] },
    ];
    expect(recentInstruments(instruments, trades).map(({ id }) => id)).toEqual(["a", "b", "z", "unused"]);
    expect(instruments.map(({ id }) => id)).toEqual(["z", "b", "a", "unused"]);
    expect(trades[0].legs[0].instrumentId).toBe("z");
  });
});
